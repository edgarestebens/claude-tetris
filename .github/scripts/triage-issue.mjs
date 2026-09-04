#!/usr/bin/env node
/**
 * Analyzes a GitHub issue with Cursor (local agent) and writes structured triage JSON.
 *
 * Env:
 *   CURSOR_API_KEY     - required
 *   ISSUE_TITLE        - issue title (or use ISSUE_TITLE_FILE)
 *   ISSUE_BODY         - issue body (or use ISSUE_BODY_FILE)
 *   ISSUE_TITLE_FILE   - path to title file (preferred in CI)
 *   ISSUE_BODY_FILE    - path to body file (preferred in CI)
 *   ISSUE_NUMBER       - required (for logging)
 *   REPO               - owner/repo (for logging)
 *   ALLOWED_LABELS     - comma-separated label names (optional filter hint)
 *   OUTPUT_PATH        - default: triage-result.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { Agent, CursorAgentError } from "@cursor/sdk";

const MARKER = "<!-- cursor-issue-diagnosis -->";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

async function readIssueField(envName, fileEnvName) {
  const filePath = process.env[fileEnvName];
  if (filePath) {
    return await readFile(filePath, "utf8");
  }
  return process.env[envName] ?? "";
}

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty agent result");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  // Prefer first {...} object if there is surrounding prose
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in agent output");
  }

  const sliced = candidate.slice(start, end + 1);
  return JSON.parse(sliced);
}

function buildPrompt({ title, body, allowedLabels }) {
  const labelHint =
    allowedLabels.length > 0
      ? allowedLabels.join(", ")
      : "bug, enhancement, documentation, question, duplicate, invalid, wontfix, good first issue, help wanted, accessibility";

  return `Eres un agente de triage para el repositorio Tetris (HTML/CSS/JS vanilla: index.html, style.css, game.js).

TAREA
1. Lee el código del repositorio en el cwd actual para contextualizar el issue.
2. Clasifica el issue y produce un diagnóstico accionable para implementar la solución después.
3. NO modifiques ningún archivo. NO abras PRs. NO ejecutes git commit/push.

ISSUE #${process.env.ISSUE_NUMBER ?? "?"} en ${process.env.REPO ?? "repo"}
Título: ${title}

Cuerpo:
${body || "(sin cuerpo)"}

LABELS PERMITIDOS (elige solo de esta lista; 1–3 labels):
${labelHint}

RESPUESTA
Devuelve ÚNICAMENTE un objeto JSON válido (puedes envolverlo en un fence \`\`\`json) con exactamente estas claves:
{
  "labels": ["bug"],
  "diagnosis": "markdown en español"
}

El campo "diagnosis" debe ser Markdown en español con estas secciones (usa ##):
## Resumen
## Causa probable / alcance
## Archivos relevantes
## Pasos de implementación sugeridos
## Riesgos / casos borde

El diagnóstico debe ser concreto (funciones, archivos, comportamiento esperado) para que otro agente o humano pueda implementar la fix después.
No inventes labels fuera de la lista permitida.
No incluyas texto fuera del JSON.`;
}

async function main() {
  const apiKey = requireEnv("CURSOR_API_KEY");
  const title = (await readIssueField("ISSUE_TITLE", "ISSUE_TITLE_FILE")).trim();
  if (!title) {
    console.error("Missing issue title (ISSUE_TITLE or ISSUE_TITLE_FILE)");
    process.exit(1);
  }
  const body = await readIssueField("ISSUE_BODY", "ISSUE_BODY_FILE");
  const outputPath = process.env.OUTPUT_PATH || "triage-result.json";
  const allowedLabels = (process.env.ALLOWED_LABELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const prompt = buildPrompt({ title, body, allowedLabels });

  let result;
  try {
    result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: "composer-2.5" },
      local: { cwd: process.cwd() },
    });
  } catch (err) {
    if (err instanceof CursorAgentError) {
      console.error(
        `Cursor agent startup failed: ${err.message} (retryable=${err.isRetryable})`,
      );
      process.exit(err.isRetryable ? 75 : 1);
    }
    throw err;
  }

  if (result.status !== "finished") {
    console.error(`Agent run ended with status: ${result.status}`);
    process.exit(2);
  }

  const raw = result.result ?? "";
  console.log("--- agent raw output (truncated) ---");
  console.log(String(raw).slice(0, 2000));

  let parsed;
  try {
    parsed = extractJson(String(raw));
  } catch (err) {
    console.error(`Failed to parse agent JSON: ${err.message}`);
    process.exit(2);
  }

  if (!Array.isArray(parsed.labels) || typeof parsed.diagnosis !== "string") {
    console.error('JSON must include array "labels" and string "diagnosis"');
    process.exit(2);
  }

  // Restrict to allowed labels when provided
  let labels = parsed.labels.map((l) => String(l).trim()).filter(Boolean);
  if (allowedLabels.length > 0) {
    const allowed = new Set(allowedLabels.map((l) => l.toLowerCase()));
    labels = labels.filter((l) => allowed.has(l.toLowerCase()));
  }

  const diagnosis = parsed.diagnosis.trim();
  const payload = {
    labels,
    diagnosis,
    marker: MARKER,
  };

  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outputPath} with labels: ${labels.join(", ") || "(none)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
