const PROCESS_CODES = [
  { code: "P01", label: "Check-In", directions: ["departure", "arrival"] },
  { code: "P02", label: "Sicherheitskontrolle", directions: ["departure"] },
  { code: "P03", label: "Boarding", directions: ["departure"] },
  { code: "P04", label: "Gepäckabfertigung", directions: ["arrival", "departure"] },
  { code: "P05", label: "Ankunftsbus", directions: ["arrival"] },
  { code: "P06", label: "Passkontrolle", directions: ["arrival"] },
];

const STORAGE_KEY = "mucsim_logger_state";

const DEFAULT_STATE = {
  currentFlight: {
    flight_no: "",
    direction: "",
    stand: "",
    gate: "",
    airport: "",
    from_airport: "",
    to_airport: "",
    airline_code: "",
    aircraft_type: "",
  },
  precheckCompleted: false,
  observer_id: "",
  location: {
    latitude: "",
    longitude: "",
    accuracy: "",
    timestamp: "",
  },
  lastAirportSuggestion: "",
  flightSuggestions: [],
  flightSuggestionStatus: "idle",
  flightSuggestionError: "",
  flightApiConfig: {
    url: "",
    apiKey: "",
  },
  activeProcesses: {},
  completedProcesses: [],
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

const NEAREST_AIRPORT_MAX_DISTANCE_KM = 100;

const AIRPORTS = [
  { iata: "MUC", name: "Munich", lat: 48.3538, lon: 11.7861 },
  { iata: "FRA", name: "Frankfurt", lat: 50.0333, lon: 8.5706 },
  { iata: "BER", name: "Berlin Brandenburg", lat: 52.3667, lon: 13.5033 },
  { iata: "HAM", name: "Hamburg", lat: 53.6304, lon: 9.9882 },
  { iata: "CGN", name: "Cologne Bonn", lat: 50.8659, lon: 7.1427 },
  { iata: "DUS", name: "Düsseldorf", lat: 51.2783, lon: 6.7656 },
  { iata: "STR", name: "Stuttgart", lat: 48.6899, lon: 9.2219 },
  { iata: "NUE", name: "Nuremberg", lat: 49.4987, lon: 11.0669 },
  { iata: "LEJ", name: "Leipzig/Halle", lat: 51.4239, lon: 12.2364 },
  { iata: "HAJ", name: "Hannover", lat: 52.4611, lon: 9.685 },
  { iata: "DTM", name: "Dortmund", lat: 51.5183, lon: 7.6122 },
  { iata: "FMM", name: "Memmingen", lat: 47.9888, lon: 10.2395 },
  { iata: "ZRH", name: "Zurich", lat: 47.4647, lon: 8.5492 },
  { iata: "GVA", name: "Geneva", lat: 46.2381, lon: 6.1089 },
  { iata: "BSL", name: "Basel Mulhouse", lat: 47.59, lon: 7.5299 },
  { iata: "BRN", name: "Bern", lat: 46.9141, lon: 7.4986 },
  { iata: "VIE", name: "Vienna", lat: 48.1103, lon: 16.5697 },
  { iata: "SZG", name: "Salzburg", lat: 47.7933, lon: 13.0033 },
  { iata: "INN", name: "Innsbruck", lat: 47.2602, lon: 11.3439 },
  { iata: "AMS", name: "Amsterdam Schiphol", lat: 52.3086, lon: 4.7639 },
  { iata: "LUX", name: "Luxembourg", lat: 49.6266, lon: 6.2115 },
  { iata: "PRG", name: "Prague", lat: 50.1008, lon: 14.26 },
];

let state = { ...DEFAULT_STATE };

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        const normalizedActive = Object.fromEntries(
          Object.entries(parsed.activeProcesses || {}).map(([code, value]) => {
            const label = PROCESS_CODES.find((entry) => entry.code === code)?.label || code;
            if (value && typeof value === "object") return [code, { label, ...value }];
            return [code, { startedAt: value, label }];
          })
        );
        const normalizedCompleted = Array.isArray(parsed.completedProcesses)
          ? parsed.completedProcesses.map((entry) => ({
              ...entry,
              label: entry.label || PROCESS_CODES.find((item) => item.code === entry.code)?.label || entry.code,
            }))
          : [];
        return {
          ...DEFAULT_STATE,
          ...parsed,
          currentFlight: { ...DEFAULT_STATE.currentFlight, ...(parsed.currentFlight || {}) },
          activeProcesses: normalizedActive,
          events: Array.isArray(parsed.events) ? parsed.events : [],
          completedProcesses: normalizedCompleted,
          lastAirportSuggestion: parsed.lastAirportSuggestion || "",
          flightSuggestions: Array.isArray(parsed.flightSuggestions) ? parsed.flightSuggestions : [],
          flightSuggestionStatus: parsed.flightSuggestionStatus || "idle",
          flightSuggestionError: parsed.flightSuggestionError || "",
          flightApiConfig: {
            url: parsed.flightApiConfig?.url || "",
            apiKey: parsed.flightApiConfig?.apiKey || "",
          },
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

function setCurrentFlight(field, value, options = {}) {
  if (!(field in state.currentFlight)) return;
  state = {
    ...state,
    currentFlight: { ...state.currentFlight, [field]: value },
    ...(options.trackSuggestion ? { lastAirportSuggestion: value || "" } : {}),
  };
  persistState();
  syncFlightInputs();
}

function setObserver(value) {
  state = { ...state, observer_id: value };
  persistState();
}

function setFlightApiConfig(field, value) {
  if (!["url", "apiKey"].includes(field)) return;
  state = {
    ...state,
    flightApiConfig: { ...state.flightApiConfig, [field]: value },
  };
  persistState();
}

function completePrecheck() {
  state = { ...state, precheckCompleted: true };
  persistState();
}

function promptForAirport() {
  const airport = window.prompt("Bitte IATA-Code des Flughafens eingeben (z.B. MUC):", state.currentFlight.airport || "");
  if (airport != null && airport.trim()) {
    setCurrentFlight("airport", airport.trim().toUpperCase());
    setFeedback("Airport gesetzt.");
  } else {
    setFeedback("Kein Airport gesetzt. Bitte manuell nachtragen.");
  }
}

function setLocation({ latitude, longitude, accuracy, timestamp }) {
  state = {
    ...state,
    location: {
      latitude: latitude ?? "",
      longitude: longitude ?? "",
      accuracy: accuracy ?? "",
      timestamp: timestamp ?? "",
    },
  };
  persistState();
  updateLocationUi();
  setPrecheckFeedback("");
  updateAirportFromLocation();
}

function resetLocation() {
  setLocation({ latitude: "", longitude: "", accuracy: "", timestamp: "" });
}

function requestLocation(options = {}) {
  const { isInitial = false, buttonId } = typeof options === "boolean" ? { isInitial: options } : options ?? {};
  const button = document.getElementById(buttonId || "location-button");
  if (!navigator.geolocation) {
    setFeedback("GPS wird vom Browser nicht unterstützt.");
    if (isInitial && !state.currentFlight.airport) {
      promptForAirport();
    }
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Hole GPS...";
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const timestamp = new Date(position.timestamp).toISOString();
      setLocation({
        latitude: latitude?.toFixed(6),
        longitude: longitude?.toFixed(6),
        accuracy: accuracy != null ? Math.round(accuracy) : "",
        timestamp,
      });
      setFeedback("GPS aktualisiert.");
      if (button) {
        button.disabled = false;
        button.textContent = "GPS aktualisieren";
      }
    },
    (error) => {
      console.warn("GPS Fehler", error);
      setFeedback("GPS konnte nicht abgefragt werden. Bitte Airport manuell eintragen.");
      if (isInitial && !state.currentFlight.airport) {
        promptForAirport();
      }
      if (button) {
        button.disabled = false;
        button.textContent = "GPS aktualisieren";
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function updateLocationUi() {
  const coordinates = document.getElementById("location-coordinates");
  const accuracy = document.getElementById("location-accuracy");
  const timestamp = document.getElementById("location-timestamp");

  if (coordinates) {
    if (state.location.latitude && state.location.longitude) {
      coordinates.textContent = `${state.location.latitude}, ${state.location.longitude}`;
    } else {
      coordinates.textContent = "–";
    }
  }

  if (accuracy) {
    accuracy.textContent = `Genauigkeit: ${state.location.accuracy ? `${state.location.accuracy} m` : "–"}`;
  }

  if (timestamp) {
    const timeLabel = state.location.timestamp
      ? new Date(state.location.timestamp).toLocaleString()
      : "–";
    timestamp.textContent = `Aktualisiert: ${timeLabel}`;
  }
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceInKm(pointA, pointB) {
  const R = 6371;
  const dLat = toRadians(pointB.lat - pointA.lat);
  const dLon = toRadians(pointB.lon - pointA.lon);
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestAirport(latitude, longitude) {
  if (latitude == null || longitude == null || AIRPORTS.length === 0) return null;
  const origin = { lat: Number(latitude), lon: Number(longitude) };
  const sorted = [...AIRPORTS]
    .map((airport) => ({
      ...airport,
      distanceKm: distanceInKm(origin, { lat: airport.lat, lon: airport.lon }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return sorted[0] || null;
}

function updateAirportFromLocation() {
  if (!state.location.latitude || !state.location.longitude) return;
  const suggestion = findNearestAirport(Number(state.location.latitude), Number(state.location.longitude));
  if (!suggestion) {
    window.alert("GPS gefunden, aber keine Airport-Daten verfügbar. Bitte Airport manuell eintragen.");
    setFeedback("Keine Airport-Daten verfügbar. Bitte Airport manuell eintragen.");
    return;
  }

  console.log("Nearest airport suggestion:", suggestion, "distanceKm:", suggestion.distanceKm);

  if (suggestion.distanceKm <= NEAREST_AIRPORT_MAX_DISTANCE_KM) {
    const distanceLabel = `${Math.round(suggestion.distanceKm)} km`;
    state = { ...state, lastAirportSuggestion: suggestion.iata };
    persistState();
    const confirmed = window.confirm(
      `GPS erkannt: Nächster Airport ist ${suggestion.iata} (${distanceLabel}). Soll der Wert übernommen werden?`
    );
    if (confirmed) {
      setCurrentFlight("airport", suggestion.iata, { trackSuggestion: true });
      setFeedback(`Airport übernommen: ${suggestion.iata} (${distanceLabel}).`);
    } else {
      setFeedback(`Airport-Vorschlag ${suggestion.iata} (${distanceLabel}) verworfen.`);
    }
  } else {
    state = { ...state, lastAirportSuggestion: "" };
    persistState();
    if (!state.currentFlight.airport) {
      setCurrentFlight("airport", "", { trackSuggestion: false });
    }
    window.alert("GPS gefunden, aber kein Airport im 100 km Umkreis erkannt. Bitte Airport manuell eintragen.");
    setFeedback("Kein naher Airport erkannt. Bitte Airport manuell eintragen.");
  }
}

function setFeedback(message) {
  const feedback = document.getElementById("feedback");
  if (feedback) {
    feedback.textContent = message;
    feedback.style.visibility = message ? "visible" : "hidden";
  }
}

function clearFieldHighlights() {
  ["flight-no", "flight-direction"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove("has-error");
    }
  });
}

function highlightMissingFields(missingFields) {
  clearFieldHighlights();
  const fieldIdMap = {
    flight_no: "flight-no",
    direction: "flight-direction",
    airport: "airport-code",
  };

  missingFields.forEach((field) => {
    const targetId = fieldIdMap[field];
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (element) {
      element.classList.add("has-error");
    }
  });
}

function setActiveProcess(processCode, startedAt) {
  const processMeta = PROCESS_CODES.find((entry) => entry.code === processCode);
  state = {
    ...state,
    activeProcesses: {
      ...state.activeProcesses,
      [processCode]: { startedAt: startedAt ?? new Date().toISOString(), label: processMeta?.label ?? processCode },
    },
  };
  persistState();
  const app = document.getElementById("app");
  if (app) renderProcessCards(app);
  renderProcessVisualization();
}

function clearActiveProcess(processCode) {
  const active = state.activeProcesses?.[processCode];
  if (!active) return;
  const endTime = new Date().toISOString();
  const durationMin =
    active.startedAt && endTime ? Number(((new Date(endTime) - new Date(active.startedAt)) / 60000).toFixed(2)) : "";

  const completedEntry = {
    code: processCode,
    label: active.label ?? processCode,
    startedAt: active.startedAt,
    endedAt: endTime,
    durationMin,
    completedAt: Date.now(),
  };

  const { [processCode]: _removed, ...rest } = state.activeProcesses;
  state = {
    ...state,
    activeProcesses: rest,
    completedProcesses: [completedEntry, ...state.completedProcesses].slice(0, 30),
  };
  persistState();
  const app = document.getElementById("app");
  if (app) renderProcessCards(app);
  renderProcessVisualization();
}

function getMissingRequiredFields(eventPayload) {
  const missing = [];

  const flightNo = eventPayload.flight_no ?? state.currentFlight.flight_no;
  const direction = eventPayload.direction ?? state.currentFlight.direction;
  const airport = eventPayload.airport ?? state.currentFlight.airport;

  if (!eventPayload.process_code) missing.push("process_code");
  if (!eventPayload.event_type) missing.push("event_type");
  if (!flightNo) missing.push("flight_no");
  if (!direction) missing.push("direction");
  if (!airport) missing.push("airport");

  return missing;
}

function addEvent(eventPayload) {
  const missingFields = getMissingRequiredFields(eventPayload);

  if (missingFields.length) {
    const labels = {
      process_code: "Prozess",
      event_type: "Aktion",
      flight_no: "Flugnummer",
      direction: "Richtung",
      airport: "Airport",
    };
    const missingLabels = missingFields.map((field) => labels[field] || field).join(", ");
    highlightMissingFields(missingFields);
    setFeedback(`Bitte Pflichtfelder ausfüllen: ${missingLabels}`);
    return false;
  }

  const now = new Date();
  const eventTimestamp = now.toISOString();
  const disruptionFlag = eventPayload.disruption_flag ?? (eventPayload.disruption_type && eventPayload.disruption_type !== "none");
  const isStart = eventPayload.event_type === "start";
  const isEnd = eventPayload.event_type === "end";

  const startTimeAbs = isStart
    ? eventTimestamp
    : state.activeProcesses[eventPayload.process_code]?.startedAt ||
      state.activeProcesses[eventPayload.process_code] ||
      "";
  const endTimeAbs = isEnd ? eventTimestamp : "";

  const durationMin =
    startTimeAbs && endTimeAbs ? Number(((new Date(endTimeAbs) - new Date(startTimeAbs)) / 60000).toFixed(2)) : "";

  const timeSlot = startTimeAbs
    ? `${String(new Date(startTimeAbs).getHours()).padStart(2, "0")}-${String(
        (new Date(startTimeAbs).getHours() + 1) % 24
      ).padStart(2, "0")}`
    : "";

  const airportCode = (eventPayload.airport ?? state.currentFlight.airport ?? "").toUpperCase();
  const event = {
    log_id: `${now.getTime()}-${state.events.length + 1}`,
    flight_no: eventPayload.flight_no ?? state.currentFlight.flight_no ?? "",
    direction: eventPayload.direction ?? state.currentFlight.direction ?? "",
    airport: airportCode,
    from_airport: eventPayload.from_airport ?? state.currentFlight.from_airport ?? "",
    to_airport: eventPayload.to_airport ?? state.currentFlight.to_airport ?? "",
    airline_code: eventPayload.airline_code ?? state.currentFlight.airline_code ?? "",
    aircraft_type: eventPayload.aircraft_type ?? state.currentFlight.aircraft_type ?? "",
    stand: eventPayload.stand ?? state.currentFlight.stand ?? "",
    gate: eventPayload.gate ?? state.currentFlight.gate ?? "",
    process_id: eventPayload.process_code,
    process_code: eventPayload.process_code,
    process_label: eventPayload.process_label ?? "",
    event_type: eventPayload.event_type,
    event_timestamp: eventTimestamp,
    start_time_abs: startTimeAbs,
    end_time_abs: endTimeAbs,
    duration_min: durationMin,
    time_slot: timeSlot,
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
    location_latitude: eventPayload.location_latitude ?? state.location.latitude ?? "",
    location_longitude: eventPayload.location_longitude ?? state.location.longitude ?? "",
    location_accuracy_m: eventPayload.location_accuracy_m ?? state.location.accuracy ?? "",
    location_timestamp: eventPayload.location_timestamp ?? state.location.timestamp ?? "",
    quality_flag: airportCode ? "" : "missing_airport",
  };

  const datePart = (startTimeAbs || eventTimestamp).slice(0, 10);
  const turnaroundId = [event.airport || "UNK", event.flight_no || "UNK", datePart || "UNK", event.direction || "UNK"].join(
    "-"
  );
  event.turnaround_id = turnaroundId;
  event.instance_id = `${turnaroundId}-${event.process_code}-${state.events.length + 1}`;
  event.instance_fingerprint = `${turnaroundId}|${event.process_code}|${event.event_type}|${event.event_timestamp}`;

  state = { ...state, events: [...state.events, event] };
  persistState();
  populateLog();
  updateSessionSummary();
  clearFieldHighlights();
  setFeedback("");
  return true;
}

function createSelect(name, options, { optional = false, label }) {
  const wrapper = document.createElement("div");
  wrapper.className = "field-group";

  const fieldLabel = document.createElement("label");
  fieldLabel.textContent = label ?? name.replace("_", " ");

  const select = document.createElement("select");
  select.name = name;

  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label + (optional && option.value === "" ? " (optional)" : "");
    select.appendChild(opt);
  });

  fieldLabel.appendChild(select);
  wrapper.appendChild(fieldLabel);
  return wrapper;
}

function createInputField({ id, label, type = "text", value = "", placeholder = "" }) {
  const wrapper = document.createElement("div");
  wrapper.className = "field-group";

  const fieldLabel = document.createElement("label");
  fieldLabel.htmlFor = id;
  fieldLabel.textContent = label;

  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = "off";

  fieldLabel.appendChild(input);
  wrapper.appendChild(fieldLabel);
  return wrapper;
}

function syncFlightInputs() {
  const mapping = [
    ["airport-code", state.currentFlight.airport],
    ["precheck-airport", state.currentFlight.airport],
    ["flight-no", state.currentFlight.flight_no],
    ["precheck-flight-no", state.currentFlight.flight_no],
    ["flight-stand", state.currentFlight.stand],
    ["flight-gate", state.currentFlight.gate],
    ["from-airport", state.currentFlight.from_airport],
    ["to-airport", state.currentFlight.to_airport],
    ["airline-code", state.currentFlight.airline_code],
    ["aircraft-type", state.currentFlight.aircraft_type],
  ];

  mapping.forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) {
      input.value = value ?? "";
    }
  });
}

function setPrecheckFeedback(message) {
  const feedback = document.getElementById("precheck-feedback");
  if (feedback) {
    feedback.textContent = message;
    feedback.style.visibility = message ? "visible" : "hidden";
  }
}

function renderPrecheckScreen(container) {
  const panel = document.createElement("div");
  panel.className = "card";
  panel.id = "precheck-panel";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Start-Check";

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = "Bevor Prozesse gestartet werden können, bitte Basisdaten und Standort erfassen.";

  header.appendChild(title);
  header.appendChild(hint);
  panel.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "field-grid";

  grid.appendChild(
    createInputField({
      id: "precheck-airport",
      label: "Airport (IATA, Pflicht)",
      value: state.currentFlight.airport,
      placeholder: "z.B. MUC",
    })
  );

  const directionSelect = document.createElement("div");
  directionSelect.className = "field-group";
  const directionLabel = document.createElement("label");
  directionLabel.textContent = "Direction (Pflicht)";
  const direction = document.createElement("select");
  direction.id = "precheck-direction";
  [
    { value: "", label: "Keine Angabe" },
    { value: "arrival", label: "Arrival" },
    { value: "departure", label: "Departure" },
  ].forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    direction.appendChild(opt);
  });
  direction.value = state.currentFlight.direction;
  directionLabel.appendChild(direction);
  directionSelect.appendChild(directionLabel);
  grid.appendChild(directionSelect);

  grid.appendChild(
    createInputField({
      id: "precheck-flight-no",
      label: "Flight-No (Pflicht)",
      value: state.currentFlight.flight_no,
      placeholder: "z.B. LH123",
    })
  );

  grid.appendChild(
    createInputField({
      id: "precheck-stand",
      label: "Stand (optional)",
      value: state.currentFlight.stand,
      placeholder: "z.B. G12",
    })
  );

  panel.appendChild(grid);

  const locationRow = document.createElement("div");
  locationRow.className = "location-row";
  locationRow.innerHTML = `
    <div class="location-info">
      <div class="location-title">Standort</div>
      <div class="location-values">
        <span id="location-coordinates">–</span>
        <span id="location-accuracy" class="muted">Genauigkeit: –</span>
        <span id="location-timestamp" class="muted">Aktualisiert: –</span>
      </div>
    </div>
    <div class="location-actions">
      <button id="precheck-location-button" class="btn-neutral" type="button">GPS abfragen</button>
      <button id="precheck-continue-button" class="btn-start" type="button">Weiter zur Prozess-Übersicht</button>
    </div>
  `;

  panel.appendChild(locationRow);

  const feedback = document.createElement("div");
  feedback.id = "precheck-feedback";
  feedback.className = "feedback";
  feedback.style.visibility = "hidden";
  panel.appendChild(feedback);

  container.appendChild(panel);

  const airportInput = panel.querySelector("#precheck-airport");
  const directionInput = panel.querySelector("#precheck-direction");
  const flightInput = panel.querySelector("#precheck-flight-no");
  const standInput = panel.querySelector("#precheck-stand");
  const gpsButton = panel.querySelector("#precheck-location-button");
  const continueButton = panel.querySelector("#precheck-continue-button");

  if (airportInput) {
    airportInput.addEventListener("input", (event) => {
      setCurrentFlight("airport", event.target.value.toUpperCase());
    });
  }

  if (directionInput) {
    directionInput.addEventListener("change", (event) => {
      setCurrentFlight("direction", event.target.value);
    });
  }

  if (flightInput) {
    flightInput.addEventListener("input", (event) => {
      setCurrentFlight("flight_no", event.target.value);
    });
  }

  if (standInput) {
    standInput.addEventListener("input", (event) => {
      setCurrentFlight("stand", event.target.value);
    });
  }

  if (gpsButton) {
    gpsButton.addEventListener("click", () => requestLocation({ buttonId: "precheck-location-button" }));
  }

  if (continueButton) {
    continueButton.addEventListener("click", () => {
      const errors = [];
      if (!state.currentFlight.airport) errors.push("Airport");
      if (!state.currentFlight.direction) errors.push("Direction");
      if (!state.currentFlight.flight_no) errors.push("Flight-No");
      if (!state.location.latitude || !state.location.longitude) {
        errors.push("GPS-Position");
      }

      if (errors.length) {
        setPrecheckFeedback(`Bitte ausfüllen: ${errors.join(", ")}.`);
        return;
      }

      setPrecheckFeedback("");
      completePrecheck();
      renderApp();
      updateLocationUi();
    });
  }
}

function renderFlightDetails(container) {
  const panel = document.createElement("div");
  panel.className = "card";
  panel.id = "flight-panel";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Flugdetails";
  header.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = "Grunddaten des Fluges und Beobachter*in";
  header.appendChild(hint);

  panel.appendChild(header);

  const row = document.createElement("div");
  row.className = "field-grid";

  row.appendChild(
    createInputField({
      id: "airport-code",
      label: "Airport (IATA)",
      value: state.currentFlight.airport,
      placeholder: "z.B. MUC",
    })
  );
  const airportInput = row.querySelector("#airport-code");
  if (airportInput) {
    airportInput.addEventListener("input", (event) => {
      setCurrentFlight("airport", event.target.value.toUpperCase());
    });
  }

  const directionSelect = document.createElement("div");
  directionSelect.className = "field-group";

  const directionLabel = document.createElement("label");
  directionLabel.textContent = "Direction";
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
    renderProcessCards(document.getElementById("app"));
  });

  directionLabel.appendChild(select);
  directionSelect.appendChild(directionLabel);

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
  observerRow.className = "field-grid";
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

  observerRow.appendChild(
    createInputField({
      id: "from-airport",
      label: "From Airport (IATA, optional)",
      value: state.currentFlight.from_airport,
      placeholder: "z.B. FRA",
    })
  );

  observerRow.appendChild(
    createInputField({
      id: "to-airport",
      label: "To Airport (IATA, optional)",
      value: state.currentFlight.to_airport,
      placeholder: "z.B. JFK",
    })
  );

  const fromAirportInput = observerRow.querySelector("#from-airport");
  if (fromAirportInput) {
    fromAirportInput.addEventListener("input", (event) => {
      setCurrentFlight("from_airport", event.target.value.toUpperCase());
    });
  }

  const toAirportInput = observerRow.querySelector("#to-airport");
  if (toAirportInput) {
    toAirportInput.addEventListener("input", (event) => {
      setCurrentFlight("to_airport", event.target.value.toUpperCase());
    });
  }

  panel.appendChild(observerRow);

  const airlineRow = document.createElement("div");
  airlineRow.className = "field-grid";
  airlineRow.appendChild(
    createInputField({
      id: "airline-code",
      label: "Airline-Code (optional)",
      value: state.currentFlight.airline_code,
      placeholder: "z.B. LH",
    })
  );

  const airlineCodeInput = airlineRow.querySelector("#airline-code");
  if (airlineCodeInput) {
    airlineCodeInput.addEventListener("input", (event) => {
      setCurrentFlight("airline_code", event.target.value.toUpperCase());
    });
  }

  airlineRow.appendChild(
    createInputField({
      id: "aircraft-type",
      label: "Aircraft Type (optional)",
      value: state.currentFlight.aircraft_type,
      placeholder: "z.B. A20N",
    })
  );

  const aircraftTypeInput = airlineRow.querySelector("#aircraft-type");
  if (aircraftTypeInput) {
    aircraftTypeInput.addEventListener("input", (event) => {
      setCurrentFlight("aircraft_type", event.target.value.toUpperCase());
    });
  }

  panel.appendChild(airlineRow);

  const locationRow = document.createElement("div");
  locationRow.className = "location-row";

  const locationInfo = document.createElement("div");
  locationInfo.className = "location-info";
  locationInfo.innerHTML = `
    <div class="location-title">Standort</div>
    <div class="location-values">
      <span id="location-coordinates">–</span>
      <span id="location-accuracy" class="muted">Genauigkeit: –</span>
      <span id="location-timestamp" class="muted">Aktualisiert: –</span>
    </div>
  `;

  const locationActions = document.createElement("div");
  locationActions.className = "location-actions";

  const locationButton = document.createElement("button");
  locationButton.id = "location-button";
  locationButton.className = "btn-neutral";
  locationButton.type = "button";
  locationButton.textContent = "GPS aktualisieren";
  locationButton.addEventListener("click", () => requestLocation({ buttonId: "location-button" }));

  const resetLocationButton = document.createElement("button");
  resetLocationButton.className = "btn-neutral";
  resetLocationButton.type = "button";
  resetLocationButton.textContent = "GPS löschen";
  resetLocationButton.addEventListener("click", () => {
    resetLocation();
    setFeedback("GPS-Daten zurückgesetzt.");
  });

  locationActions.appendChild(locationButton);
  locationActions.appendChild(resetLocationButton);

  locationRow.appendChild(locationInfo);
  locationRow.appendChild(locationActions);

  panel.appendChild(locationRow);

  container.appendChild(panel);
}

