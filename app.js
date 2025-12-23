const PROCESS_CODES = [
  { code: "P01", label: "Check-In", directions: ["departure", "arrival"] },
  { code: "P02", label: "Sicherheitskontrolle", directions: ["departure"] },
  { code: "P03", label: "Boarding", directions: ["departure"] },
  { code: "P04", label: "Gepäckabfertigung", directions: ["arrival", "departure"] },
  { code: "P05", label: "Ankunftsbus", directions: ["arrival"] },
  { code: "P06", label: "Passkontrolle", directions: ["arrival"] },
];

const STORAGE_KEY = "mucsim_logger_state";
const STORAGE_KEY_API = "mucsim_logger_flight_api";

const FLIGHT_TIME_WINDOW_MIN = 30;
const MAX_FLIGHT_SUGGESTIONS = 10;
const NEAREST_AIRPORT_MAX_DISTANCE_KM = 100;
const LOCATION_RETRY_DELAY_MS = 5000;

const DEFAULT_STATE = {
  started: false,
  flightPickerOpen: false,
  flightDetailsEditable: false,
  lastAppliedFlight: null,
  currentFlight: {
    flight_no: "",
    direction: "",
    stand: "",
    gate: "",
    airport: "MUC",
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
  lastLocationSuccessAt: "",
  locationStatus: "",
  lastAirportSuggestion: "",
  lastAirportPromptLocationKey: "",
  flightSuggestions: [],
  flightSuggestionStatus: "idle",
  flightSuggestionError: "",
  flightSuggestionSource: "unknown",
  flightSuggestionAnalysis: "",
  flightSuggestionStats: {
    count: 0,
    topAirline: "",
    windowMinutes: FLIGHT_TIME_WINDOW_MIN,
  },
  flightApiConfig: {
    url: "",
    apiKey: "",
  },
  autoFetchedAfterStart: false,
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
let locationRequestInFlight = false;
let locationRetryTimeoutId = null;
let scheduledPersistId = null;

function scheduleStatePersist(delay = 250) {
  clearTimeout(scheduledPersistId);
  scheduledPersistId = setTimeout(() => {
    persistState();
    scheduledPersistId = null;
  }, delay);
}

function cancelScheduledPersist() {
  if (scheduledPersistId) {
    clearTimeout(scheduledPersistId);
    scheduledPersistId = null;
  }
}

function persistStateDebounced(delay = 250) {
  scheduleStatePersist(delay);
}

function getDefaultFlightApiUrl() {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      const base = window.location.origin.replace(/\/$/, "");
      return `${base}/flights`;
    }
  } catch (error) {
    console.warn("Konnte Default-API nicht ableiten.", error);
  }
  return "http://localhost:8788/flights";
}

function loadFlightApiConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_API);
    const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          url: parsed.url || windowApiConfig.url || "",
          apiKey: parsed.apiKey || windowApiConfig.apiKey || "",
        };
      }
    }
  } catch (error) {
    console.warn("Konnte API-Config nicht laden.", error);
  }
  return { url: "", apiKey: "" };
}

function persistFlightApiConfig(config) {
  try {
    localStorage.setItem(
      STORAGE_KEY_API,
      JSON.stringify({
        url: config?.url || "",
        apiKey: config?.apiKey || "",
      })
    );
  } catch (error) {
    console.warn("Konnte API-Config nicht speichern.", error);
  }
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedApiConfig = loadFlightApiConfig();
    const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
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
        const suggestionList = Array.isArray(parsed.flightSuggestions) ? parsed.flightSuggestions : [];
        return {
          ...DEFAULT_STATE,
          ...parsed,
          started: parsed.started ?? DEFAULT_STATE.started,
          flightPickerOpen: parsed.flightPickerOpen ?? DEFAULT_STATE.flightPickerOpen,
          flightDetailsEditable: parsed.flightDetailsEditable ?? DEFAULT_STATE.flightDetailsEditable,
          lastAppliedFlight: parsed.lastAppliedFlight ?? DEFAULT_STATE.lastAppliedFlight,
          currentFlight: { ...DEFAULT_STATE.currentFlight, ...(parsed.currentFlight || {}) },
          activeProcesses: normalizedActive,
          events: Array.isArray(parsed.events) ? parsed.events : [],
          completedProcesses: normalizedCompleted,
          lastLocationSuccessAt: parsed.lastLocationSuccessAt || "",
          locationStatus: parsed.locationStatus || "",
          lastAirportSuggestion: parsed.lastAirportSuggestion || "",
          lastAirportPromptLocationKey: parsed.lastAirportPromptLocationKey || "",
          flightSuggestions: suggestionList,
          flightSuggestionStatus: parsed.flightSuggestionStatus || "idle",
          flightSuggestionError: parsed.flightSuggestionError || "",
          flightSuggestionSource: parsed.flightSuggestionSource || "unknown",
          flightSuggestionAnalysis: parsed.flightSuggestionAnalysis || "",
          flightSuggestionStats:
            parsed.flightSuggestionStats ||
            computeFlightStats(suggestionList) || {
              count: 0,
              topAirline: "",
              windowMinutes: FLIGHT_TIME_WINDOW_MIN,
            },
          flightApiConfig: {
            url: storedApiConfig.url || parsed.flightApiConfig?.url || windowApiConfig.url || "",
            apiKey: storedApiConfig.apiKey || parsed.flightApiConfig?.apiKey || windowApiConfig.apiKey || "",
          },
          autoFetchedAfterStart: parsed.autoFetchedAfterStart ?? false,
        };
      }
    }
  } catch (error) {
    console.warn("Konnte gespeicherte Session nicht laden.", error);
  }
  const fallbackApiConfig = loadFlightApiConfig();
  const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
  return {
    ...DEFAULT_STATE,
    flightApiConfig: {
      url: fallbackApiConfig.url || windowApiConfig.url || "",
      apiKey: fallbackApiConfig.apiKey || windowApiConfig.apiKey || "",
    },
    started: false,
    flightPickerOpen: false,
    flightDetailsEditable: false,
    lastAppliedFlight: null,
    flightSuggestionStats: DEFAULT_STATE.flightSuggestionStats,
    autoFetchedAfterStart: false,
  };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  persistFlightApiConfig(state.flightApiConfig);
}

function clearLocationRetryTimer() {
  if (locationRetryTimeoutId) {
    clearTimeout(locationRetryTimeoutId);
    locationRetryTimeoutId = null;
  }
}

