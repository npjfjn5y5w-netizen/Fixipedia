const demoRecords = [
  {
    id: "demo-airport-kord",
    code: "KORD",
    name: "O'Hare International Airport",
    entityType: "airport",
    facilityType: "Airport",
    location: "Chicago, Illinois",
    country: "US",
    state: "IL",
    latitude: "41 deg 58' 42.97\" N",
    longitude: "87 deg 54' 17.43\" W",
    latDecimal: 41.978603,
    lonDecimal: -87.904842,
    elevation: "672 ft",
    status: "O",
    frequency: "",
    chartUse: "",
    alternateCodes: ["ORD", "KORD"],
    namedAfter: "Edward H. O'Hare, a U.S. Navy aviator and Medal of Honor recipient.",
    confidence: "confirmed",
    archiveNote: "OpenNav-style airport records answer where the facility is. Fixipedia adds why the name exists and how strong the evidence is.",
    evidence: ["Airport public history identifies the O'Hare namesake."],
    nearby: ["BAWLL", "ACCRA", "ORD", "MDW"],
    sources: ["Airport website", "FAA chart products"],
    openQuestions: "Add a primary city or airport authority source quote for the renaming history.",
    keywords: ["ord", "ohare", "chicago", "illinois", "airport", "edward ohare"]
  }
];

const researchNotes = window.FIXIPEDIA_NOTES ?? {};
const dataManifest = window.NASR_MANIFEST?.chunks ?? {};
const basePath = window.FIXIPEDIA_BASE_PATH || "/";

const catalog = {
  ...(window.NASR_META ?? {
    source: "Demo records",
    effectiveDate: "",
    counts: { total: demoRecords.length, airports: 1, waypoints: 0, navaids: 0 }
  }),
  records: [
    ...(window.NASR_AIRPORTS ?? []),
    ...(window.NASR_WAYPOINTS ?? []),
    ...(window.NASR_NAVAIDS ?? [])
  ]
};

if (window.NASR_CATALOG && !window.NASR_META) {
  catalog.source = window.NASR_CATALOG.source;
  catalog.effectiveDate = window.NASR_CATALOG.effectiveDate;
  catalog.counts = window.NASR_CATALOG.counts;
  catalog.records = window.NASR_CATALOG.records;
}

if (!catalog.records.length) {
  catalog.records = demoRecords;
  catalog.counts = { total: demoRecords.length, airports: 1, waypoints: 0, navaids: 0 };
}

function withResearchDefaults(record) {
  const note = researchNotes[record.code] ?? {};

  return {
    namedAfter: "Unknown. This record needs Fixipedia naming research.",
    confidence: "unverified",
    archiveNote: "Imported from FAA NASR location data.",
    evidence: ["FAA NASR 28 Day Subscription effective 2024/12/26."],
    nearby: [],
    sources: ["FAA NASR"],
    openQuestions: "Find reliable sources explaining what this identifier or facility name is named after.",
    ...record,
    ...note
  };
}

let records = catalog.records.map(withResearchDefaults);
const loadedChunkIds = new Set();
const chunkLoadPromises = new Map();
const entityLoadPromises = new Map();
const loadingEntities = new Set();
const entityLoaded = {
  airport: Boolean(window.NASR_AIRPORTS?.length) || !dataManifest.airport?.length,
  waypoint: Boolean(window.NASR_WAYPOINTS?.length) || !dataManifest.waypoint?.length,
  navaid: true
};
let dataLoadMessage = "";
let searchLoadRequest = 0;

