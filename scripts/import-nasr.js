const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const DATA_DIR = path.join(ROOT, "data");
const AIRPORT_DATA_DIR = path.join(ROOT, "airport-data");
const WAYPOINT_DATA_DIR = path.join(ROOT, "waypoint-data");
const AIRPORT_CHUNK_COUNT = 6;
const WAYPOINT_CHUNK_COUNT = 18;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function readCsv(fileName) {
  const text = fs.readFileSync(path.join(RAW_DIR, fileName), "utf8");
  const [headers, ...rows] = parseCsv(text);

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function compact(value) {
  return String(value ?? "").trim();
}

function compactJoin(parts, separator = ", ") {
  return parts.map(compact).filter(Boolean).join(separator);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dms(row, prefix) {
  const deg = compact(row[`${prefix}_DEG`]);
  const min = compact(row[`${prefix}_MIN`]);
  const sec = compact(row[`${prefix}_SEC`]);
  const hemis = compact(row[`${prefix}_HEMIS`]);
  return deg && min && sec && hemis ? `${deg} deg ${min}' ${sec}" ${hemis}` : "";
}

function titleCase(value) {
  return compact(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function baseRecord(fields) {
  return {
    id: fields.id,
    code: fields.code,
    name: fields.name || fields.code,
    entityType: fields.entityType,
    facilityType: fields.facilityType,
    location: fields.location || "Location unavailable",
    country: fields.country || "",
    state: fields.state || "",
    latitude: fields.latitude || "",
    longitude: fields.longitude || "",
    latDecimal: fields.latDecimal,
    lonDecimal: fields.lonDecimal,
    elevation: fields.elevation || "N/A",
    status: fields.status || "",
    frequency: fields.frequency || "",
    chartUse: fields.chartUse || "",
    alternateCodes: fields.alternateCodes || [],
    keywords: fields.keywords || []
  };
}

function airportRecord(row) {
  const code = compact(row.ICAO_ID) || compact(row.ARPT_ID);
  const alternateCodes = [row.ARPT_ID, row.ICAO_ID].map(compact).filter(Boolean);
  const city = titleCase(row.CITY);
  const state = compact(row.STATE_CODE);

  return baseRecord({
    id: `airport-${compact(row.SITE_NO) || code}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    code,
    name: titleCase(row.ARPT_NAME),
    entityType: "airport",
    facilityType: "Airport",
    location: compactJoin([city, state]),
    country: compact(row.COUNTRY_CODE),
    state,
    latitude: dms(row, "LAT"),
    longitude: dms(row, "LONG"),
    latDecimal: numberOrNull(row.LAT_DECIMAL),
    lonDecimal: numberOrNull(row.LONG_DECIMAL),
    elevation: compact(row.ELEV) ? `${compact(row.ELEV)} ft` : "N/A",
    status: compact(row.ARPT_STATUS),
    alternateCodes,
    keywords: [
      compact(row.ARPT_ID),
      compact(row.ICAO_ID),
      city,
      state,
      titleCase(row.COUNTY_NAME),
      titleCase(row.STATE_NAME),
      titleCase(row.CHART_NAME)
    ].filter(Boolean)
  });
}

function fixRecord(row, index) {
  const code = compact(row.FIX_ID);
  const state = compact(row.STATE_CODE);

  return baseRecord({
    id: `waypoint-${compact(row.COUNTRY_CODE)}-${compact(row.ICAO_REGION_CODE)}-${code}-${index}`.toLowerCase(),
    code,
    name: code,
    entityType: "waypoint",
    facilityType: "Fix / Reporting Point / Waypoint",
    location: compactJoin([state, compact(row.COUNTRY_CODE)]),
    country: compact(row.COUNTRY_CODE),
    state,
    latitude: dms(row, "LAT"),
    longitude: dms(row, "LONG"),
    latDecimal: numberOrNull(row.LAT_DECIMAL),
    lonDecimal: numberOrNull(row.LONG_DECIMAL),
    chartUse: compact(row.CHARTS),
    alternateCodes: [compact(row.FIX_ID_OLD)].filter(Boolean),
    keywords: [
      code,
      state,
      compact(row.COUNTRY_CODE),
      compact(row.ICAO_REGION_CODE),
      compact(row.FIX_USE_CODE),
      compact(row.CHARTS),
      compact(row.ARTCC_ID_HIGH),
      compact(row.ARTCC_ID_LOW),
      compact(row.CHARTING_REMARK)
    ].filter(Boolean)
  });
}

function navaidRecord(row, index) {
  const code = compact(row.NAV_ID);
  const city = titleCase(row.CITY);
  const state = compact(row.STATE_CODE);
  const type = compact(row.NAV_TYPE);

  return baseRecord({
    id: `navaid-${code}-${state}-${index}`.toLowerCase(),
    code,
    name: titleCase(row.NAME),
    entityType: "navaid",
    facilityType: type || "Navaid",
    location: compactJoin([city, state]),
    country: compact(row.COUNTRY_CODE),
    state,
    latitude: dms(row, "LAT"),
    longitude: dms(row, "LONG"),
    latDecimal: numberOrNull(row.LAT_DECIMAL),
    lonDecimal: numberOrNull(row.LONG_DECIMAL),
    elevation: compact(row.ELEV) ? `${compact(row.ELEV)} ft` : "N/A",
    status: compact(row.NAV_STATUS),
    frequency: compact(row.FREQ),
    keywords: [
      code,
      type,
      city,
      state,
      titleCase(row.NAME),
      compact(row.NAV_STATUS),
      compact(row.FREQ),
      compact(row.HIGH_ALT_ARTCC_ID),
      compact(row.LOW_ALT_ARTCC_ID)
    ].filter(Boolean)
  });
}

function writeCatalogFile(fileName, globalName, payload) {
  const outputPath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(outputPath, `window.${globalName} = ${JSON.stringify(payload)};\n`, "utf8");
  return outputPath;
}

function writeDataFolderFile(folderPath, fileName, globalName, payload) {
  fs.mkdirSync(folderPath, { recursive: true });
  const outputPath = path.join(folderPath, fileName);
  fs.writeFileSync(outputPath, `window.${globalName} = ${JSON.stringify(payload)};\n`, "utf8");
  return outputPath;
}

function writeAppendDataFolderFile(folderPath, fileName, globalName, payload) {
  fs.mkdirSync(folderPath, { recursive: true });
  const outputPath = path.join(folderPath, fileName);
  const json = JSON.stringify(payload);
  fs.writeFileSync(
    outputPath,
    `window.${globalName} = (window.${globalName} || []).concat(${json});\n`,
    "utf8"
  );
  return outputPath;
}

function writeChunkFile(folderPath, fileName, chunkId, payload) {
  fs.mkdirSync(folderPath, { recursive: true });
  const outputPath = path.join(folderPath, fileName);
  const json = JSON.stringify(payload);
  fs.writeFileSync(
    outputPath,
    `window.NASR_CHUNKS = window.NASR_CHUNKS || {};\nwindow.NASR_CHUNKS[${JSON.stringify(chunkId)}] = ${json};\n`,
    "utf8"
  );
  return outputPath;
}

function removeIfInsideRoot(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  const relativePath = path.relative(ROOT, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to remove path outside project root: ${resolvedPath}`);
  }

  if (fs.existsSync(resolvedPath)) {
    fs.rmSync(resolvedPath, { force: true });
  }
}

function removeStaleGeneratedOutputs() {
  const staleDataFilePattern = /^nasr-(?:catalog|airports(?:-\d+)?|waypoints(?:-\d+)?)\.js$/;

  if (fs.existsSync(DATA_DIR)) {
    fs.readdirSync(DATA_DIR)
      .filter((fileName) => staleDataFilePattern.test(fileName))
      .forEach((fileName) => removeIfInsideRoot(path.join(DATA_DIR, fileName)));
  }

  removeIfInsideRoot(path.join(WAYPOINT_DATA_DIR, "nasr-waypoints.js"));

  [AIRPORT_DATA_DIR, WAYPOINT_DATA_DIR].forEach((folderPath) => {
    if (!fs.existsSync(folderPath)) return;

    fs.readdirSync(folderPath)
      .filter((fileName) => /^nasr-(?:airports|waypoints)(?:-\d+)?\.js$/.test(fileName))
      .forEach((fileName) => removeIfInsideRoot(path.join(folderPath, fileName)));
  });
}

function chunkRecords(records, chunkCount) {
  const chunkSize = Math.ceil(records.length / chunkCount);
  const chunks = [];

  for (let index = 0; index < records.length; index += chunkSize) {
    chunks.push(records.slice(index, index + chunkSize));
  }

  return chunks;
}

function main() {
  const airports = readCsv("APT_BASE.csv").map(airportRecord).filter((record) => record.code);
  const waypoints = readCsv("FIX_BASE.csv").map(fixRecord).filter((record) => record.code);
  const navaids = readCsv("NAV_BASE.csv").map(navaidRecord).filter((record) => record.code);

  const meta = {
    source: "FAA NASR 28 Day Subscription",
    effectiveDate: "2024/12/26",
    generatedAt: new Date().toISOString(),
    counts: {
      airports: airports.length,
      waypoints: waypoints.length,
      navaids: navaids.length,
      total: airports.length + waypoints.length + navaids.length
    }
  };

  const airportChunks = chunkRecords(airports, AIRPORT_CHUNK_COUNT);
  const waypointChunks = chunkRecords(waypoints, WAYPOINT_CHUNK_COUNT);
  const manifest = {
    chunks: {
      airport: airportChunks.map((chunk, index) => ({
        id: `airport-${index + 1}`,
        file: `airport-data/nasr-airports-${index + 1}.js`,
        count: chunk.length
      })),
      waypoint: waypointChunks.map((chunk, index) => ({
        id: `waypoint-${index + 1}`,
        file: `waypoint-data/nasr-waypoints-${index + 1}.js`,
        count: chunk.length
      }))
    }
  };

  removeStaleGeneratedOutputs();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outputs = [
    writeCatalogFile("nasr-meta.js", "NASR_META", meta),
    writeCatalogFile("nasr-manifest.js", "NASR_MANIFEST", manifest),
    writeCatalogFile("nasr-navaids.js", "NASR_NAVAIDS", navaids),
    ...airportChunks.map((chunk, index) => (
      writeChunkFile(AIRPORT_DATA_DIR, `nasr-airports-${index + 1}.js`, `airport-${index + 1}`, chunk)
    )),
    ...waypointChunks.map((chunk, index) => (
      writeChunkFile(WAYPOINT_DATA_DIR, `nasr-waypoints-${index + 1}.js`, `waypoint-${index + 1}`, chunk)
    ))
  ];

  outputs.forEach((outputPath) => {
    console.log(`Wrote ${path.relative(ROOT, outputPath)}`);
  });
  console.log(JSON.stringify(meta.counts, null, 2));
}

main();
