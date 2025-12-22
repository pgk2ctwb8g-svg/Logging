const PROCESS_CODES = [
  { code: "P01", label: "Check-In" },
  { code: "P02", label: "Sicherheitskontrolle" },
  { code: "P03", label: "Boarding" },
  { code: "P04", label: "Gepäckabfertigung" },
];

const STORAGE_KEY = "process-logger-state";

const DEFAULT_STATE = {
  events: [],
};

const DROPDOWN_OPTIONS = {
  disruption_type: [
    { value: "none", label: "Keine Störung" },
    { value: "delay", label: "Verspätung" },
    { value: "staff_shortage", label: "Personalmangel" },
    { value: "tech_issue", label: "Technische Störung" },
  ],
  equipment_type: [
    { value: "belt", label: "Gepäckband" },
    { value: "gate", label: "Gate" },
    { value: "scanner", label: "Scanner" },
    { value: "bus", label: "Bus" },
  ],
  pax_mix: [
    { value: "schengen", label: "Schengen" },
    { value: "non_schengen", label: "Non-Schengen" },
    { value: "transfer", label: "Transfer" },
  ],
  observation_quality: [
    { value: "", label: "Keine Angabe" },
    { value: "high", label: "Hoch" },
    { value: "medium", label: "Mittel" },
    { value: "low", label: "Niedrig" },
  ],
};

let state = loadState();

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed?.events)) {
        return { ...DEFAULT_STATE, ...parsed };
      }
    }
  } catch (error) {
    console.warn("Konnte gespeicherte Session nicht laden.", error);
  }
  return { ...DEFAULT_STATE };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createSelect(name, options, { optional = false } = {}) {
  const wrapper = document.createElement("label");
  wrapper.textContent = name.replace("_", " ");

  const select = document.createElement("select");
  select.name = name;

  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label + (optional && option.value === "" ? " (optional)" : "");
    select.appendChild(opt);
  });

  wrapper.appendChild(select);
  return wrapper;
}

function renderDropdowns(container) {
  const dropdownPanel = document.createElement("div");
  dropdownPanel.className = "panel";

  const title = document.createElement("h2");
  title.textContent = "Dropdowns";
  dropdownPanel.appendChild(title);

  const row = document.createElement("div");
  row.className = "field-row";

  row.appendChild(createSelect("disruption_type", DROPDOWN_OPTIONS.disruption_type));
  row.appendChild(createSelect("equipment_type", DROPDOWN_OPTIONS.equipment_type));
  row.appendChild(createSelect("pax_mix", DROPDOWN_OPTIONS.pax_mix));
  row.appendChild(createSelect("observation_quality", DROPDOWN_OPTIONS.observation_quality, { optional: true }));

  dropdownPanel.appendChild(row);
  container.appendChild(dropdownPanel);
}

function renderSessionControls(container) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.id = "session-panel";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("h2");
  title.textContent = "Session";

  const summary = document.createElement("span");
  summary.id = "session-summary";
  summary.className = "muted";
  summary.textContent = `${state.events.length} Events protokolliert`;

  header.appendChild(title);
  header.appendChild(summary);

  const actions = document.createElement("div");
  actions.className = "button-row";

  const exportButton = document.createElement("button");
  exportButton.id = "export-button";
  exportButton.className = "btn-export";
  exportButton.textContent = "CSV Export";
  exportButton.disabled = state.events.length === 0;
  exportButton.addEventListener("click", handleExport);

  actions.appendChild(exportButton);

  panel.appendChild(header);
  panel.appendChild(actions);
  container.appendChild(panel);
}