const resultsList = document.querySelector("#resultsList");
const detailPanel = document.querySelector("#detailPanel");
const searchInput = document.querySelector("#searchInput");
const resultCount = document.querySelector("#resultCount");
const filterButtons = Array.from(document.querySelectorAll(".filter-button"));
const archiveMeta = document.querySelector(".archive-meta span:last-child");
const submissionForm = document.querySelector("#submissionForm");
const submissionStatus = document.querySelector("#submissionStatus");
const recentResearchList = document.querySelector("#recentResearchList");
const catalogTotal = document.querySelector("#catalogTotal");
const airportCount = document.querySelector("#airportCount");
const waypointCount = document.querySelector("#waypointCount");
const navaidCount = document.querySelector("#navaidCount");
const mobileMedia = window.matchMedia("(max-width: 720px)");

let activeFilter = "all";
let selectedId = null;
let visibleLimit = 5;
let nearbyLoadPromise = null;
let mobileMode = "search";

const routeEntities = new Set(["airport", "waypoint", "navaid"]);
const pageRoutes = new Set(["thank-you"]);

function getAssetPath(source) {
  if (/^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith("/")) return source;
  return `${basePath}${source}`;
}

function getAppPath(path) {
  const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `${prefix}${path}`;
}

function stripBasePathParts(parts) {
  const baseParts = basePath.split("/").filter(Boolean);
  if (!baseParts.length) return parts;
  return parts.slice(0, baseParts.length).join("/") === baseParts.join("/")
    ? parts.slice(baseParts.length)
    : parts;
}

function isHomePath(pathname) {
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalizedPath === basePath || pathname === "/index.html";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function hasSearchQuery() {
  return Boolean(normalize(searchInput.value));
}

function isMobileLayout() {
  return mobileMedia.matches;
}

function titleCase(value) {
  const text = String(value ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getRoutePath(record) {
  if (!record) return "/";

  const entity = record.entityType;
  const code = encodeURIComponent(record.code);
  const country = encodeURIComponent(record.country || "US");

  if (entity === "airport") return getAppPath(`/airport/${code}`);
  if (entity === "waypoint") return getAppPath(`/waypoint/${country}/${code}`);
  if (entity === "navaid") return getAppPath(`/navaid/${country}/${code}`);
  return basePath;
}

function getRouteHref(record) {
  return getRoutePath(record);
}

function parseRoute() {
  const hashPath = window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : "";
  const path = hashPath || window.location.pathname;
  const parts = stripBasePathParts(path.split("/").filter(Boolean).map(decodeURIComponent));

  if (!parts.length) return null;
  if (pageRoutes.has(parts[0])) return { entity: parts[0] };
  if (!routeEntities.has(parts[0])) return null;

  const entity = parts[0];
  if (entity === "airport") {
    const code = parts.length >= 3 ? parts[2] : parts[1];
    const country = parts.length >= 3 ? parts[1] : "";
    return code ? { entity, country: country.toUpperCase(), code: code.toUpperCase() } : null;
  }

  const country = parts[1];
  const code = parts[2];
  return country && code
    ? { entity, country: country.toUpperCase(), code: code.toUpperCase() }
    : null;
}

function findRecordByRoute(route) {
  if (!route) return null;

  const matches = records.filter((record) => (
    record.entityType === route.entity &&
    record.code?.toUpperCase() === route.code
  ));

  return matches.find((record) => record.country?.toUpperCase() === route.country) ?? matches[0] ?? null;
}

function pushRecordRoute(record) {
  const path = getRoutePath(record);
  if (window.location.pathname === path && !window.location.hash) return;
  history.pushState({ recordId: record.id }, "", path);
}

function setSelectedRecord(record, options = {}) {
  if (!record) return;

  selectedId = record.id;
  if (isMobileLayout()) {
    mobileMode = "detail";
  }
  if (options.syncSearch) {
    searchInput.value = record.code;
    activeFilter = "all";
    filterButtons.forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton.dataset.filter === "all");
    });
  }
  if (options.pushRoute) pushRecordRoute(record);
  renderResults();
}

