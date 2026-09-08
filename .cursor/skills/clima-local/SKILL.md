---
name: clima-local
description: >-
  Obtiene el clima actual y un pronóstico corto para La Estrella, Antioquia
  (ubicación fija del proyecto) usando Open-Meteo (sin API key). Usar cuando el
  usuario pida clima, tiempo, temperatura, pronóstico, weather, o mencione este
  skill (clima-local).
---

# Clima local

Skill de proyecto para consultar el clima **sin API key**, con ubicación por defecto del repo o geolocalización por IP.

## Cuándo aplicar

- El usuario pregunta por clima / tiempo / temperatura / pronóstico / weather.
- El usuario menciona `clima-local` o pide “el clima local”.

## Configuración

Archivo: [config.json](config.json)

```json
{
  "defaultLocation": "La Estrella, Antioquia",
  "units": "metric",
  "lang": "es"
}
```

Ubicación fija del proyecto: **La Estrella, Antioquia**. El script y el agente deben usarla por defecto (sin IP), salvo que el usuario pida otra ciudad.

| Campo | Uso |
|-------|-----|
| `defaultLocation` | Siempre `La Estrella, Antioquia` en este repo |
| `units` | `metric` (°C, km/h, mm) o `imperial` (°F, mph, inch) |
| `lang` | Idioma del geocoding (`es`, `en`, …) |

## Cómo obtener el clima

Ejecuta el script del skill (no inventes datos; siempre llama a la API):

Sin argumentos (usa La Estrella, Antioquia desde `config.json`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/clima-local/scripts/fetch_weather.ps1"
```

Equivalente explícito:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/clima-local/scripts/fetch_weather.ps1" -Location "La Estrella, Antioquia"
```

Con pronóstico (1–7 días):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/clima-local/scripts/fetch_weather.ps1" -Days 3
```

Unidades imperiales:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".cursor/skills/clima-local/scripts/fetch_weather.ps1" -Units imperial
```

El script imprime **JSON** en stdout.

## Cómo responder al usuario

1. Corre el script desde la raíz del repo.
2. Resume en español, claro y breve:
   - Lugar
   - Condición
   - Temperatura (y sensación térmica si aporta)
   - Humedad / viento si es útil
   - Pronóstico solo si pidió varios días o pasaste `-Days`
3. Si falla la red o la ubicación: di el error real. Reintenta con `-Location "La Estrella, Antioquia"`.

No inventes temperaturas. No uses APIs que pidan API key salvo que el usuario lo pida. Por defecto siempre La Estrella, Antioquia (no geolocalizar por IP en este proyecto).

## Fuente

- Geocoding: `https://geocoding-api.open-meteo.com`
- Forecast: `https://api.open-meteo.com`
- Fallback IP: no usar en este proyecto (ubicación fija en `config.json`)
