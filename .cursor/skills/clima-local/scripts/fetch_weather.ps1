#Requires -Version 5.1
<#
.SYNOPSIS
  Obtiene clima actual (y opcionalmente pronóstico) vía Open-Meteo. Sin API key.

.PARAMETER Location
  Ciudad o lugar (ej. "Bogota", "Madrid"). Vacío = IP geolocalizada.

.PARAMETER Days
  Días de pronóstico diario (0-7). 0 = solo actual.

.PARAMETER Units
  metric | imperial

.PARAMETER Lang
  Código de idioma para textos (es, en, ...)
#>
param(
  [string]$Location = "",
  [ValidateRange(0, 7)]
  [int]$Days = 0,
  [ValidateSet("metric", "imperial")]
  [string]$Units = "metric",
  [string]$Lang = "es"
)

$ErrorActionPreference = "Stop"

function Get-ConfigPath {
  Join-Path (Split-Path $PSScriptRoot -Parent) "config.json"
}

function Read-Config {
  $path = Get-ConfigPath
  if (-not (Test-Path $path)) { return $null }
  Get-Content -Raw -Path $path | ConvertFrom-Json
}

function Invoke-JsonGet([string]$Url) {
  $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
  return ($resp.Content | ConvertFrom-Json)
}

$config = Read-Config
if (-not $Location -and $config -and $config.defaultLocation) {
  $Location = [string]$config.defaultLocation
}
if (-not $Location) {
  $Location = "La Estrella, Antioquia"
}
if ($config -and $config.units -and -not $PSBoundParameters.ContainsKey("Units")) {
  $Units = [string]$config.units
}
if ($config -and $config.lang -and -not $PSBoundParameters.ContainsKey("Lang")) {
  $Lang = [string]$config.lang
}

$tempUnit = if ($Units -eq "imperial") { "fahrenheit" } else { "celsius" }
$windUnit = if ($Units -eq "imperial") { "mph" } else { "kmh" }
$precipUnit = if ($Units -eq "imperial") { "inch" } else { "mm" }

# WMO weather codes (subset)
$codes = @{
  0 = "Despejado"
  1 = "Mayormente despejado"
  2 = "Parcialmente nublado"
  3 = "Nublado"
  45 = "Niebla"
  48 = "Niebla con escarcha"
  51 = "Llovizna ligera"
  53 = "Llovizna"
  55 = "Llovizna intensa"
  61 = "Lluvia ligera"
  63 = "Lluvia"
  65 = "Lluvia intensa"
  71 = "Nieve ligera"
  73 = "Nieve"
  75 = "Nieve intensa"
  80 = "Chubascos ligeros"
  81 = "Chubascos"
  82 = "Chubascos fuertes"
  95 = "Tormenta"
  96 = "Tormenta con granizo"
  99 = "Tormenta con granizo fuerte"
}

function Code-Text([int]$Code) {
  if ($codes.ContainsKey($Code)) { return $codes[$Code] }
  return "Código $Code"
}

# 1) Resolver coordenadas
$placeName = $null
$lat = $null
$lon = $null
$tz = "auto"

if ($Location) {
  $geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=$([uri]::EscapeDataString($Location))&count=1&language=$Lang&format=json"
  $geo = Invoke-JsonGet $geoUrl
  if (-not $geo.results -or $geo.results.Count -eq 0) {
    Write-Error "No se encontró la ubicación: $Location"
  }
  $r = $geo.results[0]
  $lat = $r.latitude
  $lon = $r.longitude
  $placeName = @($r.name, $r.admin1, $r.country) -join ", "
  if ($r.timezone) { $tz = $r.timezone }
} else {
  # IP approx (sin key). Si falla, error claro.
  try {
    $ip = Invoke-JsonGet "https://ipapi.co/json/"
    if ($ip.latitude -and $ip.longitude) {
      $lat = $ip.latitude
      $lon = $ip.longitude
      $placeName = @($ip.city, $ip.region, $ip.country_name) -join ", "
      if ($ip.timezone) { $tz = $ip.timezone }
    }
  } catch {
    Write-Error "No se pudo geolocalizar por IP. Pasa -Location 'Ciudad' o define defaultLocation en config.json"
  }
  if (-not $lat) {
    Write-Error "No se pudo geolocalizar por IP. Pasa -Location 'Ciudad' o define defaultLocation en config.json"
  }
}

# 2) Clima
$forecastParams = @(
  "latitude=$lat",
  "longitude=$lon",
  "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
  "temperature_unit=$tempUnit",
  "wind_speed_unit=$windUnit",
  "precipitation_unit=$precipUnit",
  "timezone=$([uri]::EscapeDataString($tz))",
  "forecast_days=$([Math]::Max(1, $Days))"
)
if ($Days -gt 0) {
  $forecastParams += "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
}

$wxUrl = "https://api.open-meteo.com/v1/forecast?" + ($forecastParams -join "&")
$wx = Invoke-JsonGet $wxUrl
$cur = $wx.current
$code = [int]$cur.weather_code

$result = [ordered]@{
  location   = $placeName
  latitude   = $lat
  longitude  = $lon
  timezone   = $wx.timezone
  units      = $Units
  current    = [ordered]@{
    time                 = $cur.time
    temperature          = $cur.temperature_2m
    feels_like           = $cur.apparent_temperature
    humidity_percent     = $cur.relative_humidity_2m
    wind_speed           = $cur.wind_speed_10m
    precipitation        = $cur.precipitation
    weather_code         = $code
    condition            = (Code-Text $code)
  }
}

if ($Days -gt 0 -and $wx.daily) {
  $daily = @()
  for ($i = 0; $i -lt [Math]::Min($Days, $wx.daily.time.Count); $i++) {
    $daily += [ordered]@{
      date            = $wx.daily.time[$i]
      condition       = (Code-Text ([int]$wx.daily.weather_code[$i]))
      temp_max        = $wx.daily.temperature_2m_max[$i]
      temp_min        = $wx.daily.temperature_2m_min[$i]
      precipitation   = $wx.daily.precipitation_sum[$i]
    }
  }
  $result.forecast = $daily
}

$result | ConvertTo-Json -Depth 6