function getSearchBlob(record) {
  return [
    record.code,
    record.name,
    record.entityType,
    record.facilityType,
    record.location,
    record.country,
    record.state,
    record.status,
    record.frequency,
    record.chartUse,
    record.confidence,
    record.namedAfter,
    record.archiveNote,
    record.openQuestions,
    ...(record.alternateCodes ?? []),
    ...(record.nearby ?? []),
    ...(record.sources ?? []),
    ...(record.keywords ?? [])
  ].join(" ");
}

function normalizeIdentifier(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function getSearchScore(record, query) {
  const normalizedQuery = normalizeIdentifier(query);
  const code = normalizeIdentifier(record.code);
  const alternateCodes = (record.alternateCodes ?? []).map(normalizeIdentifier);
  const name = normalize(record.name);
  const location = normalize(record.location);
  const keywords = normalize((record.keywords ?? []).join(" "));
  const blob = normalize(getSearchBlob(record));
  let score = 0;

  if (code === normalizedQuery) score += 120;
  if (alternateCodes.includes(normalizedQuery)) score += 135;
  if (record.entityType === "airport" && alternateCodes.includes(normalizedQuery)) score += 45;
  if (code.startsWith(normalizedQuery)) score += 80;
  if (alternateCodes.some((alternateCode) => alternateCode.startsWith(normalizedQuery))) score += 75;
  if (name.includes(query)) score += 35;
  if (location.includes(query)) score += 25;
  if (keywords.includes(query)) score += 12;
  if (query.length >= 4 && blob.includes(query)) score += 5;

  if (score > 0 && record.entityType === "airport") score += 8;
  if (score > 0 && record.entityType === "navaid") score += 4;

  return score;
}

function getFilteredRecords() {
  const query = normalize(searchInput.value);

  if (!query) return [];

  return records
    .map((record, index) => ({ record, index, score: getSearchScore(record, query) }))
    .filter(({ record, score }) => {
      const matchesFilter = activeFilter === "all" || record.entityType === activeFilter;
      return matchesFilter && score > 0;
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ record }) => record);
}

function getLoadedCatalogCount() {
  return records.filter((record) => record.id && !record.id.startsWith("demo-")).length;
}

function isCatalogFullyLoaded() {
  return entityLoaded.airport && entityLoaded.waypoint && entityLoaded.navaid;
}

function updateArchiveMeta() {
  if (!archiveMeta) return;

  const total = catalog.counts.total ?? records.length;
  const loaded = getLoadedCatalogCount();
  const loadText = isCatalogFullyLoaded()
    ? `${total.toLocaleString()} records`
    : `${loaded.toLocaleString()} of ${total.toLocaleString()} records loaded`;

  archiveMeta.textContent = `${catalog.source} / ${catalog.effectiveDate} / ${loadText}`;
}

function renderCatalogSummary() {
  const counts = catalog.counts ?? {};

  if (catalogTotal) catalogTotal.textContent = (counts.total ?? 0).toLocaleString();
  if (airportCount) airportCount.textContent = (counts.airports ?? 0).toLocaleString();
  if (waypointCount) waypointCount.textContent = (counts.waypoints ?? 0).toLocaleString();
  if (navaidCount) navaidCount.textContent = (counts.navaids ?? 0).toLocaleString();
}

