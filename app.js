const PROCESS_CODES = [
  { code: "P01", label: "Check-In" },
  { code: "P02", label: "Sicherheitskontrolle" },
  { code: "P03", label: "Boarding" },
  { code: "P04", label: "Gepäckabfertigung" },
];

const STORAGE_KEY = "mucsim_logger_state";

const DEFAULT_STATE = {
  currentFlight: {
    flight_no: "",
    direction: "",
    stand: "",
    gate: "",
  },
  observer_id: "",
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

let state = { ...DEFAULT_STATE };

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          ...DEFAULT_STATE,
          ...parsed,
          currentFlight: { ...DEFAULT_STATE.currentFlight, ...(parsed.currentFlight || {}) },
          events: Array.isArray(parsed.events) ? parsed.events : [],
        };
      }
    }
  } catch (error) {
    console.warn("Konnte gespeicherte Session nicht laden.", error);
  }
  return { ...DEFAULT_STATE };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setCurrentFlight(field, value) {
  if (!(field in state.currentFlight)) return;
  state = {
    ...state,
    currentFlight: { ...state.currentFlight, [field]: value },
  };
  persistState();
}

function setObserver(value) {
  state = { ...state, observer_id: value };
  persistState();
}

function setFeedback(message) {
  const feedback = document.getElementById("feedback");
  if (feedback) {
    feedback.textContent = message;
    feedback.style.visibility = message ? "visible" : "hidden";
  }
}

function addEvent(eventPayload) {
  const missingFields = [];
  if (!eventPayload.process_code) missingFields.push("process_code");
  if (!eventPayload.event_type) missingFields.push("event_type");

  if (missingFields.length) {
    setFeedback(`Bitte Pflichtfelder ausfüllen: ${missingFields.join(", ")}`);
    return;
  }

  const now = new Date();
  const eventTimestamp = now.toISOString();
  const disruptionFlag = eventPayload.disruption_flag ?? (eventPayload.disruption_type && eventPayload.disruption_type !== "none");

  const event = {
    log_id: `${now.getTime()}-${state.events.length + 1}`,
    flight_no: eventPayload.flight_no ?? state.currentFlight.flight_no ?? "",
    direction: eventPayload.direction ?? state.currentFlight.direction ?? "",
    airport: "MUC",
    stand: eventPayload.stand ?? state.currentFlight.stand ?? "",
    gate: eventPayload.gate ?? state.currentFlight.gate ?? "",
    process_code: eventPayload.process_code,
    process_label: eventPayload.process_label ?? "",
    event_type: eventPayload.event_type,
    event_timestamp: eventTimestamp,
    disruption_flag: Boolean(disruptionFlag),
    disruption_type: eventPayload.disruption_type ?? "",
    notes: eventPayload.notes ?? "",
    staff_count: eventPayload.staff_count ?? "",
    equipment_type: eventPayload.equipment_type ?? "",
    pax_mix: eventPayload.pax_mix ?? "",
    observer_id: eventPayload.observer_id ?? state.observer_id ?? "",
    source: "HIWI_LOGGER_V1",
    time_of_instancetaking: eventPayload.time_of_instancetaking ?? eventTimestamp,
    observation_quality: eventPayload.observation_quality ?? "",
  };

  state = { ...state, events: [...state.events, event] };
  persistState();
  populateLog();
  updateSessionSummary();
  setFeedback("");
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

function createInputField({ id, label, type = "text", value = "", placeholder = "" }) {
  const wrapper = document.createElement("label");
  wrapper.htmlFor = id;
  wrapper.textContent = label;

  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";

  wrapper.appendChild(input);
  return wrapper;
}

function renderFlightDetails(container) {
  const panel = document.createElement("div");
  panel.className = "panel";

  const title = document.createElement("h2");
  title.textContent = "Flugdetails";
  panel.appendChild(title);

  const row = document.createElement("div");
  row.className = "field-row";

  const directionSelect = document.createElement("label");
  directionSelect.textContent = "Direction";
  const select = document.createElement("select");
  select.id = "flight-direction";

  [
    { value: "", label: "Keine Angabe" },
    { value: "arrival", label: "Arrival" },
    { value: "departure", label: "Departure" },
  ].forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  });

  select.value = state.currentFlight.direction;
  select.addEventListener("change", (event) => {
    setCurrentFlight("direction", event.target.value);
  });

  directionSelect.appendChild(select);

  row.appendChild(
    createInputField({
      id: "flight-no",
      label: "Flight-No",
      value: state.currentFlight.flight_no,
      placeholder: "z.B. LH123",
    })
  );
  const flightInput = row.querySelector("#flight-no");
  if (flightInput) {
    flightInput.addEventListener("input", (event) => {
      setCurrentFlight("flight_no", event.target.value);
    });
  }

  row.appendChild(directionSelect);
  row.appendChild(
    createInputField({
      id: "flight-stand",
      label: "Stand",
      value: state.currentFlight.stand,
      placeholder: "z.B. G12",
    })
  );
  const standInput = row.querySelector("#flight-stand");
  if (standInput) {
    standInput.addEventListener("input", (event) => {
      setCurrentFlight("stand", event.target.value);
    });
  }

  row.appendChild(
    createInputField({
      id: "flight-gate",
      label: "Gate",
      value: state.currentFlight.gate,
      placeholder: "z.B. K5",
    })
  );
  const gateInput = row.querySelector("#flight-gate");
  if (gateInput) {
    gateInput.addEventListener("input", (event) => {
      setCurrentFlight("gate", event.target.value);
    });
  }

  panel.appendChild(row);

  const observerRow = document.createElement("div");
  observerRow.className = "field-row";
  observerRow.appendChild(
    createInputField({
      id: "observer-id",
      label: "Observer-ID",
      value: state.observer_id,
      placeholder: "Mitarbeiterkennung",
    })
  );

  const observerInput = observerRow.querySelector("#observer-id");
  if (observerInput) {
    observerInput.addEventListener("input", (event) => {
      setObserver(event.target.value);
    });
  }

  panel.appendChild(observerRow);

  container.appendChild(panel);
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

    const feedback = document.createElement("div");
    feedback.id = "feedback";
    feedback.className = "feedback muted";
    feedback.style.visibility = "hidden";
    logPanel.appendChild(feedback);

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
  renderFlightDetails(app);
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
  const flightInfo = [event.flight_no || "-", event.direction || "-"].filter(Boolean).join(" | ");
  return `${event.event_type?.toUpperCase() || "-"} ${event.process_code} (${event.process_label}) | ` +
    `Flug: ${flightInfo || "-"} | ` +
    `Stand: ${event.stand || "-"} Gate: ${event.gate || "-"} | ` +
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
  addEvent({
    process_code: process.code,
    process_label: process.label,
    event_type: action,
    ...values,
  });
}

function toCsv() {
  const header = [
    "log_id",
    "flight_no",
    "direction",
    "airport",
    "stand",
    "gate",
    "process_code",
    "process_label",
    "event_type",
    "event_timestamp",
    "disruption_flag",
    "disruption_type",
    "notes",
    "staff_count",
    "equipment_type",
    "pax_mix",
    "observation_quality",
    "observer_id",
    "source",
    "time_of_instancetaking",
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
  populateLog();
  updateSessionSummary();
  setFeedback("");
}

function handleExport() {
  if (!state.events.length) return;
  downloadCsv();
  const shouldReset = window.confirm("Session löschen?");
  if (shouldReset) {
    resetSession();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  state = loadState();
  renderApp();
  populateLog();
  updateSessionSummary();
  setFeedback("");
});