function renderFlightSuggestions(container) {
  const existing = document.getElementById("flight-suggestions");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.className = "card";
  panel.id = "flight-suggestions";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Flugvorschläge (±30 Min)";

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent =
    "Lädt Flüge für den gesetzten Airport und schlägt Flugnummer & Aircraft Type vor. Falls kein API konfiguriert ist, werden Beispieldaten genutzt.";

  header.appendChild(title);
  header.appendChild(hint);
  panel.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "button-row";

  const fetchButton = document.createElement("button");
  fetchButton.className = "btn-neutral";
  fetchButton.type = "button";
  fetchButton.textContent = state.flightSuggestionStatus === "loading" ? "Lade..." : "Flüge laden";
  fetchButton.disabled = !state.currentFlight.airport || state.flightSuggestionStatus === "loading";
  fetchButton.addEventListener("click", fetchFlightSuggestions);

  const clearButton = document.createElement("button");
  clearButton.className = "btn-neutral";
  clearButton.type = "button";
  clearButton.textContent = "Vorschläge leeren";
  clearButton.disabled = state.flightSuggestions.length === 0;
  clearButton.addEventListener("click", () => {
    state = { ...state, flightSuggestions: [], flightSuggestionStatus: "idle", flightSuggestionError: "" };
    persistState();
    renderFlightSuggestions(document.getElementById("app"));
  });

  actions.appendChild(fetchButton);
  actions.appendChild(clearButton);
  panel.appendChild(actions);

  const status = document.createElement("div");
  status.className = "muted";
  status.style.fontSize = "0.95rem";
  const apiSource = state.flightApiConfig.url
    ? `Quelle: ${state.flightApiConfig.url}${state.flightApiConfig.apiKey ? " (Bearer Token gesetzt)" : ""}`
    : "Quelle: Sample-Daten (kein API-Endpoint hinterlegt)";
  status.textContent =
    state.flightSuggestionStatus === "loading"
      ? "Flüge werden geladen..."
      : state.flightSuggestionStatus === "error"
        ? `Fehler beim Laden: ${state.flightSuggestionError || "unbekannt"}`
        : state.currentFlight.airport
          ? `Airport: ${state.currentFlight.airport}. Ladezeitraum: jetzt ±30 Min. ${apiSource}`
          : `Bitte zuerst Airport setzen, um Vorschläge zu laden. ${apiSource}`;
  panel.appendChild(status);

  const apiHint = document.createElement("p");
  apiHint.className = "card-hint";
  apiHint.style.marginTop = "-0.25rem";
  apiHint.textContent =
    "Hinweis: Externe APIs benötigen CORS-Freigabe. Falls Flightradar/andere Quellen blocken, nutze einen kleinen Proxy (z.B. Cloudflare Worker) und trage dessen URL hier ein.";
  panel.appendChild(apiHint);

  const apiGrid = document.createElement("div");
  apiGrid.className = "field-grid";

  apiGrid.appendChild(
    createInputField({
      id: "flight-api-url",
      label: "Flug-API URL (optional, inkl. https://)",
      value: state.flightApiConfig.url,
      placeholder: "https://api.example.com/flights",
    })
  );

  apiGrid.appendChild(
    createInputField({
      id: "flight-api-key",
      label: "API Key / Bearer Token (optional)",
      value: state.flightApiConfig.apiKey,
      placeholder: "token wird als Bearer gesendet",
    })
  );

  const apiUrlInput = apiGrid.querySelector("#flight-api-url");
  if (apiUrlInput) {
    apiUrlInput.addEventListener("input", (event) => {
      setFlightApiConfig("url", event.target.value.trim());
    });
  }

  const apiKeyInput = apiGrid.querySelector("#flight-api-key");
  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", (event) => {
      setFlightApiConfig("apiKey", event.target.value.trim());
    });
  }

  panel.appendChild(apiGrid);

  const list = document.createElement("div");
  list.id = "flight-suggestion-list";
  list.className = "process-list";

  if (!state.flightSuggestions.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Noch keine Vorschläge geladen.";
    list.appendChild(empty);
  } else {
    state.flightSuggestions.forEach((flight) => {
      const card = document.createElement("div");
      card.className = "process-card";

      const headerRow = document.createElement("div");
      headerRow.className = "process-header";

      const label = document.createElement("div");
      label.innerHTML = `<strong>${flight.flight_no || "Unbekannter Flug"}</strong> · ${
        flight.airline || "Airline n/a"
      }`;

      const meta = document.createElement("span");
      meta.className = "pill";
      meta.textContent = flight.aircraft_type || "Type n/a";

      headerRow.appendChild(label);
      headerRow.appendChild(meta);
      card.appendChild(headerRow);

      const detail = document.createElement("div");
      detail.className = "muted";
      detail.textContent = flight.description || "Zeitnaher Flug im ±30 Min Slot.";
      card.appendChild(detail);

      const applyButton = document.createElement("button");
      applyButton.className = "btn-start";
      applyButton.type = "button";
      applyButton.textContent = "Flug übernehmen";
      applyButton.addEventListener("click", () => {
        setCurrentFlight("flight_no", flight.flight_no || "");
        setCurrentFlight("airline_code", flight.airline_code || "");
        setCurrentFlight("aircraft_type", flight.aircraft_type || "");
        if (flight.direction) setCurrentFlight("direction", flight.direction);
        if (flight.gate) setCurrentFlight("gate", flight.gate);
        if (flight.stand) setCurrentFlight("stand", flight.stand);
        renderProcessCards(document.getElementById("app"));
        setFeedback(`Flug ${flight.flight_no || ""} übernommen.`);
      });

      card.appendChild(applyButton);
      list.appendChild(card);
    });
  }

  panel.appendChild(list);
  container.appendChild(panel);
}