function setThankYouMode(isActive) {
  document.body.classList.toggle("thank-you-mode", isActive);
  if (isActive) {
    document.title = "Thank you | Fixipedia";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderResults() {
  if (parseRoute()?.entity === "thank-you") {
    setThankYouMode(true);
    return;
  }

  setThankYouMode(false);
  document.body.classList.toggle("mobile-search-mode", isMobileLayout() && mobileMode === "search");
  document.body.classList.toggle("mobile-detail-mode", isMobileLayout() && mobileMode === "detail");

  if (!hasSearchQuery()) {
    selectedId = null;
    mobileMode = "search";
    document.body.classList.toggle("mobile-search-mode", isMobileLayout());
    document.body.classList.toggle("mobile-detail-mode", false);
    resultCount.textContent = dataLoadMessage || "Start typing to search the catalog";
    resultsList.innerHTML = "";
    updateArchiveMeta();
    renderDetail();
    return;
  }

  const filtered = getFilteredRecords();
  const visible = filtered.slice(0, visibleLimit);
  const limitedText = filtered.length > visible.length ? `, showing first ${visible.length}` : "";
  const loadingText = dataLoadMessage ? ` / ${dataLoadMessage}` : "";
  resultCount.textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "record" : "records"}${limitedText}${loadingText}`;

  if (!filtered.some((record) => record.id === selectedId)) {
    selectedId = filtered[0]?.id ?? null;
  }

  resultsList.innerHTML = visible.map((record) => `
    <a class="result-card ${record.id === selectedId ? "selected" : ""}" href="${getRouteHref(record)}" data-id="${record.id}">
      <span class="result-topline">
        <span class="code">${escapeHtml(record.code)}</span>
        <span class="tag type-${record.entityType}">${escapeHtml(titleCase(record.entityType))}</span>
      </span>
      <p>${escapeHtml(record.name)} / ${escapeHtml(record.location)}</p>
      <span class="result-meta">
        <span>${escapeHtml(record.facilityType)}</span>
        ${record.frequency ? `<span aria-hidden="true">/</span><span>${escapeHtml(record.frequency)}</span>` : ""}
        <span aria-hidden="true">/</span>
        <span>${escapeHtml(titleCase(record.confidence))} namesake</span>
      </span>
    </a>
  `).join("");

  if (!filtered.length) {
    resultsList.innerHTML = `
      <div class="result-card">
        <span class="code">No matches</span>
        <p>Try an airport, waypoint, navaid, city, identifier, namesake, frequency, ARTCC, or source keyword.</p>
      </div>
    `;
  }

  updateArchiveMeta();
  renderDetail();
}

function addCatalogRecords(newRecords) {
  const existingIds = new Set(records.map((record) => record.id));
  const preparedRecords = newRecords
    .filter((record) => record.id && !existingIds.has(record.id))
    .map(withResearchDefaults);

  if (preparedRecords.length) {
    records = records.concat(preparedRecords);
  }
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = getAssetPath(source);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${source}`));
    document.head.appendChild(script);
  });
}

async function loadChunk(chunk) {
  if (!chunk || loadedChunkIds.has(chunk.id)) return;
  if (chunkLoadPromises.has(chunk.id)) return chunkLoadPromises.get(chunk.id);

  const loadPromise = (async () => {
    await loadScript(chunk.file);
    const chunkRecords = window.NASR_CHUNKS?.[chunk.id] ?? [];
    addCatalogRecords(chunkRecords);
    loadedChunkIds.add(chunk.id);
  })();

  chunkLoadPromises.set(chunk.id, loadPromise);
  return loadPromise;
}

async function loadEntity(entity) {
  if (entityLoaded[entity]) return;
  if (entityLoadPromises.has(entity)) return entityLoadPromises.get(entity);

  const loadPromise = (async () => {
    const chunks = dataManifest[entity] ?? [];
    if (!chunks.length) {
      entityLoaded[entity] = true;
      return;
    }

    loadingEntities.add(entity);
    dataLoadMessage = `loading ${Array.from(loadingEntities).join(" and ")} data`;
    renderResults();

    try {
      for (const chunk of chunks) {
        await loadChunk(chunk);
      }
      entityLoaded[entity] = true;
    } catch (error) {
      dataLoadMessage = `could not load ${entity} data`;
      entityLoadPromises.delete(entity);
      throw error;
    } finally {
      loadingEntities.delete(entity);
      dataLoadMessage = loadingEntities.size
        ? `loading ${Array.from(loadingEntities).join(" and ")} data`
        : "";
      renderResults();
    }
  })();

  entityLoadPromises.set(entity, loadPromise);
  return loadPromise;
}

