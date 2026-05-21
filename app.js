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

const GITHUB_ISSUE_URL = "https://github.com/npjfjn5y5w-netizen/fixopedia/issues/new";

const researchNotes = window.FIXIPEDIA_NOTES ?? {};
const dataManifest = window.NASR_MANIFEST?.chunks ?? {};

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
    archiveNote: "Imported from FAA NASR location data. Add a Fixipedia note to document the name origin.",
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
const useSelectedRecordButton = document.querySelector("#useSelectedRecord");
const recentResearchList = document.querySelector("#recentResearchList");
const airportCount = document.querySelector("#airportCount");
const waypointCount = document.querySelector("#waypointCount");
const navaidCount = document.querySelector("#navaidCount");
const reviewedCount = document.querySelector("#reviewedCount");

let activeFilter = "all";
let selectedId = records[0]?.id ?? null;
let visibleLimit = 5;

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function titleCase(value) {
  const text = String(value ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function getFilteredRecords() {
  const query = normalize(searchInput.value);

  return records.filter((record) => {
    const matchesFilter = activeFilter === "all" || record.entityType === activeFilter;
    const matchesSearch = !query || normalize(getSearchBlob(record)).includes(query);
    return matchesFilter && matchesSearch;
  });
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
  const reviewedNotes = Object.values(researchNotes)
    .filter((note) => note.confidence && note.confidence !== "unverified")
    .length;

  if (airportCount) airportCount.textContent = (counts.airports ?? 0).toLocaleString();
  if (waypointCount) waypointCount.textContent = (counts.waypoints ?? 0).toLocaleString();
  if (navaidCount) navaidCount.textContent = (counts.navaids ?? 0).toLocaleString();
  if (reviewedCount) reviewedCount.textContent = reviewedNotes.toLocaleString();
}

function renderResults() {
  const filtered = getFilteredRecords();
  const visible = filtered.slice(0, visibleLimit);
  const limitedText = filtered.length > visible.length ? `, showing first ${visible.length}` : "";
  const loadingText = dataLoadMessage ? ` / ${dataLoadMessage}` : "";
  resultCount.textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? "record" : "records"}${limitedText}${loadingText}`;

  if (!filtered.some((record) => record.id === selectedId)) {
    selectedId = filtered[0]?.id ?? null;
  }

  resultsList.innerHTML = visible.map((record) => `
    <button class="result-card ${record.id === selectedId ? "selected" : ""}" type="button" data-id="${record.id}">
      <span class="result-topline">
        <span class="code">${record.code}</span>
        <span class="tag type-${record.entityType}">${titleCase(record.entityType)}</span>
      </span>
      <p>${record.name} / ${record.location}</p>
      <span class="result-meta">
        <span>${record.facilityType}</span>
        ${record.frequency ? `<span aria-hidden="true">/</span><span>${record.frequency}</span>` : ""}
        <span aria-hidden="true">/</span>
        <span>${titleCase(record.confidence)} namesake</span>
      </span>
    </button>
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
    script.src = source;
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

  detailPanel.innerHTML = `
    <div class="detail-hero detail-${record.entityType}">
      <div class="detail-topline">
        <span>${record.facilityType}</span>
        <span class="tag ${record.confidence}">${titleCase(record.confidence)}</span>
      </div>
      <div class="detail-code">${record.code}</div>
      <p class="detail-subtitle">${record.name} / ${record.location}</p>
    </div>
    <div class="detail-body">
      <div class="fact-grid catalog-facts">
        <div class="fact">
          <span>Type</span>
          <strong>${titleCase(record.entityType)}</strong>
        </div>
        <div class="fact">
          <span>Country</span>
          <strong>${record.country || "N/A"}</strong>
        </div>
        <div class="fact">
          <span>Status</span>
          <strong>${record.status || "N/A"}</strong>
        </div>
        <div class="fact">
          <span>Latitude</span>
          <strong>${record.latitude || "N/A"}</strong>
        </div>
        <div class="fact">
          <span>Longitude</span>
          <strong>${record.longitude || "N/A"}</strong>
        </div>
        <div class="fact">
          <span>Elevation / Frequency</span>
          <strong>${record.frequency || record.elevation || "N/A"}</strong>
        </div>
      </div>

      <section class="detail-section callout-section">
        <h3>Named After</h3>
        <p>${record.namedAfter}</p>
      </section>

      <section class="detail-section">
        <h3>Fixipedia Note</h3>
        <p>${record.archiveNote}</p>
      </section>

      <section class="detail-section split-section">
        <div>
          <h3>Evidence Trail</h3>
          <ul>
            ${(record.evidence ?? []).map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
        <div>
          <h3>Catalog Identifiers</h3>
          <div class="related-list">
            <span>${record.code}</span>
            ${(record.alternateCodes ?? []).filter((item) => item !== record.code).map((item) => `<span>${item}</span>`).join("")}
          </div>
        </div>
      </section>

      <section class="detail-section split-section">
        <div>
          <h3>Source Leads</h3>
          <ul>
            ${(record.sources ?? []).map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
        <div>
          <h3>Open Research</h3>
          <p>${record.openQuestions}</p>
        </div>
      </section>
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

  selectedId = card.dataset.id;
  renderResults();
});

recentResearchList?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-id]");
  if (!item) return;

  selectedId = item.dataset.id;
  searchInput.value = records.find((record) => record.id === selectedId)?.code ?? "";
  activeFilter = "all";
  filterButtons.forEach((filterButton) => {
    filterButton.classList.toggle("active", filterButton.dataset.filter === "all");
  });
  renderResults();
  document.querySelector("#archive")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

searchInput.addEventListener("input", () => {
  visibleLimit = 5;
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

function fillSubmissionForm(record) {
  if (!submissionForm || !record) return;

  submissionForm.elements.code.value = record.code;
  submissionForm.elements.namedAfter.value = record.namedAfter?.startsWith("Unknown.") ? "" : record.namedAfter;
  submissionForm.elements.confidence.value = record.confidence ?? "unverified";
  submissionForm.elements.evidence.value = (record.evidence ?? []).join("\n");
  submissionForm.elements.sources.value = (record.sources ?? []).join("\n");
  submissionForm.elements.openQuestions.value = record.openQuestions ?? "";
}

function getSelectedRecord() {
  return records.find((record) => record.id === selectedId);
}

useSelectedRecordButton?.addEventListener("click", () => {
  fillSubmissionForm(getSelectedRecord());
  submissionStatus.textContent = "Selected record loaded.";
});

function splitLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatMarkdownList(items, fallback = "Not provided.") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

function buildIssueUrl(record, submission) {
  const title = `Name origin submission: ${record.code}`;
  const body = [
    "## Identifier",
    record.code,
    "",
    "## Submitted name origin",
    submission.namedAfter,
    "",
    "## Submitted confidence",
    titleCase(submission.confidence),
    "",
    "## Evidence",
    formatMarkdownList(submission.evidence),
    "",
    "## Source links or citations",
    formatMarkdownList(submission.sources),
    "",
    "## Open questions",
    submission.openQuestions || "Not provided.",
    "",
    "## NASR catalog context",
    `- Name: ${record.name}`,
    `- Type: ${record.facilityType}`,
    `- Location: ${record.location}`,
    `- Country: ${record.country || "N/A"}`,
    `- Latitude: ${record.latitude || "N/A"}`,
    `- Longitude: ${record.longitude || "N/A"}`,
    "",
    "## Reviewer checklist",
    "- [ ] Confirm the identifier matches the intended NASR record",
    "- [ ] Check every submitted source",
    "- [ ] Confirm the confidence level",
    "- [ ] Decide final archive wording",
    "- [ ] Add approved wording to Fixipedia notes"
  ].join("\n");

  const url = new URL(GITHUB_ISSUE_URL);
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  url.searchParams.set("labels", "name-origin-submission");
  return url.toString();
}

submissionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(submissionForm);
  const code = normalize(formData.get("code")).toUpperCase();
  await loadAllCatalogData();
  const selectedRecord = getSelectedRecord();
  const matchingRecord = selectedRecord?.code === code
    ? selectedRecord
    : records.find((record) => record.code === code);

  if (!matchingRecord) {
    submissionStatus.textContent = "No NASR record found for that identifier.";
    return;
  }

  const namedAfter = String(formData.get("namedAfter") ?? "").trim();
  const confidence = String(formData.get("confidence") ?? "unverified").trim();
  const evidence = splitLines(formData.get("evidence"));
  const sources = splitLines(formData.get("sources"));
  const openQuestions = String(formData.get("openQuestions") ?? "").trim();

  if (!namedAfter) {
    submissionStatus.textContent = "Add who or what the name is after.";
    return;
  }

  if (!evidence.length) {
    submissionStatus.textContent = "Add the evidence for this name origin.";
    return;
  }

  if (!sources.length) {
    submissionStatus.textContent = "Add at least one source link or citation.";
    return;
  }

  if (GITHUB_ISSUE_URL.includes("YOUR_USERNAME") || GITHUB_ISSUE_URL.includes("YOUR_REPOSITORY")) {
    submissionStatus.textContent = "Set your GitHub Issues URL in app.js first.";
    return;
  }

  window.open(buildIssueUrl(matchingRecord, {
    namedAfter,
    confidence,
    evidence,
    sources,
    openQuestions
  }), "_blank", "noopener");
  submissionStatus.textContent = `Opening GitHub issue for ${code}.`;
});

renderCatalogSummary();
renderResults();
