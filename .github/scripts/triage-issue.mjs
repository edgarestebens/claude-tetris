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
import { access, readFile, writeFile } from "node:fs/promises";
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

/**
 * Extract the first top-level JSON object, respecting strings so nested
 * markdown fences like ```javascript inside "diagnosis" do not break parsing.
 */
function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty agent result");
  }

  const start = text.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in agent output");
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") {
      depth += 1;
      continue;
    }
    if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        const sliced = text.slice(start, i + 1);
        return JSON.parse(sliced);
      }
    }
  }

  throw new Error("Unterminated JSON object in agent output");
}

function normalizeTriage(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Triage payload is not an object");
  }
  if (!Array.isArray(parsed.labels) || typeof parsed.diagnosis !== "string") {
    throw new Error('JSON must include array "labels" and string "diagnosis"');
  }
  return {
    labels: parsed.labels.map((l) => String(l).trim()).filter(Boolean),
    diagnosis: parsed.diagnosis.trim(),
  };
}

function buildPrompt({ title, body, allowedLabels, outputPath }) {
  const labelHint =
    allowedLabels.length > 0
      ? allowedLabels.join(", ")
      : "bug, enhancement, documentation, question, duplicate, invalid, wontfix, good first issue, help wanted, accessibility";

  return `Eres un agente de triage para el repositorio Tetris (HTML/CSS/JS vanilla: index.html, style.css, game.js).

TAREA
1. Lee el código del repositorio en el cwd actual para contextualizar el issue.
2. Clasifica el issue y produce un diagnóstico accionable para implementar la solución después.
3. Escribe el resultado en el archivo "${outputPath}" en el cwd (ÚNICO archivo que puedes crear/modificar).
4. NO modifiques ningún otro archivo. NO abras PRs. NO ejecutes git commit/push.

ISSUE #${process.env.ISSUE_NUMBER ?? "?"} en ${process.env.REPO ?? "repo"}
Título: ${title}

Cuerpo:
${body || "(sin cuerpo)"}

LABELS PERMITIDOS (elige solo de esta lista; 1–3 labels):
${labelHint}

CONTENIDO DE ${outputPath}
Objeto JSON válido con exactamente estas claves:
{
  "labels": ["bug"],
  "diagnosis": "markdown en español"
}

Reglas del JSON:
- "diagnosis" es un string JSON: usa \\n para saltos de línea (no saltos literales sin escapar).
- Dentro de "diagnosis" NO uses fences markdown de código (evita \`\`\`); usa indentación o backticks simples de una línea.
- El campo "diagnosis" debe ser Markdown en español con estas secciones (usa ##):
  ## Resumen
  ## Causa probable / alcance
  ## Archivos relevantes
  ## Pasos de implementación sugeridos
  ## Riesgos / casos borde
- Diagnóstico concreto (funciones, archivos, comportamiento esperado).
- No inventes labels fuera de la lista permitida.

Al terminar, también puedes repetir el mismo JSON en tu respuesta final.`;
}

async function tryReadOutputFile(outputPath) {
  try {
    await access(outputPath);
    const raw = await readFile(outputPath, "utf8");
    return normalizeTriage(JSON.parse(raw));
  } catch {
    return null;
  }
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

  const prompt = buildPrompt({ title, body, allowedLabels, outputPath });

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

  const raw = String(result.result ?? "");
  console.log("--- agent raw output (truncated) ---");
  console.log(raw.slice(0, 2000));

  let normalized = await tryReadOutputFile(outputPath);
  if (normalized) {
    console.log(`Loaded triage from ${outputPath}`);
  } else {
    try {
      normalized = normalizeTriage(extractJson(raw));
      console.log("Parsed triage from agent text output");
    } catch (err) {
      console.error(`Failed to parse agent JSON: ${err.message}`);
      process.exit(2);
    }
  }

  let labels = normalized.labels;
  if (allowedLabels.length > 0) {
    const allowed = new Set(allowedLabels.map((l) => l.toLowerCase()));
    labels = labels.filter((l) => allowed.has(l.toLowerCase()));
  }

  const payload = {
    labels,
    diagnosis: normalized.diagnosis,
    marker: MARKER,
  };

  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outputPath} with labels: ${labels.join(", ") || "(none)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