function getNeededEntities() {
  const query = normalize(searchInput.value);

  if (activeFilter === "airport") return ["airport"];
  if (activeFilter === "waypoint") return ["waypoint"];
  if (activeFilter === "navaid") return [];
  if (query.length >= 2) return ["airport", "waypoint"];
  return [];
}

async function loadNeededData() {
  const requestId = ++searchLoadRequest;
  const neededEntities = getNeededEntities().filter((entity) => !entityLoaded[entity]);

  if (!neededEntities.length) return;

  dataLoadMessage = `loading ${neededEntities.join(" and ")} data`;
  renderResults();
  await Promise.all(neededEntities.map(loadEntity));

  if (requestId === searchLoadRequest) {
    dataLoadMessage = "";
    renderResults();
  }
}

async function loadAllCatalogData() {
  await Promise.all(["airport", "waypoint"].map(loadEntity));
}

function getDistanceNm(origin, target) {
  if (!Number.isFinite(origin.latDecimal) || !Number.isFinite(origin.lonDecimal)) return Infinity;
  if (!Number.isFinite(target.latDecimal) || !Number.isFinite(target.lonDecimal)) return Infinity;

  const radiusNm = 3440.065;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const lat1 = toRadians(origin.latDecimal);
  const lat2 = toRadians(target.latDecimal);
  const deltaLat = toRadians(target.latDecimal - origin.latDecimal);
  const deltaLon = toRadians(target.lonDecimal - origin.lonDecimal);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * radiusNm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyRecords(record, entityType, limit = 12) {
  return records
    .filter((entry) => entry.id !== record.id && entry.entityType === entityType)
    .map((entry) => ({ record: entry, distance: getDistanceNm(record, entry) }))
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function renderNearbySection(record, entityType, heading) {
  const nearby = getNearbyRecords(record, entityType, entityType === "waypoint" ? 48 : 12);
  const isLoading = !isCatalogFullyLoaded();

  if (!nearby.length && isLoading) {
    return `
      <section class="detail-section nearby-section">
        <h3>${escapeHtml(heading)}</h3>
        <p>Loading nearby ${escapeHtml(entityType)} records...</p>
      </section>
    `;
  }

  if (!nearby.length) {
    return `
      <section class="detail-section nearby-section">
        <h3>${escapeHtml(heading)}</h3>
        <p>No nearby ${escapeHtml(entityType)} records found in the loaded catalog.</p>
      </section>
    `;
  }

  return `
    <section class="detail-section nearby-section">
      <h3>${escapeHtml(heading)}</h3>
      <div class="nearby-list">
        ${nearby.map(({ record: nearbyRecord, distance }) => `
          <a href="${getRouteHref(nearbyRecord)}" data-id="${nearbyRecord.id}">
            <strong>${escapeHtml(nearbyRecord.code)}</strong>
            <span>${escapeHtml(nearbyRecord.location || nearbyRecord.name || nearbyRecord.country || "")}</span>
            <small>${Math.round(distance).toLocaleString()} NM</small>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function ensureNearbyData(record) {
  if (!record || !Number.isFinite(record.latDecimal) || !Number.isFinite(record.lonDecimal)) return;
  if (!parseRoute()) return;
  if (isCatalogFullyLoaded() || nearbyLoadPromise) return;

  nearbyLoadPromise = loadAllCatalogData()
    .catch(() => {
      dataLoadMessage = "nearby catalog load failed";
    })
    .finally(() => {
      nearbyLoadPromise = null;
      renderResults();
    });
}

function renderDetail() {
  const record = records.find((entry) => entry.id === selectedId);

  if (!record) {
    detailPanel.innerHTML = `
      <div class="detail-body">
        <div class="detail-section">
          <h3>No record selected</h3>
          <p>Adjust your search to select a catalog record.</p>
        </div>
      </div>
    `;
    return;
  }

  document.title = `${record.code} ${record.entityType} | Fixipedia`;
  ensureNearbyData(record);

  detailPanel.innerHTML = `
    <div class="detail-hero detail-${record.entityType}">
      <div class="detail-topline">
        <span>${escapeHtml(record.facilityType)}</span>
        <span class="tag ${record.confidence}">${escapeHtml(titleCase(record.confidence))}</span>
      </div>
      <div class="detail-code">${escapeHtml(record.code)}</div>
      <p class="detail-subtitle">${escapeHtml(record.name)} / ${escapeHtml(record.location)}</p>
    </div>
    <div class="detail-body">
      <div class="detail-actions">
        <a class="secondary-button" href="#archive" data-back-to-results>Back to search</a>
        <a class="primary-button" href="#submit" data-use-record="${record.id}">Submit origin</a>
      </div>

      <section class="detail-section callout-section">
        <h3>Named After</h3>
        <p>${escapeHtml(record.namedAfter)}</p>
      </section>

      <div class="fact-grid catalog-facts">
        <div class="fact">
          <span>Type</span>
          <strong>${escapeHtml(titleCase(record.entityType))}</strong>
        </div>
        <div class="fact">
          <span>Country</span>
          <strong>${escapeHtml(record.country || "N/A")}</strong>
        </div>
        <div class="fact">
          <span>Latitude</span>
          <strong>${escapeHtml(record.latitude || "N/A")}</strong>
        </div>
        <div class="fact">
          <span>Longitude</span>
          <strong>${escapeHtml(record.longitude || "N/A")}</strong>
        </div>
        <div class="fact">
          <span>Elevation / Frequency</span>
          <strong>${escapeHtml(record.frequency || record.elevation || "N/A")}</strong>
        </div>
        <div class="fact">
          <span>Chart Use</span>
          <strong>${escapeHtml(record.chartUse || "N/A")}</strong>
        </div>
      </div>

      <section class="detail-section">
        <h3>Fixipedia Note</h3>
        <p>${escapeHtml(record.archiveNote)}</p>
      </section>

      <section class="detail-section">
        <h3>Catalog Identifiers</h3>
        <div class="related-list">
          <span>${escapeHtml(record.code)}</span>
          ${(record.alternateCodes ?? []).filter((item) => item !== record.code).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </section>

      <section class="detail-section split-section">
        <div>
          <h3>Source Leads</h3>
          <ul>
            ${(record.sources ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
        <div>
          <h3>Other sources</h3>
          <p>${escapeHtml(record.openQuestions)}</p>
        </div>
      </section>

      <section class="detail-section">
        <h3>Other Ways To Find This Page</h3>
        <div class="related-list">
          <span>${escapeHtml(getRoutePath(record))}</span>
          <span>${escapeHtml(`${record.entityType} ${record.code}`)}</span>
          <span>${escapeHtml(`${record.code} ${record.country || ""}`.trim())}</span>
        </div>
      </section>

      ${renderNearbySection(record, "waypoint", `Waypoints near ${record.code}`)}
      ${renderNearbySection(record, "airport", `Airports near ${record.code}`)}
      ${renderNearbySection(record, "navaid", `Navaids near ${record.code}`)}
    </div>
  `;

  renderRecentResearch();
}

function renderRecentResearch() {
  if (!recentResearchList) return;

  const researchedCodes = new Set([
    ...Object.keys(researchNotes)
  ]);

  const researched = records
    .filter((record) => researchedCodes.has(record.code) && record.confidence !== "unverified")
    .filter((record, index, list) => list.findIndex((item) => item.code === record.code) === index)
    .slice(0, 6);

  recentResearchList.innerHTML = researched.length
    ? researched.map((record) => `
      <button type="button" data-id="${record.id}">
        <strong>${record.code}</strong>
        <span>${titleCase(record.confidence)}</span>
      </button>
    `).join("")
    : "<p>No researched names yet. Submit the first one.</p>";
}

resultsList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  event.preventDefault();

  const record = records.find((entry) => entry.id === card.dataset.id);
  setSelectedRecord(record, { pushRoute: true });
  if (isMobileLayout()) {
    searchInput.blur();
    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

detailPanel.addEventListener("click", (event) => {
  const backToResultsAction = event.target.closest("[data-back-to-results]");
  if (backToResultsAction && isMobileLayout()) {
    event.preventDefault();
    mobileMode = "search";
    renderResults();
    document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
    searchInput.focus({ preventScroll: true });
    return;
  }

  const useRecordAction = event.target.closest("[data-use-record]");
  if (useRecordAction) {
    const record = records.find((entry) => entry.id === useRecordAction.dataset.useRecord);
    fillSubmissionForm(record);
    submissionStatus.textContent = record ? `Selected ${record.code} for submission.` : "";
    return;
  }

  const linkedRecord = event.target.closest("[data-id]");
  if (!linkedRecord) return;

  const record = records.find((entry) => entry.id === linkedRecord.dataset.id);
  if (!record) return;

  event.preventDefault();
  setSelectedRecord(record, { pushRoute: true, syncSearch: true });
  document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

recentResearchList?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-id]");
  if (!item) return;
  event.preventDefault();

  const record = records.find((entry) => entry.id === item.dataset.id);
  setSelectedRecord(record, { pushRoute: true, syncSearch: true });
  document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

searchInput.addEventListener("input", () => {
  visibleLimit = 5;
  mobileMode = "search";
  renderResults();
  loadNeededData().catch(() => {
    dataLoadMessage = "catalog load failed";
    renderResults();
  });
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    visibleLimit = 5;
    mobileMode = "search";

    filterButtons.forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });

    renderResults();
    loadNeededData().catch(() => {
      dataLoadMessage = "catalog load failed";
      renderResults();
    });
  });
});

async function openRouteFromLocation(options = {}) {
  const route = parseRoute();
  if (route?.entity === "thank-you") {
    setThankYouMode(true);
    return;
  }

  setThankYouMode(false);
  if (!route) {
    if (!isHomePath(window.location.pathname)) {
      detailPanel.innerHTML = `
        <div class="detail-body">
          <div class="detail-section">
            <h3>Page not found</h3>
            <p>No Fixipedia record route matched this address. Use search to find the catalog record.</p>
          </div>
        </div>
      `;
    }
    return;
  }

  activeFilter = route.entity;
  searchInput.value = route.code;
  filterButtons.forEach((filterButton) => {
    filterButton.classList.toggle("active", filterButton.dataset.filter === route.entity);
  });

  dataLoadMessage = `loading ${route.entity} data`;
  renderResults();

  try {
    await loadEntity(route.entity);
    const record = findRecordByRoute(route);

    if (!record) {
      dataLoadMessage = "";
      resultCount.textContent = `No ${route.entity} record found for ${route.code}`;
      detailPanel.innerHTML = `
        <div class="detail-body">
          <div class="detail-section">
            <h3>No record found</h3>
            <p>Fixipedia could not find ${escapeHtml(route.code)} in the loaded ${escapeHtml(route.entity)} catalog.</p>
          </div>
        </div>
      `;
      return;
    }

    dataLoadMessage = "";
    setSelectedRecord(record, { pushRoute: false });
    if (options.scroll) document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    dataLoadMessage = "catalog load failed";
    renderResults();
  }
}

window.addEventListener("popstate", () => {
  openRouteFromLocation({ scroll: true });
});

function handleMobileLayoutChange() {
  if (!isMobileLayout()) {
    mobileMode = "search";
  }
  renderResults();
}

if (mobileMedia.addEventListener) {
  mobileMedia.addEventListener("change", handleMobileLayoutChange);
} else {
  mobileMedia.addListener(handleMobileLayoutChange);
}

function fillSubmissionForm(record) {
  if (!submissionForm || !record) return;

  submissionForm.elements.airport.value = record.entityType === "airport"
    ? `${record.code} - ${record.name}`
    : record.location || record.name || "";
  submissionForm.elements.procedure.value = record.chartUse || record.facilityType || "";
  submissionForm.elements.fixName.value = record.code;
  submissionForm.elements.originStory.value = record.namedAfter?.startsWith("Unknown.") ? "" : record.namedAfter;
  submissionForm.elements.notes.value = record.openQuestions ?? "";
}

function getSelectedRecord() {
  return records.find((record) => record.id === selectedId);
}

function findSubmissionRecord(submission) {
  const fixName = normalize(submission.fixName).toUpperCase();
  const airport = normalize(submission.airport).toUpperCase();
  const selectedRecord = getSelectedRecord();

  if (selectedRecord?.code?.toUpperCase() === fixName) return selectedRecord;

  return records.find((record) => (
    record.code?.toUpperCase() === fixName ||
    record.alternateCodes?.some((code) => code.toUpperCase() === fixName) ||
    (airport && `${record.code} ${record.name} ${record.location}`.toUpperCase().includes(airport))
  )) ?? selectedRecord ?? null;
}

function renderRecordContext(record) {
  if (!record) return "No matching catalog record was selected or found in the loaded catalog.";

  return [
    `- Identifier: ${record.code}`,
    `- Name: ${record.name}`,
    `- Type: ${record.facilityType}`,
    `- Location: ${record.location}`,
    `- Country: ${record.country || "N/A"}`,
    `- State: ${record.state || "N/A"}`,
    `- Latitude: ${record.latitude || "N/A"}`,
    `- Longitude: ${record.longitude || "N/A"}`
  ].join("\n");
}

function applySubmissionCatalogContext(record) {
  if (!submissionForm) return;

  submissionForm.elements.catalogIdentifier.value = record?.code || "";
  submissionForm.elements.catalogName.value = record?.name || "";
  submissionForm.elements.catalogType.value = record?.facilityType || record?.entityType || "";
  submissionForm.elements.catalogLocation.value = record?.location || "";
  submissionForm.elements.catalogContext.value = renderRecordContext(record);
}

submissionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(submissionForm);
  const submission = {
    airport: String(formData.get("airport") ?? "").trim(),
    procedure: String(formData.get("procedure") ?? "").trim(),
    fixName: String(formData.get("fixName") ?? "").trim().toUpperCase(),
    originStory: String(formData.get("originStory") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim()
  };

  if (!submission.fixName) {
    submissionStatus.textContent = "Add the waypoint/fix name.";
    return;
  }

  if (!submission.originStory) {
    submissionStatus.textContent = "Add the origin story.";
    return;
  }

  submissionForm.elements.fixName.value = submission.fixName;
  const matchingRecord = findSubmissionRecord(submission);
  applySubmissionCatalogContext(matchingRecord);

  submissionStatus.textContent = "Submitting...";

  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(submissionForm)).toString()
    });

    if (!response.ok) throw new Error(`Submission failed with ${response.status}`);

    submissionForm.reset();
    applySubmissionCatalogContext(null);
    history.pushState({}, "", getAppPath("/thank-you"));
    setThankYouMode(true);
  } catch (error) {
    submissionStatus.textContent = "Submission failed. Please try again in a moment.";
  }
});

renderCatalogSummary();
document.querySelectorAll("[data-asset-path]").forEach((element) => {
  element.setAttribute("src", getAssetPath(element.dataset.assetPath));
});
document.querySelectorAll(".brand").forEach((element) => {
  element.setAttribute("href", basePath);
});
document.querySelectorAll(".topbar .nav-links a[href^='#']").forEach((element) => {
  element.setAttribute("href", `${basePath}${element.getAttribute("href")}`);
});
document.querySelectorAll("[data-home-anchor]").forEach((element) => {
  element.setAttribute("href", `${basePath}#${element.dataset.homeAnchor}`);
});
renderResults();
openRouteFromLocation();