function getRetryButtons() {
  return ["precheck-location-retry-button", "location-retry-button"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function updateRetryButtons({ visible, disabled, label }) {
  getRetryButtons().forEach((button) => {
    if (visible !== undefined) {
      button.style.display = visible ? "inline-flex" : "none";
    }
    if (disabled !== undefined) {
      button.disabled = disabled;
    }
    if (label) {
      button.textContent = label;
    } else if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent;
    }
    if (!label && button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
    }
  });
}

function setCurrentFlight(field, value, options = {}) {
  if (!(field in state.currentFlight)) return;
  const { trackSuggestion, persistNow, deferPersist } = options;
  state = {
    ...state,
    currentFlight: { ...state.currentFlight, [field]: value },
    ...(trackSuggestion ? { lastAirportSuggestion: value || "" } : {}),
  };
  if (persistNow) {
    cancelScheduledPersist();
    persistState();
  } else if (deferPersist) {
    scheduleStatePersist();
  } else {
    persistStateDebounced();
  }
  syncFlightInputs();
  const continueButton = document.getElementById("precheck-continue-button");
  if (continueButton) continueButton.disabled = !state.currentFlight.airport || !state.currentFlight.flight_no;
  if (state.currentFlight.airport) {
    const airportError = document.getElementById("precheck-airport-error");
    const airportInput = document.getElementById("precheck-airport");
    if (airportError) airportError.style.display = "none";
    if (airportInput) airportInput.classList.remove("has-error");
  }
}

function setObserver(value) {
  state = { ...state, observer_id: value };
  persistStateDebounced();
}

function setFlightApiConfig(field, value) {
  if (!["url", "apiKey"].includes(field)) return;
  state = {
    ...state,
    flightApiConfig: { ...state.flightApiConfig, [field]: value },
  };
  persistStateDebounced();
}

function clearFlightApiConfig() {
  state = { ...state, flightApiConfig: { url: "", apiKey: "" } };
  persistState();
}

function completePrecheck() {
  state = { ...state, precheckCompleted: true };
  persistState();
}

function setFlightDetailsEditable(value) {
  state = { ...state, flightDetailsEditable: Boolean(value) };
  persistState();
  renderApp();
}

function applyStartMode(isStartMode) {
  const body = document.body;
  const shell = document.querySelector(".app-shell");
  const header = document.querySelector(".app-header");
  if (isStartMode) {
    body?.classList.add("start-mode");
    shell?.classList.add("start-mode");
    header?.classList.add("is-hidden");
  } else {
    body?.classList.remove("start-mode");
    shell?.classList.remove("start-mode");
    header?.classList.remove("is-hidden");
  }
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

function setLocationStatus(status) {
  state = { ...state, locationStatus: status || "" };
  persistStateDebounced();
  updateLocationUi();
}

function setLocation({ latitude, longitude, accuracy, timestamp, statusMessage, recordSuccessAt }) {
  state = {
    ...state,
    location: {
      latitude: latitude ?? "",
      longitude: longitude ?? "",
      accuracy: accuracy ?? "",
      timestamp: timestamp ?? "",
    },
    ...(recordSuccessAt !== undefined ? { lastLocationSuccessAt: recordSuccessAt } : {}),
    locationStatus: statusMessage !== undefined ? statusMessage : state.locationStatus,
  };
  persistState();
  updateLocationUi();
  updateAirportFromLocation();
}

function resetLocation() {
  setLocation({ latitude: "", longitude: "", accuracy: "", timestamp: "", statusMessage: "", recordSuccessAt: "" });
}

function ensureAirportFallback() {
  if (!state.currentFlight.airport) {
    setCurrentFlight("airport", "MUC");
  }
}

function triggerAutoFlightFetch() {
  if (state.autoFetchedAfterStart || state.flightSuggestionStatus === "loading_auto") return;
  if (state.flightSuggestions.length) {
    state = { ...state, autoFetchedAfterStart: true };
    persistState();
    return;
  }
  ensureAirportFallback();
  state = { ...state, autoFetchedAfterStart: true };
  persistState();
  fetchFlightSuggestions({ source: "auto" });
}

function requestLocation(options = {}) {
  const { buttonId, onSuccess, onFailure, autoFetch, allowRetry = true } =
    typeof options === "boolean" ? {} : options ?? {};
  const button = document.getElementById(buttonId || "location-button");
  const ensureAirportFallbackOnce = (() => {
    let applied = false;
    return () => {
      if (!applied) {
        ensureAirportFallback();
        applied = true;
      }
    };
  })();

  if (locationRequestInFlight) {
    setPrecheckFeedback("GPS-Abfrage läuft noch – bitte warten.");
    return;
  }

  if (!navigator.geolocation) {
    const unsupportedMessage = "GPS wird vom Browser nicht unterstützt.";
    setFeedback(unsupportedMessage);
    setPrecheckFeedback("GPS nicht verfügbar – bitte Airport manuell setzen.");
    setLocationStatus("GPS nicht verfügbar – bitte Airport manuell setzen.");
    ensureAirportFallbackOnce();
    if (autoFetch) triggerAutoFlightFetch();
    if (typeof onFailure === "function") onFailure();
    return;
  }

  clearLocationRetryTimer();
  updateRetryButtons({ visible: false });

  locationRequestInFlight = true;
  setPrecheckFeedback("GPS wird abgefragt...");
  setLocationStatus("GPS läuft...");

  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
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
        statusMessage: `GPS gefunden${accuracy != null ? ` (${Math.round(accuracy)} m)` : ""}.`,
        recordSuccessAt: timestamp,
      });
      setFeedback("GPS aktualisiert.");
      setPrecheckFeedback("GPS gesetzt.");
      updateRetryButtons({ visible: false });
      if (autoFetch) triggerAutoFlightFetch();
      if (typeof onSuccess === "function") onSuccess();
      if (button) {
        button.disabled = false;
        button.classList.remove("is-loading");
        button.textContent = button.dataset.originalLabel || "GPS aktualisieren";
      }
      clearLocationRetryTimer();
      locationRequestInFlight = false;
    },
    (error) => {
      console.warn("GPS Fehler", error);
      const errorMessage = error?.message ? ` (${error.message})` : "";
      setFeedback("GPS fehlgeschlagen. Bitte Airport manuell setzen.");
      setPrecheckFeedback(`GPS fehlgeschlagen${errorMessage}. Bitte Airport nutzen.`);
      setLocationStatus("GPS fehlt – nutze Standard MUC.");
      ensureAirportFallbackOnce();
      if (autoFetch) triggerAutoFlightFetch();
      if (typeof onFailure === "function") onFailure();
      if (button) {
        button.classList.remove("is-loading");
        button.textContent = button.dataset.originalLabel || "GPS aktualisieren";
        button.disabled = true;
      }
      const retryLabel = `Auto-Retry in ${LOCATION_RETRY_DELAY_MS / 1000}s`;
      updateRetryButtons({ visible: true, disabled: true, label: retryLabel });
      clearLocationRetryTimer();
      locationRetryTimeoutId = setTimeout(() => {
        locationRetryTimeoutId = null;
        updateRetryButtons({ visible: true, disabled: false, label: "GPS erneut versuchen" });
        if (button) {
          button.disabled = false;
        }
        if (allowRetry) {
          requestLocation({ buttonId, onSuccess, onFailure, autoFetch, allowRetry: false });
        }
      }, LOCATION_RETRY_DELAY_MS);
      locationRequestInFlight = false;
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function updateLocationUi() {
  const coordinates = document.getElementById("location-coordinates");
  const accuracy = document.getElementById("location-accuracy");
  const timestamp = document.getElementById("location-timestamp");
  const status = document.getElementById("location-status");
  const precheckStatus = document.getElementById("precheck-location-status");

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

  const statusLabel =
    state.locationStatus ||
    (state.location.latitude && state.location.longitude
      ? "GPS gesetzt."
      : "GPS noch nicht abgefragt.");
  const lastSuccessLabel = state.lastLocationSuccessAt
    ? ` (Zuletzt erfolgreich: ${new Date(state.lastLocationSuccessAt).toLocaleString()})`
    : "";
  if (status) {
    status.textContent = statusLabel;
  }
  if (precheckStatus) {
    precheckStatus.textContent = `${statusLabel}${lastSuccessLabel}`;
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
    ensureAirportFallback();
    setFeedback("Kein Airport gefunden. MUC als Fallback.");
    setPrecheckFeedback("Kein Airport erkannt – MUC genutzt.");
    return;
  }

  const locationPromptKey = `${state.location.latitude},${state.location.longitude}|${state.location.timestamp}`;
  if (state.lastAirportPromptLocationKey === locationPromptKey) return;

  console.log("Nearest airport suggestion:", suggestion, "distanceKm:", suggestion.distanceKm);

  if (suggestion.distanceKm <= NEAREST_AIRPORT_MAX_DISTANCE_KM) {
    const distanceLabel = `${Math.round(suggestion.distanceKm)} km`;
    state = { ...state, lastAirportSuggestion: suggestion.iata, lastAirportPromptLocationKey: locationPromptKey };
    persistState();
    setCurrentFlight("airport", suggestion.iata, { trackSuggestion: true });
    setFeedback(`Airport: ${suggestion.iata} (${distanceLabel}).`);
    setPrecheckFeedback(`Airport gesetzt: ${suggestion.iata} (${distanceLabel}).`);
  } else {
    state = { ...state, lastAirportSuggestion: "" };
    persistState();
    ensureAirportFallback();
    setFeedback("Kein naher Airport. MUC als Fallback.");
    setPrecheckFeedback("Kein naher Airport – MUC genutzt.");
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

function clearActiveProcess(processCode, endTime) {
  const active = state.activeProcesses?.[processCode];
  if (!active) return false;
  const resolvedEndTime = endTime || new Date().toISOString();
  const startedAt = active.startedAt || active;

  if (startedAt && new Date(resolvedEndTime) <= new Date(startedAt)) {
    setFeedback("Endzeit muss nach Startzeit liegen.");
    return false;
  }

  const durationMin = computeDurationMinutes(startedAt, resolvedEndTime);

  const completedEntry = {
    code: processCode,
    label: active.label ?? processCode,
    startedAt,
    endedAt: resolvedEndTime,
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
  return true;
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

function validateEventPayload(eventPayload) {
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
    return { valid: false };
  }

  const isEnd = eventPayload.event_type === "end";
  if (isEnd && !state.activeProcesses[eventPayload.process_code]) {
    setFeedback("Kein aktiver Prozess für diesen Abschluss gefunden.");
    return { valid: false };
  }

  return { valid: true };
}

function resolveEventTimes(eventPayload, eventTimestamp) {
  const isStart = eventPayload.event_type === "start";
  const isEnd = eventPayload.event_type === "end";
  const active = state.activeProcesses[eventPayload.process_code];
  const activeStart = active?.startedAt || active || "";

  const startTimeAbs = isStart ? activeStart || eventTimestamp : activeStart;
  const endTimeAbs = isEnd ? eventTimestamp : "";

  return { startTimeAbs, endTimeAbs };
}

function computeDurationMinutes(startTimeAbs, endTimeAbs) {
  if (!startTimeAbs || !endTimeAbs) return "";
  return Number(((new Date(endTimeAbs) - new Date(startTimeAbs)) / 60000).toFixed(2));
}

function computeTimeSlot(startTimeAbs) {
  if (!startTimeAbs) return "";
  const startDate = new Date(startTimeAbs);
  return `${String(startDate.getHours()).padStart(2, "0")}-${String((startDate.getHours() + 1) % 24).padStart(2, "0")}`;
}

function buildInstanceFingerprint({ turnaroundId, processCode, eventType, startTimeAbs, endTimeAbs }) {
  return [turnaroundId, processCode, eventType, startTimeAbs || "", endTimeAbs || ""].join("|");
}

function buildEvent(eventPayload, eventTimestamp) {
  const { startTimeAbs, endTimeAbs } = resolveEventTimes(eventPayload, eventTimestamp);
  const durationMin = computeDurationMinutes(startTimeAbs, endTimeAbs);
  const timeSlot = computeTimeSlot(startTimeAbs);

  const disruptionFlag = eventPayload.disruption_flag ?? (eventPayload.disruption_type && eventPayload.disruption_type !== "none");
  const airportCode = (eventPayload.airport ?? state.currentFlight.airport ?? "").toUpperCase();
  const event = {
    log_id: `${new Date(eventTimestamp).getTime()}-${state.events.length + 1}`,
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
  event.instance_fingerprint = buildInstanceFingerprint({
    turnaroundId,
    processCode: event.process_code,
    eventType: event.event_type,
    startTimeAbs,
    endTimeAbs,
  });

  return event;
}

function isDuplicateEvent(fingerprint) {
  return state.events.some((existing) => existing.instance_fingerprint === fingerprint);
}

function addEvent(eventPayload) {
  const validation = validateEventPayload(eventPayload);
  if (!validation.valid) return false;

  const now = new Date();
  const eventTimestamp = eventPayload.event_timestamp || now.toISOString();
  const event = buildEvent(eventPayload, eventTimestamp);

  if (isDuplicateEvent(event.instance_fingerprint)) {
    setFeedback("Event bereits protokolliert – kein erneuter Log.");
    return false;
  }

  state = { ...state, events: [...state.events, event] };
  persistState();
  populateLog();
  updateSessionSummary();
  clearFieldHighlights();
  setFeedback("");
  return event;
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

function getMissingFlightFieldConfigs() {
  const fieldConfigs = [
    {
      key: "direction",
      id: "missing-direction",
      label: "Direction",
      type: "select",
      options: [
        { value: "", label: "Keine Angabe" },
        { value: "arrival", label: "Arrival" },
        { value: "departure", label: "Departure" },
      ],
    },
    {
      key: "from_airport",
      id: "missing-from-airport",
      label: "From Airport (IATA)",
      placeholder: "z.B. FRA",
      transform: (value) => value.toUpperCase(),
    },
    {
      key: "to_airport",
      id: "missing-to-airport",
      label: "To Airport (IATA)",
      placeholder: "z.B. JFK",
      transform: (value) => value.toUpperCase(),
    },
    { key: "gate", id: "missing-gate", label: "Gate", placeholder: "z.B. K5" },
    { key: "stand", id: "missing-stand", label: "Stand", placeholder: "z.B. G12" },
    {
      key: "aircraft_type",
      id: "missing-aircraft-type",
      label: "Aircraft Type",
      placeholder: "z.B. A20N",
      transform: (value) => value.toUpperCase(),
    },
    {
      key: "airline_code",
      id: "missing-airline-code",
      label: "Airline Code",
      placeholder: "z.B. LH",
      transform: (value) => value.toUpperCase(),
    },
  ];

  return fieldConfigs.filter((entry) => !state.currentFlight[entry.key]);
}

function syncFlightInputs() {
  const mapping = [
    ["airport-code", state.currentFlight.airport],
    ["precheck-airport", state.currentFlight.airport],
    ["flight-no", state.currentFlight.flight_no],
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
  const compactStatus = state.currentFlight.flight_no
    ? `${state.currentFlight.flight_no} · ${state.currentFlight.from_airport || "-"} → ${state.currentFlight.to_airport || "-"}`
    : "Noch kein Flug gewählt.";

  const panel = document.createElement("div");
  panel.className = "card precheck-card";
  panel.id = "precheck-panel";

  const header = document.createElement("div");
  header.className = "card-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = "Airport auswählen";

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = "IATA-Code eingeben, Flüge laden, einen auswählen und starten.";

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
  const airportWrapper = grid.querySelector("#precheck-airport")?.closest(".field-group");
  if (airportWrapper) {
    const airportError = document.createElement("div");
    airportError.id = "precheck-airport-error";
    airportError.className = "field-error";
    airportError.textContent = "Airport fehlt – bitte IATA-Code eingeben.";
    airportError.style.display = "none";
    airportWrapper.appendChild(airportError);
  }

  panel.appendChild(grid);

  const selection = document.createElement("div");
  selection.className = "precheck-selection";
  selection.textContent = compactStatus;
  panel.appendChild(selection);

  const actions = document.createElement("div");
  actions.className = "precheck-actions";

  const fetchButton = document.createElement("button");
  fetchButton.className = "btn-neutral";
  fetchButton.type = "button";
  const isLoading = state.flightSuggestionStatus === "loading" || state.flightSuggestionStatus === "loading_auto";
  fetchButton.textContent = isLoading ? "Lade..." : "Flüge laden";
  fetchButton.disabled = !state.currentFlight.airport || isLoading;
  fetchButton.addEventListener("click", () => {
    if (!state.currentFlight.airport) {
      setPrecheckFeedback("Bitte IATA-Code eingeben.");
      return;
    }
    setPrecheckFeedback("");
    fetchFlightSuggestions({ source: "manual" });
  });

  const continueButton = document.createElement("button");
  continueButton.id = "precheck-continue-button";
  continueButton.className = "btn-start";
  continueButton.type = "button";
  continueButton.textContent = "Weiter zum Logging";
  continueButton.disabled = !state.currentFlight.flight_no;
  continueButton.addEventListener("click", () => {
    const airportError = document.getElementById("precheck-airport-error");
    if (!state.currentFlight.airport) {
      if (airportError) airportError.style.display = "block";
      setPrecheckFeedback("Airport fehlt – bitte IATA-Code setzen.");
      return;
    }
    if (!state.currentFlight.flight_no) {
      setPrecheckFeedback("Bitte zuerst einen Flug aus der Liste auswählen.");
      return;
    }
    if (airportError) airportError.style.display = "none";
    completePrecheck();
    renderApp();
  });

  actions.appendChild(fetchButton);
  actions.appendChild(continueButton);
  panel.appendChild(actions);

  const feedback = document.createElement("div");
  feedback.id = "precheck-feedback";
  feedback.className = "feedback";
  feedback.style.visibility = "hidden";
  panel.appendChild(feedback);

  const flightList = document.createElement("div");
  flightList.className = "precheck-flight-list";
  flightList.appendChild(createFlightSuggestionGrid({ compact: true }));
  panel.appendChild(flightList);

  container.appendChild(panel);

  const airportInput = panel.querySelector("#precheck-airport");
  const continueBtn = panel.querySelector("#precheck-continue-button");

  if (airportInput) {
    airportInput.addEventListener("input", (event) => {
      const value = event.target.value.toUpperCase();
      setCurrentFlight("airport", value, { deferPersist: true });
      const hasAirport = Boolean(value.trim());
      if (continueBtn) continueBtn.disabled = !hasAirport || !state.currentFlight.flight_no;
      const airportError = document.getElementById("precheck-airport-error");
      if (airportError) airportError.style.display = hasAirport ? "none" : airportError.style.display;
      airportInput.classList.toggle("has-error", !hasAirport && airportError?.style.display === "block");
    });
    airportInput.addEventListener("blur", (event) => {
      const value = event.target.value.toUpperCase().trim();
      setCurrentFlight("airport", value, { persistNow: true });
      const hasAirport = Boolean(value);
      if (continueBtn) continueBtn.disabled = !hasAirport || !state.currentFlight.flight_no;
      const airportError = document.getElementById("precheck-airport-error");
      if (airportError) airportError.style.display = hasAirport ? "none" : airportError.style.display;
      airportInput.classList.toggle("has-error", !hasAirport && airportError?.style.display === "block");
      event.target.value = value;
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
  hint.textContent = "Übernommene Flugdaten, jederzeit anpassbar.";
  header.appendChild(hint);

  panel.appendChild(header);

  const summaryRow = document.createElement("div");
  summaryRow.className = "flight-summary-row";
  const summaryText = document.createElement("div");
  summaryText.className = "flight-summary-text";
  const applied = state.lastAppliedFlight;
  const hasFlight = Boolean(state.currentFlight.flight_no);
  summaryText.textContent = hasFlight
    ? `Aktiv: ${state.currentFlight.flight_no || "n/a"} · ${state.currentFlight.direction || "-"} · ${state.currentFlight.from_airport || "-"} → ${state.currentFlight.to_airport || "-"}`
    : applied
      ? `Zuletzt: ${applied.flight_no || "n/a"} · ${applied.direction || "-"}`
      : "Noch kein Flug gewählt.";
  summaryRow.appendChild(summaryText);

  const summaryActions = document.createElement("div");
  summaryActions.className = "summary-actions";

  const suggestionLoading = state.flightSuggestionStatus === "loading" || state.flightSuggestionStatus === "loading_auto";
  const pickerButton = document.createElement("button");
  pickerButton.type = "button";
  pickerButton.className = "btn-start";
  pickerButton.textContent = suggestionLoading ? "Lade..." : hasFlight ? "Flug wechseln" : "Flüge laden";
  pickerButton.disabled = suggestionLoading;
  pickerButton.addEventListener("click", () => {
    fetchFlightSuggestions({ source: "manual" });
    const suggestionPanel = document.getElementById("flight-suggestions");
    if (suggestionPanel) {
      suggestionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  summaryActions.appendChild(pickerButton);

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "btn-neutral ghost-btn";
  editButton.textContent = state.flightDetailsEditable ? "Eingabe ausblenden" : "Manuell bearbeiten";
  editButton.addEventListener("click", () => setFlightDetailsEditable(!state.flightDetailsEditable));
  summaryActions.appendChild(editButton);

  summaryRow.appendChild(summaryActions);
  panel.appendChild(summaryRow);

  const missingFieldConfigs = getMissingFlightFieldConfigs();

  if (hasFlight) {
    const loadedBox = document.createElement("div");
    loadedBox.className = "flight-loaded-summary";
    const loadedTitle = document.createElement("div");
    loadedTitle.className = "flight-loaded-title";
    loadedTitle.textContent = "Übernommene Daten";

    const loadedList = document.createElement("ul");
    loadedList.className = "flight-loaded-list";
    const snapshotItems = [
      ["Flug", state.currentFlight.flight_no || "-"],
      ["Direction", state.currentFlight.direction || "-"],
      ["Route", `${state.currentFlight.from_airport || "-"} → ${state.currentFlight.to_airport || "-"}`],
      ["Gate/Stand", `Gate ${state.currentFlight.gate || "–"} · Stand ${state.currentFlight.stand || "–"}`],
      ["Airline", state.currentFlight.airline_code || "-"],
      ["Aircraft", state.currentFlight.aircraft_type || "-"],
    ];
    snapshotItems.forEach(([label, value]) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${label}:</strong> ${value}`;
      loadedList.appendChild(item);
    });

    const loadedHint = document.createElement("div");
    loadedHint.className = "flight-loaded-hint";
    loadedHint.textContent = "Bei Bedarf ändern.";

    loadedBox.appendChild(loadedTitle);
    loadedBox.appendChild(loadedList);
    loadedBox.appendChild(loadedHint);
    panel.appendChild(loadedBox);
  }

  const showEditor = state.flightDetailsEditable || !state.currentFlight.flight_no;

  if (!showEditor && hasFlight) {
    const compact = document.createElement("div");
    compact.className = "flight-compact";
    compact.innerHTML = `
      <div><strong>Flug:</strong> ${state.currentFlight.flight_no || "-"} (${state.currentFlight.aircraft_type || "Type n/a"})</div>
      <div><strong>Route:</strong> ${state.currentFlight.from_airport || "-"} → ${state.currentFlight.to_airport || "-"} | Gate ${state.currentFlight.gate || "–"} | Stand ${state.currentFlight.stand || "–"}</div>
      <div><strong>Direction:</strong> ${state.currentFlight.direction || "–"} | Airport: ${state.currentFlight.airport || "-"}</div>
    `;
    panel.appendChild(compact);
  }

  if (!showEditor && hasFlight && missingFieldConfigs.length) {
    const missingWrapper = document.createElement("div");
    missingWrapper.className = "missing-fields";
    const missingTitle = document.createElement("div");
    missingTitle.className = "missing-title";
    missingTitle.textContent = "Fehlendes ergänzen";
    const missingGrid = document.createElement("div");
    missingGrid.className = "field-grid";

    missingFieldConfigs.forEach((fieldConfig) => {
      if (fieldConfig.type === "select") {
        const wrapper = document.createElement("div");
        wrapper.className = "field-group";
        const label = document.createElement("label");
        label.textContent = fieldConfig.label;
        const select = document.createElement("select");
        select.id = fieldConfig.id;
        fieldConfig.options.forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option.value;
          opt.textContent = option.label;
          select.appendChild(opt);
        });
        select.addEventListener("change", (event) => setCurrentFlight(fieldConfig.key, event.target.value));
        label.appendChild(select);
        wrapper.appendChild(label);
        missingGrid.appendChild(wrapper);
        return;
      }

      const wrapper = createInputField({
        id: fieldConfig.id,
        label: fieldConfig.label,
        value: "",
        placeholder: fieldConfig.placeholder || "",
      });
      const input = wrapper.querySelector(`#${fieldConfig.id}`);
      if (input) {
        input.addEventListener("input", (event) => {
          const rawValue = event.target.value;
          const nextValue = typeof fieldConfig.transform === "function" ? fieldConfig.transform(rawValue) : rawValue;
          setCurrentFlight(fieldConfig.key, nextValue);
        });
      }
      missingGrid.appendChild(wrapper);
    });

    missingWrapper.appendChild(missingTitle);
    missingWrapper.appendChild(missingGrid);
    panel.appendChild(missingWrapper);
  }

  if (showEditor) {
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
  }

  container.appendChild(panel);
}

function createFlightSuggestionGrid({ compact = false } = {}) {
  const list = document.createElement("div");
  list.id = "flight-suggestion-list";
  list.className = compact ? "compact-flight-grid" : "process-list";

  if (!state.flightSuggestions.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Noch keine Vorschläge geladen.";
    list.appendChild(empty);
    return list;
  }

  state.flightSuggestions.slice(0, MAX_FLIGHT_SUGGESTIONS).forEach((flight) => {
    const card = document.createElement("div");
    card.className = compact ? "compact-flight-card" : "process-card";

    const header = document.createElement("div");
    header.className = compact ? "compact-flight-header" : "process-header";
    header.innerHTML = `
      <div class="flight-heading">
        <span class="flight-chip">${flight.flight_no || "Unbekannt"}</span>
        <span class="flight-route">${flight.from_airport || "-"} → ${flight.to_airport || "-"}</span>
      </div>
      <div class="flight-meta">${flight.direction ? (flight.direction === "arrival" ? "Arrival" : "Departure") : "–"} · ${flight.airline || "Airline n/a"}</div>
    `;
    card.appendChild(header);

    const description = document.createElement("div");
    description.className = "muted";
    description.textContent = flight.description || `Flug im ±${FLIGHT_TIME_WINDOW_MIN} Min Fenster.`;
    card.appendChild(description);

    const details = document.createElement("div");
    details.className = "compact-flight-details";
    details.textContent = [
      flight.aircraft_type || "",
      flight.gate ? `Gate ${flight.gate}` : "",
      flight.stand ? `Stand ${flight.stand}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (details.textContent) card.appendChild(details);

    const actionRow = document.createElement("div");
    actionRow.className = "compact-flight-actions";
    const applyButton = document.createElement("button");
    applyButton.className = "btn-start btn-small";
    applyButton.type = "button";
    applyButton.textContent = "Flug auswählen";
    applyButton.addEventListener("click", () => {
      applyFlightSelection(flight);
    });
    actionRow.appendChild(applyButton);
    card.appendChild(actionRow);

    list.appendChild(card);
  });

  return list;
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
  title.textContent = `Flüge laden (${MAX_FLIGHT_SUGGESTIONS} Vorschläge)`;

  const hint = document.createElement("p");
  hint.className = "card-hint";
  hint.textContent = `Airport setzen, kurz laden und direkt auswählen.`;

  header.appendChild(title);
  header.appendChild(hint);
  panel.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "precheck-actions";

  const fetchButton = document.createElement("button");
  fetchButton.className = "btn-neutral";
  fetchButton.type = "button";
  const isLoading = state.flightSuggestionStatus === "loading" || state.flightSuggestionStatus === "loading_auto";
  fetchButton.textContent = isLoading ? "Lade..." : "Flüge laden";
  fetchButton.disabled = !state.currentFlight.airport || isLoading;
  fetchButton.addEventListener("click", () => fetchFlightSuggestions({ source: "manual" }));

  const clearButton = document.createElement("button");
  clearButton.className = "btn-neutral ghost-btn";
  clearButton.type = "button";
  clearButton.textContent = "Liste leeren";
  clearButton.disabled = state.flightSuggestions.length === 0;
  clearButton.addEventListener("click", () => {
    state = {
      ...state,
      flightSuggestions: [],
      flightSuggestionStatus: "idle",
      flightSuggestionError: "",
      flightSuggestionSource: "unknown",
      flightSuggestionAnalysis: "",
      flightSuggestionStats: { count: 0, topAirline: "", windowMinutes: FLIGHT_TIME_WINDOW_MIN },
      flightPickerOpen: false,
    };
    persistState();
    renderFlightSuggestions(document.getElementById("app"));
  });

  actions.appendChild(fetchButton);
  actions.appendChild(clearButton);
  panel.appendChild(actions);

  const status = document.createElement("div");
  status.className = "muted compact-status";
  const apiSource = state.flightApiConfig.url
    ? `API: ${state.flightApiConfig.url}`
    : state.flightApiConfig.apiKey
        ? "API: RapidAPI Key genutzt"
        : "API: Samples aktiv";
  const statusLabel =
    state.flightSuggestionStatus === "loading"
      ? "Lade Flüge..."
      : state.flightSuggestionStatus === "loading_auto"
          ? "Lade automatisch..."
          : state.flightSuggestionStatus === "error"
              ? `Fehler: ${state.flightSuggestionError || "unbekannt"}`
              : state.currentFlight.airport
                  ? `Airport ${state.currentFlight.airport} · ±${FLIGHT_TIME_WINDOW_MIN} Min · ${apiSource}`
                  : "Bitte Airport setzen und laden.";
  status.textContent = statusLabel;
  panel.appendChild(status);

  const analysisNote = document.createElement("div");
  analysisNote.className = "card-hint";
  analysisNote.textContent = state.flightSuggestionAnalysis || "Noch nichts geladen.";
  panel.appendChild(analysisNote);

  const apiGrid = document.createElement("div");
  apiGrid.className = "field-grid flight-api-grid";

  apiGrid.appendChild(
    createInputField({
      id: "flight-api-url",
      label: "Flug-API URL (optional)",
      value: state.flightApiConfig.url,
      placeholder: "https://api.example.com/flights",
    })
  );

  apiGrid.appendChild(
    createInputField({
      id: "flight-api-key",
      label: "RapidAPI Key (AeroDataBox, optional)",
      value: state.flightApiConfig.apiKey,
      placeholder: "wird als X-RapidAPI-Key gesendet",
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

  const clearApiButton = document.createElement("button");
  clearApiButton.type = "button";
  clearApiButton.className = "btn-neutral ghost-btn";
  clearApiButton.textContent = "API-URL & Token löschen";
  clearApiButton.disabled = !state.flightApiConfig.url && !state.flightApiConfig.apiKey;
  clearApiButton.addEventListener("click", () => {
    clearFlightApiConfig();
    renderFlightSuggestions(document.getElementById("app"));
  });
  apiGrid.appendChild(clearApiButton);

  panel.appendChild(apiGrid);

  panel.appendChild(createFlightSuggestionGrid({ compact: true }));
  container.appendChild(panel);
}

function buildSampleFlights(airport) {
  const now = new Date();
  const makeTimeLabel = (offsetMinutes) => {
    const target = new Date(now.getTime() + offsetMinutes * 60000);
    return target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const samples = [
    {
      flight_no: `${state.currentFlight.airline_code || "LH"}${Math.floor(100 + Math.random() * 800)}`,
      airline: "Beispiel Airline",
      airline_code: state.currentFlight.airline_code || "LH",
      aircraft_type: "A20N",
      direction: state.currentFlight.direction || "departure",
      gate: "K5",
      stand: "G12",
      from_airport: airport,
      to_airport: "JFK",
      airport,
      description: `Abflug gegen ${makeTimeLabel(10)} ab ${airport}.`,
    },
    {
      flight_no: `X${Math.floor(4000 + Math.random() * 500)}`,
      airline: "Beispiel Charter",
      airline_code: "X3",
      aircraft_type: "B738",
      direction: "arrival",
      gate: "L2",
      stand: "R4",
      from_airport: "PMI",
      to_airport: airport,
      airport,
      description: `Ankunft gegen ${makeTimeLabel(-8)} an ${airport}.`,
    },
    {
      flight_no: `EW${Math.floor(100 + Math.random() * 400)}`,
      airline: "Eurowings Sample",
      airline_code: "EW",
      aircraft_type: "A319",
      direction: "departure",
      gate: "A12",
      stand: "A21",
      from_airport: airport,
      to_airport: "LHR",
      airport,
      description: `Abflug ${makeTimeLabel(2)} ab ${airport}.`,
    },
    {
      flight_no: `FR${Math.floor(400 + Math.random() * 300)}`,
      airline: "Ryanair Sample",
      airline_code: "FR",
      aircraft_type: "B738",
      direction: "arrival",
      gate: "C3",
      stand: "C18",
      from_airport: "DUB",
      to_airport: airport,
      airport,
      description: `Ankunft ${makeTimeLabel(-12)} an ${airport}.`,
    },
    {
      flight_no: `UA${Math.floor(100 + Math.random() * 500)}`,
      airline: "United Sample",
      airline_code: "UA",
      aircraft_type: "B789",
      direction: "departure",
      gate: "Z9",
      stand: "Z12",
      from_airport: airport,
      to_airport: "EWR",
      airport,
      description: `Langstrecke ${makeTimeLabel(14)} ab ${airport}.`,
    },
    {
      flight_no: `BA${Math.floor(200 + Math.random() * 600)}`,
      airline: "British Sample",
      airline_code: "BA",
      aircraft_type: "A21N",
      direction: "departure",
      gate: "B6",
      stand: "B18",
      from_airport: airport,
      to_airport: "LHR",
      airport,
      description: `Abflug nach London um ${makeTimeLabel(18)}.`,
    },
    {
      flight_no: `KL${Math.floor(400 + Math.random() * 300)}`,
      airline: "KLM Sample",
      airline_code: "KL",
      aircraft_type: "E190",
      direction: "arrival",
      gate: "D4",
      stand: "D22",
      from_airport: "AMS",
      to_airport: airport,
      airport,
      description: `Anflug aus Amsterdam ${makeTimeLabel(-4)}.`,
    },
    {
      flight_no: `AF${Math.floor(1000 + Math.random() * 500)}`,
      airline: "Air France Sample",
      airline_code: "AF",
      aircraft_type: "A320",
      direction: "departure",
      gate: "F8",
      stand: "F30",
      from_airport: airport,
      to_airport: "CDG",
      airport,
      description: `Abflug nach Paris ${makeTimeLabel(6)}.`,
    },
    {
      flight_no: `LX${Math.floor(200 + Math.random() * 500)}`,
      airline: "Swiss Sample",
      airline_code: "LX",
      aircraft_type: "CS3",
      direction: "arrival",
      gate: "G1",
      stand: "G08",
      from_airport: "ZRH",
      to_airport: airport,
      airport,
      description: `Ankunft aus Zürich ${makeTimeLabel(-18)}.`,
    },
    {
      flight_no: `DY${Math.floor(700 + Math.random() * 200)}`,
      airline: "Norwegian Sample",
      airline_code: "DY",
      aircraft_type: "B738",
      direction: "departure",
      gate: "C9",
      stand: "C25",
      from_airport: airport,
      to_airport: "OSL",
      airport,
      description: `Abflug nach Oslo ${makeTimeLabel(20)}.`,
    },
  ];

  return samples.slice(0, MAX_FLIGHT_SUGGESTIONS);
}

function computeFlightStats(flights) {
  if (!Array.isArray(flights) || !flights.length) {
    return {
      count: 0,
      topAirline: "",
      windowMinutes: FLIGHT_TIME_WINDOW_MIN,
    };
  }

  const airlineCounts = flights.reduce((acc, flight) => {
    const airlineKey = flight.airline || flight.airline_code || "Unbekannte Airline";
    acc[airlineKey] = (acc[airlineKey] || 0) + 1;
    return acc;
  }, {});

  const [topAirline, topCount] = Object.entries(airlineCounts).sort((a, b) => b[1] - a[1])[0] || ["", 0];

  return {
    count: flights.length,
    topAirline: topAirline ? `${topAirline} (${topCount})` : "",
    windowMinutes: FLIGHT_TIME_WINDOW_MIN,
  };
}

function applyFlightSelection(flight) {
  const flightFields = [
    ["flight_no", flight.flight_no],
    ["airline_code", flight.airline_code],
    ["aircraft_type", flight.aircraft_type],
    ["direction", flight.direction],
    ["gate", flight.gate],
    ["stand", flight.stand],
    ["from_airport", flight.from_airport],
    ["to_airport", flight.to_airport],
    ["airport", flight.airport],
  ];
  flightFields.forEach(([field, value]) => {
    if (value) {
      setCurrentFlight(field, value);
    }
  });

  state = {
    ...state,
    flightDetailsEditable: false,
    lastAppliedFlight: {
      flight_no: flight.flight_no || state.currentFlight.flight_no || "",
      direction: flight.direction || state.currentFlight.direction || "",
      airport: flight.airport || state.currentFlight.airport || "",
      from_airport: flight.from_airport || "",
      to_airport: flight.to_airport || "",
      gate: flight.gate || "",
      stand: flight.stand || "",
      aircraft_type: flight.aircraft_type || "",
    },
  };
  persistState();
  renderApp();
  setFeedback(`Flug ${flight.flight_no || ""} übernommen.`);
}

function isAerodataboxRapidUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("aerodatabox.p.rapidapi.com");
  } catch (error) {
    console.warn("Konnte URL nicht parsen.", error);
    return false;
  }
}

async function fetchAerodataboxRapid({ airport, apiKey }) {
  if (!airport || !apiKey) return [];
  const params = new URLSearchParams({
    offsetMinutes: "-30",
    durationMinutes: String(FLIGHT_TIME_WINDOW_MIN * 2),
    withLeg: "true",
    direction: "Both",
    withCancelled: "false",
    withCodeshared: "true",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  const url = `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${airport}?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      "X-RapidAPI-Key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`AeroDataBox RapidAPI Fehler ${response.status}`);
  }

  const data = await response.json();
  const mapFlights = (list, direction) =>
    (list || []).map((entry) => mapRapidApiFlight(entry, direction, airport));

  return [...mapFlights(data?.arrivals, "arrival"), ...mapFlights(data?.departures, "departure")];
}

function mapRapidApiFlight(entry, direction, airport) {
  const movement = entry?.movement || {};
  const counterpartAirport = movement?.airport?.iata || movement?.airport?.icao || "";
  const scheduledLocal = movement?.scheduledTimeLocal || movement?.timeLocal || "";
  const readableTime = scheduledLocal
    ? new Date(scheduledLocal).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const timeLabel = readableTime ? `, geplant ${readableTime}` : "";
  const baseAirport = direction === "arrival" ? airport : counterpartAirport || airport;
  const otherAirport = direction === "arrival" ? counterpartAirport : airport;

  return {
    flight_no: entry?.number || "",
    airline: entry?.airline?.name || "",
    airline_code: entry?.airline?.iata || entry?.airline?.icao || "",
    aircraft_type: entry?.aircraft?.model || entry?.aircraft?.iata || entry?.aircraft?.icao || "",
    direction,
    gate: movement?.gate || "",
    stand: "",
    airport,
    from_airport: direction === "arrival" ? counterpartAirport : airport,
    to_airport: direction === "departure" ? counterpartAirport : airport,
    description:
      direction === "arrival"
        ? `Anflug ${baseAirport} aus ${otherAirport || "Unbekannt"}${timeLabel}.`
        : `Abflug ${otherAirport} nach ${baseAirport || "Unbekannt"}${timeLabel}.`,
  };
}

async function fetchFlightSuggestions(options = {}) {
  const { source = "manual" } = options;
  if (!state.currentFlight.airport) {
    setFeedback("Bitte zuerst einen Airport setzen.");
    return;
  }

  state = {
    ...state,
    flightSuggestionStatus: source === "auto" ? "loading_auto" : "loading",
    flightSuggestionError: "",
    flightSuggestionSource: "unknown",
    flightSuggestionAnalysis: "",
    flightSuggestionStats: { count: 0, topAirline: "", windowMinutes: FLIGHT_TIME_WINDOW_MIN },
    flightPickerOpen: false,
  };
  persistState();
  renderApp();

  const now = Math.floor(Date.now() / 1000);
  const start = now - FLIGHT_TIME_WINDOW_MIN * 60;
  const end = now + FLIGHT_TIME_WINDOW_MIN * 60;

  const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
  const defaultApiUrl = getDefaultFlightApiUrl();
  const config = {
    url: state.flightApiConfig?.url || windowApiConfig.url || defaultApiUrl || "",
    apiKey: state.flightApiConfig?.apiKey || windowApiConfig.apiKey || "",
  };

  const hasRapidApiKey = Boolean(config.apiKey);
  const hasCustomApiUrl = Boolean(config.url && (!defaultApiUrl || config.url !== defaultApiUrl));
  const pointsToRapidHost = isAerodataboxRapidUrl(config.url);
  const shouldForceRapidPath = pointsToRapidHost && hasRapidApiKey;
  let flights = [];
  let status = "idle";
  let errorMessage = "";
  let sourceLabel = "api";
  let analysis = "";

  if (!config.url && !config.apiKey) {
    flights = buildSampleFlights(state.currentFlight.airport);
    sourceLabel = "sample";
    analysis = `Samples genutzt – max. ${MAX_FLIGHT_SUGGESTIONS} Flüge.`;
  } else if (config?.url && (hasCustomApiUrl || !hasRapidApiKey) && !shouldForceRapidPath) {
    try {
      const params = new URLSearchParams({
        airport: state.currentFlight.airport,
        start: new Date(start * 1000).toISOString(),
        end: new Date(end * 1000).toISOString(),
        direction: state.currentFlight.direction || "both",
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
      analysis = flights.length
        ? `API ok: ${flights.length} Flüge im ±${FLIGHT_TIME_WINDOW_MIN} Min Fenster.`
        : `API ohne Treffer – Zeitraum/Airport prüfen.`;
    } catch (error) {
      console.warn("Konnte Flug-API nicht laden.", error);
      flights = buildSampleFlights(state.currentFlight.airport);
      status = "idle";
      errorMessage = "";
      sourceLabel = "sample_fallback";
      analysis = `API-Fehler: ${error.message || "unbekannt"}. Samples angezeigt.`;
    }
  } else if (hasRapidApiKey) {
    try {
      const rapidNote = shouldForceRapidPath
        ? "AeroDataBox RapidAPI erkannt. "
        : "";
      flights = await fetchAerodataboxRapid({ airport: state.currentFlight.airport, apiKey: config.apiKey });
      analysis = flights.length
        ? `${rapidNote}${flights.length} Flüge über RapidAPI.`
        : `${rapidNote}Keine Flüge über RapidAPI.`;
    } catch (error) {
      flights = buildSampleFlights(state.currentFlight.airport);
      status = "idle";
      errorMessage = "";
      sourceLabel = "sample_fallback";
      analysis = `RapidAPI-Fehler: ${error.message || "unbekannt"}. Samples angezeigt.`;
    }
  } else {
    flights = buildSampleFlights(state.currentFlight.airport);
    status = "idle";
    errorMessage = "";
    sourceLabel = "sample_fallback";
    analysis = "API nicht nutzbar – Samples geladen.";
  }

  if (!flights.length) {
    flights = buildSampleFlights(state.currentFlight.airport);
    sourceLabel = "sample_fallback";
    analysis = analysis ? `${analysis} Samples hinzugefügt.` : "Samples geladen.";
    status = "idle";
    errorMessage = "";
  }

  const finalFlights = flights.slice(0, MAX_FLIGHT_SUGGESTIONS);
  const noFlightsFound = finalFlights.length === 0;

  if (noFlightsFound && status !== "error") {
    status = "error";
    errorMessage = `Keine Flüge für ${state.currentFlight.airport} im ±${FLIGHT_TIME_WINDOW_MIN} Min Fenster.`;
    sourceLabel = "api_error";
  }

  state = {
    ...state,
    flightSuggestions: finalFlights,
    flightSuggestionStatus: status,
    flightSuggestionError: errorMessage,
    flightSuggestionSource: sourceLabel,
    flightSuggestionAnalysis: analysis || `Zeitraum: ±${FLIGHT_TIME_WINDOW_MIN} Minuten.`,
    flightSuggestionStats: computeFlightStats(finalFlights),
    flightPickerOpen: false,
  };
  persistState();
  renderApp();
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
  hint.textContent = "Kontext kompakt erfassen.";
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
  textarea.placeholder = "Kurze Notizen";
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
    ? `Prozesse für ${activeDirection === "arrival" ? "Arrival" : "Departure"}`
    : "Start/Ende je Prozess";

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
  hint.textContent = "Aktive Prozesse pulsen, abgeschlossene wandern in die Historie.";

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

function renderStartScreen(container) {
  applyStartMode(true);
  container.innerHTML = "";

  const screen = document.createElement("div");
  screen.className = "start-screen";

  const button = document.createElement("button");
  button.className = "start-button";
  button.type = "button";
  button.textContent = "Start";
  button.addEventListener("click", () => handleStart());

  screen.appendChild(button);
  container.appendChild(screen);
}

function handleStart() {
  const defaultAirport = state.currentFlight.airport || "MUC";
  state = {
    ...state,
    started: true,
    currentFlight: { ...DEFAULT_STATE.currentFlight, airport: defaultAirport },
    flightSuggestions: [],
    flightSuggestionStatus: "idle",
    flightSuggestionError: "",
    flightSuggestionSource: "unknown",
    flightSuggestionAnalysis: "",
    flightSuggestionStats: { count: 0, topAirline: "", windowMinutes: FLIGHT_TIME_WINDOW_MIN },
    precheckCompleted: false,
    flightDetailsEditable: false,
    flightPickerOpen: false,
    autoFetchedAfterStart: false,
  };
  persistState();
  applyStartMode(false);
  renderApp();
}

function renderApp() {
  const app = document.getElementById("app");
  if (!state.started) {
    renderStartScreen(app);
    return;
  }

  applyStartMode(false);
  app.innerHTML = "";
  if (!state.precheckCompleted) {
    renderPrecheckScreen(app);
    return;
  }
  renderFlightDetails(app);
  renderStatusRail(app);
  renderFlightSuggestions(app);
  renderDropdowns(app);
  renderProcessCards(app);
  renderSessionControls(app);
  renderLogPanel(app);
}

function renderStatusRail(container) {
  const existing = document.getElementById("status-rail");
  if (existing) existing.remove();

  const rail = document.createElement("div");
  rail.id = "status-rail";
  rail.className = "status-rail card";

  const activeCount = Object.keys(state.activeProcesses || {}).length;
  const completedCount = state.completedProcesses?.length || 0;

  const items = [
    {
      label: "Flug",
      value: state.currentFlight.flight_no || "nicht gesetzt",
      hint: state.currentFlight.direction
        ? state.currentFlight.direction === "arrival"
          ? "Arrival"
          : "Departure"
        : "Bitte Richtung wählen",
    },
    {
      label: "Aktiv",
      value: activeCount,
      hint: "laufende Prozesse",
    },
    {
      label: "Abgeschlossen",
      value: completedCount,
      hint: "heute dokumentiert",
    },
    {
      label: "Events",
      value: state.events.length,
      hint: "Session-Einträge",
    },
  ];

  items.forEach((item) => {
    const block = document.createElement("div");
    block.className = "status-item";

    const label = document.createElement("span");
    label.className = "status-label";
    label.textContent = item.label;

    const value = document.createElement("div");
    value.className = "status-value";
    value.textContent = item.value;

    const hint = document.createElement("span");
    hint.className = "status-hint";
    hint.textContent = item.hint;

    block.appendChild(label);
    block.appendChild(value);
    block.appendChild(hint);
    rail.appendChild(block);
  });

  const firstCard = container.firstChild;
  if (firstCard && firstCard.nextSibling) {
    container.insertBefore(rail, firstCard.nextSibling);
  } else {
    container.appendChild(rail);
  }
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
  const event = addEvent({
    process_code: process.code,
    process_label: process.label,
    event_type: action,
    ...values,
  });

  if (!event) return;

  if (action === "start") {
    setActiveProcess(process.code, event.start_time_abs);
  } else if (action === "end") {
    clearActiveProcess(process.code, event.end_time_abs);
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
  populateLog();
  updateSessionSummary();
  setFeedback("");
});