function renderProcessCards(container) {
  const panel = document.createElement("div");
  panel.className = "panel";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "baseline";

  const title = document.createElement("h2");
  title.textContent = "Prozesse";
  const helper = document.createElement("span");
  helper.className = "muted";
  helper.textContent = "Start/Ende pro Prozess";

  header.appendChild(title);
  header.appendChild(helper);
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "process-list";

  PROCESS_CODES.forEach((process) => {
    const card = document.createElement("div");
    card.className = "process-card";

    const headerRow = document.createElement("div");
    headerRow.className = "process-header";

    const label = document.createElement("div");
    label.textContent = process.label;

    const code = document.createElement("span");
    code.className = "pill process-code";
    code.textContent = process.code;

    headerRow.appendChild(label);
    headerRow.appendChild(code);

    const actions = document.createElement("div");
    actions.className = "button-row";

    const startButton = document.createElement("button");
    startButton.className = "btn-start";
    startButton.textContent = "Start";
    startButton.addEventListener("click", () => handleAction(process, "start"));

    const endButton = document.createElement("button");
    endButton.className = "btn-end";
    endButton.textContent = "Ende";
    endButton.addEventListener("click", () => handleAction(process, "end"));

    actions.appendChild(startButton);
    actions.appendChild(endButton);

    card.appendChild(headerRow);
    card.appendChild(actions);
    list.appendChild(card);
  });

  panel.appendChild(list);
  container.appendChild(panel);
}

function renderLogPanel(container) {
  let logPanel = document.getElementById("log-panel");
  if (!logPanel) {
    logPanel = document.createElement("div");
    logPanel.id = "log-panel";
    logPanel.className = "panel";

    const title = document.createElement("h2");
    title.textContent = "Aktivität";
    logPanel.appendChild(title);

    const list = document.createElement("ul");
    list.id = "log-list";
    list.className = "muted";
    list.style.listStyle = "disc";
    list.style.paddingLeft = "1.25rem";
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "0.35rem";
    logPanel.appendChild(list);

    container.appendChild(logPanel);
  }

  populateLog();
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  renderDropdowns(app);
  renderProcessCards(app);
  renderSessionControls(app);
  renderLogPanel(app);
}

function getSelectedValues() {
  return Object.fromEntries(
    Object.keys(DROPDOWN_OPTIONS).map((key) => {
      const select = document.querySelector(`select[name="${key}"]`);
      return [key, select?.value ?? ""];
    })
  );
}

function formatEventMessage(event) {
  return `${event.action.toUpperCase()} ${event.process_code} (${event.process_label}) | ` +
    `Disruption: ${event.disruption_type || "-"}, ` +
    `Equipment: ${event.equipment_type || "-"}, ` +
    `Pax-Mix: ${event.pax_mix || "-"}, ` +
    `Observation: ${event.observation_quality || "-"}`;
}

function populateLog() {
  const list = document.getElementById("log-list");
  if (!list) return;
  list.innerHTML = "";
  [...state.events].reverse().forEach((event) => {
    const item = document.createElement("li");
    item.textContent = formatEventMessage(event);
    list.appendChild(item);
  });
}

function updateSessionSummary() {
  const summary = document.getElementById("session-summary");
  if (summary) {
    summary.textContent = `${state.events.length} Events protokolliert`;
  }

  const exportButton = document.getElementById("export-button");
  if (exportButton) {
    exportButton.disabled = state.events.length === 0;
  }
}

function handleAction(process, action) {
  const values = getSelectedValues();
  const event = {
    timestamp: new Date().toISOString(),
    action,
    process_code: process.code,
    process_label: process.label,
    ...values,
  };

  state.events.push(event);
  saveState();
  populateLog();
  updateSessionSummary();
}

function toCsv() {
  const header = [
    "timestamp",
    "action",
    "process_code",
    "process_label",
    "disruption_type",
    "equipment_type",
    "pax_mix",
    "observation_quality",
  ];

  const escapeValue = (value) => {
    if (value == null) return "";
    const stringValue = String(value);
    if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = state.events.map((event) => header.map((key) => escapeValue(event[key])));
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function downloadCsv() {
  const csvContent = toCsv();
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const filename = `hiwi_log_${datePart}_${timePart}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function resetSession() {
  state = { ...DEFAULT_STATE };
  localStorage.removeItem(STORAGE_KEY);
  renderApp();
}

function handleExport() {
  if (!state.events.length) return;
  downloadCsv();
  const shouldReset = window.confirm("Session löschen?");
  if (shouldReset) {
    resetSession();
  }
}

renderApp();
populateLog();
updateSessionSummary();