function buildSampleFlights(airport) {
  const now = new Date();
  const makeTimeLabel = (offsetMinutes) => {
    const target = new Date(now.getTime() + offsetMinutes * 60000);
    return target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return [
    {
      flight_no: `${state.currentFlight.airline_code || "LH"}${Math.floor(100 + Math.random() * 800)}`,
      airline: "Beispiel Airline",
      airline_code: state.currentFlight.airline_code || "LH",
      aircraft_type: "A20N",
      direction: state.currentFlight.direction || "departure",
      gate: "K5",
      stand: "G12",
      description: `Abflug in ${makeTimeLabel(15)} ab ${airport}.`,
    },
    {
      flight_no: `X${Math.floor(4000 + Math.random() * 500)}`,
      airline: "Beispiel Charter",
      airline_code: "X3",
      aircraft_type: "B738",
      direction: "arrival",
      gate: "L2",
      stand: "R4",
      description: `Ankunft gegen ${makeTimeLabel(-10)} an ${airport}.`,
    },
  ];
}

async function fetchFlightSuggestions() {
  if (!state.currentFlight.airport) {
    setFeedback("Bitte zuerst einen Airport setzen.");
    return;
  }

  state = { ...state, flightSuggestionStatus: "loading", flightSuggestionError: "" };
  persistState();
  renderFlightSuggestions(document.getElementById("app"));

  const now = Math.floor(Date.now() / 1000);
  const start = now - 30 * 60;
  const end = now + 30 * 60;

  const config = state.flightApiConfig?.url
    ? state.flightApiConfig
    : window.flightApiConfig;
  let flights = [];
  let status = "idle";
  let errorMessage = "";

  if (config?.url) {
    try {
      const params = new URLSearchParams({
        airport: state.currentFlight.airport,
        start: new Date(start * 1000).toISOString(),
        end: new Date(end * 1000).toISOString(),
        direction: state.currentFlight.direction || "",
      });
      const response = await fetch(`${config.url}?${params.toString()}`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      flights =
        Array.isArray(data?.flights) && data.flights.length
          ? data.flights
          : Array.isArray(data)
            ? data
            : [];
    } catch (error) {
      console.warn("Konnte Flug-API nicht laden, fallback auf Sample.", error);
      status = "error";
      errorMessage = error.message || "API Fehler";
    }
  }

  if (!flights.length) {
    flights = buildSampleFlights(state.currentFlight.airport);
  }

  state = {
    ...state,
    flightSuggestions: flights.slice(0, 10),
    flightSuggestionStatus: status,
    flightSuggestionError: errorMessage,
  };
  persistState();
  renderFlightSuggestions(document.getElementById("app"));
}

function renderDropdowns(container) {
  const panel = document.createElement("div");
  panel.className = "card";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Kontext & Notizen";
  header.appendChild(title);

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = "Disruption, Equipment, Pax-Mix und Beobachtungsqualität erfassen.";
  header.appendChild(hint);

  panel.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "field-grid";

  grid.appendChild(createSelect("disruption_type", DROPDOWN_OPTIONS.disruption_type, { label: "Disruption" }));
  grid.appendChild(createSelect("equipment_type", DROPDOWN_OPTIONS.equipment_type, { label: "Equipment" }));
  grid.appendChild(createSelect("pax_mix", DROPDOWN_OPTIONS.pax_mix, { label: "Pax-Mix" }));
  grid.appendChild(
    createSelect("observation_quality", DROPDOWN_OPTIONS.observation_quality, {
      optional: true,
      label: "Observation Quality",
    })
  );

  const notesField = document.createElement("div");
  notesField.className = "field-group";
  const notesLabel = document.createElement("label");
  notesLabel.htmlFor = "notes";
  notesLabel.textContent = "Notes";
  const textarea = document.createElement("textarea");
  textarea.id = "notes";
  textarea.placeholder = "Zusätzliche Hinweise, Störungen oder Beobachtungen";
  notesLabel.appendChild(textarea);
  notesField.appendChild(notesLabel);
  grid.appendChild(notesField);

  panel.appendChild(grid);
  container.appendChild(panel);
}

function renderSessionControls(container) {
  const panel = document.createElement("div");
  panel.className = "card";
  panel.id = "session-panel";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
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

  const resetButton = document.createElement("button");
  resetButton.className = "btn-neutral";
  resetButton.textContent = "Session zurücksetzen";
  resetButton.addEventListener("click", () => {
    const confirmReset = window.confirm("Aktuelle Session wirklich löschen?");
    if (confirmReset) resetSession();
  });

  actions.appendChild(exportButton);
  actions.appendChild(resetButton);

  panel.appendChild(header);
  panel.appendChild(actions);
  container.appendChild(panel);
}

function renderProcessCards(container) {
  if (!container) return;
  const existing = document.getElementById("process-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.className = "card";
  panel.id = "process-panel";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Prozesse";
  const helper = document.createElement("p");
  helper.className = "card-hint";
  const activeDirection = state.currentFlight.direction;
  helper.textContent = activeDirection
    ? `Relevante Prozesse für ${activeDirection === "arrival" ? "Arrival" : "Departure"}`
    : "Start/Ende pro Prozess";

  header.appendChild(title);
  header.appendChild(helper);
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "process-list";

  const visibleProcesses = state.currentFlight.direction
    ? PROCESS_CODES.filter((process) => process.directions?.includes(state.currentFlight.direction))
    : PROCESS_CODES;

  if (!visibleProcesses.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Keine Prozesse für diese Richtung hinterlegt.";
    list.appendChild(empty);
  } else {
    visibleProcesses.forEach((process) => {
      const card = document.createElement("div");
      card.className = "process-card";

      const isActive = Boolean(state.activeProcesses?.[process.code]);
      if (isActive) {
        card.classList.add("is-active");
      }

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
      startButton.disabled = isActive;
      startButton.addEventListener("click", () => handleAction(process, "start"));

      const endButton = document.createElement("button");
      endButton.className = "btn-end";
      endButton.textContent = "Ende";
      endButton.disabled = !isActive;
      endButton.addEventListener("click", () => handleAction(process, "end"));

      const instanceButton = document.createElement("button");
      instanceButton.className = "btn-neutral";
      instanceButton.textContent = "Instanz dokumentieren";
      instanceButton.addEventListener("click", () => handleAction(process, "instance"));

      actions.appendChild(startButton);
      actions.appendChild(endButton);
      actions.appendChild(instanceButton);

      if (isActive) {
        const indicator = document.createElement("div");
        indicator.className = "process-indicator";
        const since = state.activeProcesses[process.code]?.startedAt || state.activeProcesses[process.code];
        const sinceLabel = since ? new Date(since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        indicator.innerHTML = `<span class=\"pill running-pill\">Läuft${sinceLabel ? ` seit ${sinceLabel}` : ""}</span>`;
        card.appendChild(indicator);
      }

      card.appendChild(headerRow);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  panel.appendChild(list);

  const sessionPanel = document.getElementById("session-panel");
  if (sessionPanel && container.contains(sessionPanel)) {
    container.insertBefore(panel, sessionPanel);
  } else {
    container.appendChild(panel);
  }

  renderProcessVisualization();
}

function renderProcessVisualization() {
  const app = document.getElementById("app");
  if (!app) return;

  const existing = document.getElementById("process-visualization");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.className = "card process-viz-card";
  panel.id = "process-visualization";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Live Visualisierung";

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = "Aktive Prozesse laufen als animierte Puls-Icons ein, abgeschlossene gleiten in die Historie.";

  header.appendChild(title);
  header.appendChild(hint);
  panel.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "process-viz-grid";

  const activeLane = document.createElement("div");
  activeLane.className = "process-viz-lane";
  activeLane.innerHTML = `<div class="lane-title">Laufend</div>`;
  const activeRow = document.createElement("div");
  activeRow.className = "token-row";

  const activeEntries = Object.entries(state.activeProcesses || {}).sort(
    ([_a, left], [_b, right]) => new Date(left?.startedAt || 0) - new Date(right?.startedAt || 0)
  );

  if (!activeEntries.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "lane-placeholder";
    placeholder.textContent = "Keine aktiven Prozesse";
    activeRow.appendChild(placeholder);
  } else {
    activeEntries.forEach(([code, meta]) => {
      const token = document.createElement("div");
      token.className = "process-token is-active";
      const startedLabel = meta?.startedAt
        ? new Date(meta.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      token.innerHTML = `
        <div class="process-icon">
          <span class="process-icon-dot"></span>
        </div>
        <div class="process-token-body">
          <div class="token-title">${code}</div>
          <div class="token-subtitle">${meta?.label || "Aktiver Prozess"}</div>
          <div class="token-meta">${startedLabel ? `seit ${startedLabel}` : ""}</div>
        </div>
      `;
      activeRow.appendChild(token);
    });
  }

  activeLane.appendChild(activeRow);
  grid.appendChild(activeLane);

  const completedLane = document.createElement("div");
  completedLane.className = "process-viz-lane";
  completedLane.innerHTML = `<div class="lane-title">Abgeschlossen</div>`;
  const completedRow = document.createElement("div");
  completedRow.className = "token-row token-row-completed";

  if (!state.completedProcesses.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "lane-placeholder";
    placeholder.textContent = "Noch keine abgeschlossenen Prozesse";
    completedRow.appendChild(placeholder);
  } else {
    state.completedProcesses.slice(0, 10).forEach((entry) => {
      const isNew = Date.now() - entry.completedAt < 7000;
      const token = document.createElement("div");
      token.className = `process-token is-complete${isNew ? " is-new" : ""}`;
      const endedLabel = entry?.endedAt
        ? new Date(entry.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      token.innerHTML = `
        <div class="process-icon complete-icon">
          <span class="process-icon-check">✓</span>
        </div>
        <div class="process-token-body">
          <div class="token-title">${entry.code}</div>
          <div class="token-subtitle">${entry.label || "Prozess abgeschlossen"}</div>
          <div class="token-meta">${endedLabel ? `beendet um ${endedLabel}` : ""}${entry.durationMin ? ` · ${entry.durationMin} min` : ""}</div>
        </div>
      `;
      completedRow.appendChild(token);
    });
  }

  completedLane.appendChild(completedRow);
  grid.appendChild(completedLane);

  panel.appendChild(grid);

  const processPanel = document.getElementById("process-panel");
  const sessionPanel = document.getElementById("session-panel");

  if (sessionPanel && app.contains(sessionPanel)) {
    app.insertBefore(panel, sessionPanel);
  } else if (processPanel && processPanel.nextSibling) {
    app.insertBefore(panel, processPanel.nextSibling);
  } else {
    app.appendChild(panel);
  }
}

function renderLogPanel(container) {
  let logPanel = document.getElementById("log-panel");
  if (!logPanel) {
    logPanel = document.createElement("div");
    logPanel.id = "log-panel";
    logPanel.className = "card";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = "Aktivität";
    logPanel.appendChild(title);

    const feedback = document.createElement("div");
    feedback.id = "feedback";
    feedback.className = "feedback";
    feedback.style.visibility = "hidden";
    logPanel.appendChild(feedback);

    const list = document.createElement("ul");
    list.id = "log-list";
    list.className = "log-list";
    logPanel.appendChild(list);

    container.appendChild(logPanel);
  }

  populateLog();
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  if (!state.precheckCompleted) {
    renderPrecheckScreen(app);
    updateLocationUi();
    return;
  }
  renderFlightDetails(app);
  renderFlightSuggestions(app);
  renderDropdowns(app);
  renderProcessCards(app);
  renderSessionControls(app);
  renderLogPanel(app);
  updateLocationUi();
}

function getSelectedValues() {
  const dropdownValues = Object.fromEntries(
    Object.keys(DROPDOWN_OPTIONS).map((key) => {
      const select = document.querySelector(`select[name="${key}"]`);
      return [key, select?.value ?? ""];
    })
  );

  const notesInput = document.getElementById("notes");

  return {
    ...dropdownValues,
    notes: notesInput?.value ?? "",
  };
}

function formatEventMessage(event) {
  const flightInfo = [event.flight_no || "-", event.direction || "-"].filter(Boolean).join(" | ");
  return `${event.event_type?.toUpperCase() || "-"} ${event.process_code} (${event.process_label}) | ` +
    `Flug: ${flightInfo || "-"} | ` +
    `Airport: ${event.airport || "-"} | ` +
    `Aircraft: ${event.aircraft_type || "-"} | ` +
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
    const activeSession = state.events.length > 0 || state.currentFlight.flight_no || state.currentFlight.direction;
    const suffix = activeSession ? " – gespeicherte Session aktiv" : "";
    summary.textContent = `${state.events.length} Events protokolliert${suffix}`;
  }

  const exportButton = document.getElementById("export-button");
  if (exportButton) {
    exportButton.disabled = state.events.length === 0;
  }
}

function handleAction(process, action) {
  const values = getSelectedValues();
  const success = addEvent({
    process_code: process.code,
    process_label: process.label,
    event_type: action,
    ...values,
  });

  if (!success) return;

  if (action === "start") {
    setActiveProcess(process.code);
  } else if (action === "end") {
    clearActiveProcess(process.code);
  }
}

function toCsv() {
  const header = [
    "process_id",
    "log_id",
    "turnaround_id",
    "instance_id",
    "instance_fingerprint",
    "flight_no",
    "direction",
    "airport",
    "from_airport",
    "to_airport",
    "airline_code",
    "aircraft_type",
    "stand",
    "gate",
    "process_code",
    "process_label",
    "event_type",
    "start_time_abs",
    "end_time_abs",
    "duration_min",
    "time_slot",
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
    "location_latitude",
    "location_longitude",
    "location_accuracy_m",
    "location_timestamp",
    "quality_flag",
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

  return filename;
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
  const filename = downloadCsv();
  setFeedback(`CSV exportiert: ${filename}`);
  const shouldReset = window.confirm("Session löschen?");
  if (shouldReset) {
    resetSession();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  state = loadState();
  renderApp();
  requestLocation({ isInitial: true });
  populateLog();
  updateSessionSummary();
  setFeedback("");
});
