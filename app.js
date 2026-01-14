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
const AERODATABOX_RAPID_BASE_URL = "https://aerodatabox.p.rapidapi.com";

const FLIGHT_TIME_WINDOW_MIN = 30;
const MAX_FLIGHT_SUGGESTIONS = 10;
const NEAREST_AIRPORT_MAX_DISTANCE_KM = 100;
const LOCATION_RETRY_DELAY_MS = 5000;
const FLIGHT_COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#f43f5e", "#14b8a6", "#eab308", "#6366f1"];

function buildAerodataboxRapidUrl(airportCode) {
  const airport = (airportCode || "").trim().toUpperCase();

  if (!airport) {
    return `${AERODATABOX_RAPID_BASE_URL}/flights/airports/iata/`;
  }

  const params = new URLSearchParams({
    offsetMinutes: "-15",
    durationMinutes: "30",
    withLeg: "true",
    direction: "Both",
    withCancelled: "false",
    withCodeshared: "true",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "true",
  });

  return `${AERODATABOX_RAPID_BASE_URL}/flights/airports/iata/${airport}?${params.toString()}`;
}

const DEFAULT_FLIGHT = {
  flight_no: "",
  direction: "",
  stand: "",
  gate: "",
  airport: "MUC",
  from_airport: "",
  to_airport: "",
  airline_code: "",
  aircraft_type: "",
  color: "",
};

const DEFAULT_STATE = {
  started: false,
  flightPickerOpen: false,
  flightDetailsEditable: false,
  lastAppliedFlight: null,
  endConfirmation: null,
  flightContexts: {},
  pinnedFlights: [],
  activeFlightId: "",
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
  flightSuggestionQuery: "",
  flightSuggestionStats: {
    count: 0,
    topAirline: "",
    windowMinutes: FLIGHT_TIME_WINDOW_MIN,
  },
  flightApiConfig: {
    url: AERODATABOX_RAPID_BASE_URL,
    apiKey: "",
  },
  autoFetchedAfterStart: false,
  logFilters: {
    flights: [],
    eventType: "",
    process: "",
  },
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

const EVENT_TYPE_LABELS = {
  start: "Start",
  end: "Ende",
  instance: "Instanz",
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

function getDefaultFlightDate() {
  return new Date().toISOString().slice(0, 10);
}

function deriveFlightColor(flight) {
  const key = [flight.flight_no, flight.airline_code, flight.from_airport, flight.to_airport, flight.airport]
    .join("")
    .trim();
  if (!key) return FLIGHT_COLORS[0];
  const hash = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FLIGHT_COLORS[hash % FLIGHT_COLORS.length];
}

function getFlightColor(flight) {
  return flight?.color || deriveFlightColor(flight || {});
}

function createFlightColorDot(color, extraClass = "") {
  const dot = document.createElement("span");
  dot.className = `flight-color-dot${extraClass ? ` ${extraClass}` : ""}`;
  dot.style.backgroundColor = color;
  return dot;
}

function normalizeFlight(flight) {
  const merged = { ...DEFAULT_FLIGHT, ...(flight || {}) };
  return {
    ...merged,
    airport: (merged.airport || "").toUpperCase(),
    from_airport: (merged.from_airport || "").toUpperCase(),
    to_airport: (merged.to_airport || "").toUpperCase(),
    airline_code: (merged.airline_code || "").toUpperCase(),
    aircraft_type: (merged.aircraft_type || "").toUpperCase(),
    color: merged.color || deriveFlightColor(merged),
  };
}

function sanitizeIdPart(value) {
  return String(value || "UNK")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function buildFlightId(flight, flightDate) {
  const datePart = sanitizeIdPart(flightDate).replace(/-/g, "_");
  const parts = [flight.airport, flight.flight_no, datePart, flight.direction].map((part) =>
    sanitizeIdPart(part)
  );
  return parts.join("_");
}

function buildFlightContext({ flight, flightDate, existingContext = {} }) {
  const normalizedFlight = normalizeFlight(flight);
  const resolvedDate = flightDate || existingContext.flightDate || getDefaultFlightDate();
  const flightId = buildFlightId(normalizedFlight, resolvedDate);
  return {
    flight: normalizedFlight,
    flightDate: resolvedDate,
    flightId,
    turnaroundId: flightId,
    activeProcesses: existingContext.activeProcesses || {},
    completedProcesses: existingContext.completedProcesses || [],
    events: existingContext.events || [],
  };
}

function normalizeActiveProcesses(activeProcesses) {
  return Object.fromEntries(
    Object.entries(activeProcesses || {}).map(([code, value]) => {
      const label = PROCESS_CODES.find((entry) => entry.code === code)?.label || code;
      if (value && typeof value === "object") return [code, { label, ...value }];
      return [code, { startedAt: value, label }];
    })
  );
}

function normalizeCompletedProcesses(completedProcesses) {
  return Array.isArray(completedProcesses)
    ? completedProcesses.map((entry) => ({
        ...entry,
        label: entry.label || PROCESS_CODES.find((item) => item.code === entry.code)?.label || entry.code,
      }))
    : [];
}

function deriveFlightDateFromEvents(events) {
  const entry = Array.isArray(events) && events.length ? events[0] : null;
  const timestamp = entry?.start_time_abs || entry?.event_timestamp || "";
  return timestamp ? String(timestamp).slice(0, 10) : getDefaultFlightDate();
}

function getActiveFlightContext() {
  return state.flightContexts?.[state.activeFlightId];
}

function getActiveFlight() {
  return getActiveFlightContext()?.flight || DEFAULT_FLIGHT;
}

function ensureActiveFlightContext() {
  const active = getActiveFlightContext();
  if (active) return { id: state.activeFlightId, context: active };
  const freshContext = buildFlightContext({ flight: DEFAULT_FLIGHT });
  state = {
    ...state,
    flightContexts: { ...state.flightContexts, [freshContext.flightId]: freshContext },
    activeFlightId: freshContext.flightId,
  };
  return { id: freshContext.flightId, context: freshContext };
}

function updateActiveFlightContext(flightUpdates, options = {}) {
  const { trackSuggestion, persistNow, deferPersist } = options;
  const { id: activeId, context } = ensureActiveFlightContext();
  const updatedFlight = normalizeFlight({ ...context.flight, ...flightUpdates });
  const updatedContext = buildFlightContext({
    flight: updatedFlight,
    flightDate: context.flightDate,
    existingContext: context,
  });
  const nextId = updatedContext.flightId;
  const updatedContexts = { ...state.flightContexts };
  const hasActivity =
    (context.events?.length || 0) > 0 ||
    Object.keys(context.activeProcesses || {}).length > 0 ||
    (context.completedProcesses?.length || 0) > 0;
  const shouldPreserveContext = nextId !== activeId && hasActivity;
  const baseContext = shouldPreserveContext
    ? buildFlightContext({ flight: updatedFlight, flightDate: context.flightDate })
    : updatedContext;
  if (!shouldPreserveContext) delete updatedContexts[activeId];
  const existingTarget = nextId !== activeId ? state.flightContexts[nextId] : null;
  updatedContexts[nextId] = existingTarget
    ? {
        ...baseContext,
        activeProcesses: { ...existingTarget.activeProcesses, ...baseContext.activeProcesses },
        completedProcesses: [...baseContext.completedProcesses, ...existingTarget.completedProcesses],
        events: [...baseContext.events, ...existingTarget.events],
      }
    : baseContext;

  const updatedPinned = state.pinnedFlights.map((id) => (id === activeId ? nextId : id));
  state = {
    ...state,
    flightContexts: updatedContexts,
    activeFlightId: nextId,
    ...(trackSuggestion ? { lastAirportSuggestion: updatedFlight.airport || "" } : {}),
  };

  if (updatedFlight.airport && flightUpdates.airport !== undefined) {
    state = {
      ...state,
      flightApiConfig: { ...state.flightApiConfig, url: buildAerodataboxRapidUrl(updatedFlight.airport) },
    };
  }

  state = {
    ...state,
    pinnedFlights: updatedPinned,
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
  if (continueButton) continueButton.disabled = !updatedFlight.airport || !updatedFlight.flight_no;
  if (updatedFlight.airport) {
    const airportError = document.getElementById("precheck-airport-error");
    const airportInput = document.getElementById("precheck-airport");
    if (airportError) airportError.style.display = "none";
    if (airportInput) airportInput.classList.remove("has-error");
  }
}

function setActiveFlightId(flightId) {
  if (!flightId || !state.flightContexts?.[flightId]) return;
  state = { ...state, activeFlightId: flightId, endConfirmation: null };
  persistState();
  renderApp();
}

function pinFlightContext(flight) {
  const flightDate = getDefaultFlightDate();
  const context = buildFlightContext({ flight, flightDate });
  const exists = state.flightContexts[context.flightId];
  const nextApiConfig = context.flight.airport
    ? { ...state.flightApiConfig, url: buildAerodataboxRapidUrl(context.flight.airport) }
    : state.flightApiConfig;
  const nextContexts = {
    ...state.flightContexts,
    [context.flightId]: exists ? { ...exists, flight: context.flight } : context,
  };
  const pinned = state.pinnedFlights.includes(context.flightId)
    ? state.pinnedFlights
    : [...state.pinnedFlights, context.flightId];
  state = {
    ...state,
    flightContexts: nextContexts,
    pinnedFlights: pinned,
    activeFlightId: context.flightId,
    flightApiConfig: nextApiConfig,
  };
  persistState();
  renderApp();
}

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
  return AERODATABOX_RAPID_BASE_URL;
}

function loadFlightApiConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_API);
    const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          url: parsed.url || windowApiConfig.url || AERODATABOX_RAPID_BASE_URL,
          apiKey: parsed.apiKey || windowApiConfig.apiKey || "",
        };
      }
    }
  } catch (error) {
    console.warn("Konnte API-Config nicht laden.", error);
  }
  return { url: AERODATABOX_RAPID_BASE_URL, apiKey: "" };
}

function persistFlightApiConfig(config) {
  try {
    localStorage.setItem(
      STORAGE_KEY_API,
      JSON.stringify({
        url: config?.url || AERODATABOX_RAPID_BASE_URL,
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
        const suggestionList = Array.isArray(parsed.flightSuggestions) ? parsed.flightSuggestions : [];
        const hasContexts = parsed.flightContexts && typeof parsed.flightContexts === "object";
        const normalizedContexts = hasContexts
          ? Object.fromEntries(
              Object.entries(parsed.flightContexts).map(([key, context]) => {
                const normalizedContext = buildFlightContext({
                  flight: context?.flight || DEFAULT_FLIGHT,
                  flightDate: context?.flightDate || deriveFlightDateFromEvents(context?.events),
                  existingContext: {
                    activeProcesses: normalizeActiveProcesses(context?.activeProcesses),
                    completedProcesses: normalizeCompletedProcesses(context?.completedProcesses),
                    events: Array.isArray(context?.events) ? context.events : [],
                  },
                });
                return [key || normalizedContext.flightId, normalizedContext];
              })
            )
          : {};

        const legacyFlight = normalizeFlight(parsed.currentFlight || DEFAULT_FLIGHT);
        const legacyEvents = Array.isArray(parsed.events) ? parsed.events : [];
        const legacyContext = buildFlightContext({
          flight: legacyFlight,
          flightDate: deriveFlightDateFromEvents(legacyEvents),
          existingContext: {
            activeProcesses: normalizeActiveProcesses(parsed.activeProcesses),
            completedProcesses: normalizeCompletedProcesses(parsed.completedProcesses),
            events: legacyEvents,
          },
        });

        const mergedContexts = hasContexts ? normalizedContexts : { [legacyContext.flightId]: legacyContext };
        const normalizedPinned = Array.isArray(parsed.pinnedFlights)
          ? parsed.pinnedFlights.filter((id) => mergedContexts[id])
          : legacyFlight.flight_no || legacyEvents.length
            ? [legacyContext.flightId]
            : [];
        const activeId =
          (parsed.activeFlightId && mergedContexts[parsed.activeFlightId] && parsed.activeFlightId) ||
          normalizedPinned[0] ||
          Object.keys(mergedContexts)[0] ||
          "";

        return {
          ...DEFAULT_STATE,
          ...parsed,
          started: parsed.started ?? DEFAULT_STATE.started,
          flightPickerOpen: parsed.flightPickerOpen ?? DEFAULT_STATE.flightPickerOpen,
          flightDetailsEditable: parsed.flightDetailsEditable ?? DEFAULT_STATE.flightDetailsEditable,
          lastAppliedFlight: parsed.lastAppliedFlight ?? DEFAULT_STATE.lastAppliedFlight,
          flightContexts: mergedContexts,
          pinnedFlights: normalizedPinned,
          activeFlightId: activeId,
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
            url: storedApiConfig.url || parsed.flightApiConfig?.url || windowApiConfig.url || AERODATABOX_RAPID_BASE_URL,
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
      url: fallbackApiConfig.url || windowApiConfig.url || AERODATABOX_RAPID_BASE_URL,
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
  const { context } = ensureActiveFlightContext();
  if (!(field in context.flight)) return;
  const normalizedValue = field === "airport" && typeof value === "string" ? value.toUpperCase() : value;
  updateActiveFlightContext({ [field]: normalizedValue }, options);
}

function setObserver(value) {
  state = { ...state, observer_id: value };
  persistStateDebounced();
}

function setFlightApiConfig(field, value) {
  if (!["url", "apiKey"].includes(field)) return;
  state = {
    ...state,
    flightApiConfig: {
      ...state.flightApiConfig,
      [field]: field === "url" ? value || AERODATABOX_RAPID_BASE_URL : value,
    },
  };
  persistStateDebounced();
}

function clearFlightApiConfig() {
  state = { ...state, flightApiConfig: { url: AERODATABOX_RAPID_BASE_URL, apiKey: "" } };
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
  const activeFlight = getActiveFlight();
  const airport = window.prompt("Bitte IATA-Code des Flughafens eingeben (z.B. MUC):", activeFlight.airport || "");
  if (airport != null && airport.trim()) {
    setCurrentFlight("airport", airport.trim().toUpperCase());
    const providedKey = window.prompt(
      "Bitte deinen AeroDataBox RapidAPI Key eingeben (wird lokal gespeichert):",
      state.flightApiConfig.apiKey || ""
    );
    if (providedKey != null && providedKey.trim()) {
      setFlightApiConfig("url", buildAerodataboxRapidUrl(airport));
      setFlightApiConfig("apiKey", providedKey.trim());
      setFeedback("Airport und RapidAPI Key gesetzt.");
    } else {
      setFeedback("Airport gesetzt. Kein RapidAPI Key hinterlegt.");
    }
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
  const activeFlight = getActiveFlight();
  if (!activeFlight.airport) {
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
  const { id: activeId, context } = ensureActiveFlightContext();
  state = {
    ...state,
    flightContexts: {
      ...state.flightContexts,
      [activeId]: {
        ...context,
        activeProcesses: {
          ...context.activeProcesses,
          [processCode]: { startedAt: startedAt ?? new Date().toISOString(), label: processMeta?.label ?? processCode },
        },
      },
    },
  };
  persistState();
  const app = document.getElementById("app");
  if (app) renderProcessCards(app);
  renderProcessVisualization();
}

function clearActiveProcess(processCode, endTime) {
  const { id: activeId, context } = ensureActiveFlightContext();
  const active = context.activeProcesses?.[processCode];
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

  const { [processCode]: _removed, ...rest } = context.activeProcesses;
  state = {
    ...state,
    flightContexts: {
      ...state.flightContexts,
      [activeId]: {
        ...context,
        activeProcesses: rest,
        completedProcesses: [completedEntry, ...context.completedProcesses].slice(0, 30),
      },
    },
  };
  persistState();
  const app = document.getElementById("app");
  if (app) renderProcessCards(app);
  renderProcessVisualization();
  return true;
}

function getMissingRequiredFields(eventPayload) {
  const missing = [];
  const activeFlight = getActiveFlight();

  const flightNo = eventPayload.flight_no ?? activeFlight.flight_no;
  const direction = eventPayload.direction ?? activeFlight.direction;
  const airport = eventPayload.airport ?? activeFlight.airport;

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
  const activeContext = getActiveFlightContext();
  if (isEnd && !activeContext?.activeProcesses?.[eventPayload.process_code]) {
    setFeedback("Kein aktiver Prozess für diesen Abschluss gefunden.");
    return { valid: false };
  }

  return { valid: true };
}

function resolveEventTimes(eventPayload, eventTimestamp) {
  const isStart = eventPayload.event_type === "start";
  const isEnd = eventPayload.event_type === "end";
  const active = getActiveFlightContext()?.activeProcesses?.[eventPayload.process_code];
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
  const { context } = ensureActiveFlightContext();
  const activeFlight = context.flight;
  const { startTimeAbs, endTimeAbs } = resolveEventTimes(eventPayload, eventTimestamp);
  const durationMin = computeDurationMinutes(startTimeAbs, endTimeAbs);
  const timeSlot = computeTimeSlot(startTimeAbs);

  const disruptionFlag = eventPayload.disruption_flag ?? (eventPayload.disruption_type && eventPayload.disruption_type !== "none");
  const airportCode = (eventPayload.airport ?? activeFlight.airport ?? "").toUpperCase();
  const event = {
    log_id: `${new Date(eventTimestamp).getTime()}_${context.events.length + 1}`,
    flight_no: eventPayload.flight_no ?? activeFlight.flight_no ?? "",
    direction: eventPayload.direction ?? activeFlight.direction ?? "",
    airport: airportCode,
    from_airport: eventPayload.from_airport ?? activeFlight.from_airport ?? "",
    to_airport: eventPayload.to_airport ?? activeFlight.to_airport ?? "",
    airline_code: eventPayload.airline_code ?? activeFlight.airline_code ?? "",
    aircraft_type: eventPayload.aircraft_type ?? activeFlight.aircraft_type ?? "",
    stand: eventPayload.stand ?? activeFlight.stand ?? "",
    gate: eventPayload.gate ?? activeFlight.gate ?? "",
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
    time_of_instance_taking: eventPayload.time_of_instancetaking ?? eventTimestamp,
    observation_quality: eventPayload.observation_quality ?? "",
    location_latitude: eventPayload.location_latitude ?? state.location.latitude ?? "",
    location_longitude: eventPayload.location_longitude ?? state.location.longitude ?? "",
    location_accuracy_m: eventPayload.location_accuracy_m ?? state.location.accuracy ?? "",
    location_timestamp: eventPayload.location_timestamp ?? state.location.timestamp ?? "",
    quality_flag: airportCode ? "" : "missing_airport",
  };

  const turnaroundId = context.turnaroundId || buildFlightId(activeFlight, context.flightDate || getDefaultFlightDate());
  event.turnaround_id = turnaroundId;
  event.instance_id = `${turnaroundId}_${sanitizeIdPart(event.process_code)}_${context.events.length + 1}`;
  event.instance_fingerprint = buildInstanceFingerprint({
    turnaroundId,
    processCode: event.process_code,
    eventType: event.event_type,
    startTimeAbs,
    endTimeAbs,
  });

  return event;
}

function isDuplicateEvent(fingerprint, context) {
  const activeContext = context || getActiveFlightContext();
  return activeContext?.events?.some((existing) => existing.instance_fingerprint === fingerprint);
}

function addEvent(eventPayload) {
  const validation = validateEventPayload(eventPayload);
  if (!validation.valid) return false;

  const { id: activeId, context } = ensureActiveFlightContext();
  const now = new Date();
  const eventTimestamp = eventPayload.event_timestamp || now.toISOString();
  const event = buildEvent(eventPayload, eventTimestamp);

  if (isDuplicateEvent(event.instance_fingerprint, context)) {
    setFeedback("Event bereits protokolliert – kein erneuter Log.");
    return false;
  }

  state = {
    ...state,
    flightContexts: {
      ...state.flightContexts,
      [activeId]: { ...context, events: [...context.events, event] },
    },
  };
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
  const activeFlight = getActiveFlight();
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

  return fieldConfigs.filter((entry) => !activeFlight[entry.key]);
}

function syncFlightInputs() {
  const activeFlight = getActiveFlight();
  const mapping = [
    ["airport-code", activeFlight.airport],
    ["precheck-airport", activeFlight.airport],
    ["flight-no", activeFlight.flight_no],
    ["flight-stand", activeFlight.stand],
    ["flight-gate", activeFlight.gate],
    ["from-airport", activeFlight.from_airport],
    ["to-airport", activeFlight.to_airport],
    ["airline-code", activeFlight.airline_code],
    ["aircraft-type", activeFlight.aircraft_type],
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
  const activeFlight = getActiveFlight();
  const compactStatus = activeFlight.flight_no
    ? `${activeFlight.flight_no} · ${activeFlight.from_airport || "-"} → ${activeFlight.to_airport || "-"}`
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
      value: activeFlight.airport,
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
  fetchButton.disabled = !activeFlight.airport || isLoading;
  fetchButton.addEventListener("click", () => {
    if (!activeFlight.airport) {
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
  continueButton.disabled = !activeFlight.flight_no;
  continueButton.addEventListener("click", () => {
    const airportError = document.getElementById("precheck-airport-error");
    if (!activeFlight.airport) {
      if (airportError) airportError.style.display = "block";
      setPrecheckFeedback("Airport fehlt – bitte IATA-Code setzen.");
      return;
    }
    if (!activeFlight.flight_no) {
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
      const updatedFlight = getActiveFlight();
      if (continueBtn) continueBtn.disabled = !hasAirport || !updatedFlight.flight_no;
      const airportError = document.getElementById("precheck-airport-error");
      if (airportError) airportError.style.display = hasAirport ? "none" : airportError.style.display;
      airportInput.classList.toggle("has-error", !hasAirport && airportError?.style.display === "block");
    });
    airportInput.addEventListener("blur", (event) => {
      const value = event.target.value.toUpperCase().trim();
      setCurrentFlight("airport", value, { persistNow: true });
      const hasAirport = Boolean(value);
      const updatedFlight = getActiveFlight();
      if (continueBtn) continueBtn.disabled = !hasAirport || !updatedFlight.flight_no;
      const airportError = document.getElementById("precheck-airport-error");
      if (airportError) airportError.style.display = hasAirport ? "none" : airportError.style.display;
      airportInput.classList.toggle("has-error", !hasAirport && airportError?.style.display === "block");
      event.target.value = value;
    });
  }
}


function renderFlightDetails(container) {
  const { context } = ensureActiveFlightContext();
  const activeFlight = context.flight;

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

  const tabBar = document.createElement("div");
  tabBar.className = "flight-tab-bar";
  const tabLabel = document.createElement("div");
  tabLabel.className = "flight-tab-label";
  tabLabel.textContent = "Gepinnte Flüge";
  tabBar.appendChild(tabLabel);

  const tabList = document.createElement("div");
  tabList.className = "flight-tab-list";
  const pinnedIds = state.pinnedFlights.filter((id) => state.flightContexts[id]);
  if (!pinnedIds.length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "Noch keine Flüge gepinnt.";
    tabList.appendChild(empty);
  } else {
    pinnedIds.forEach((flightId) => {
      const pinnedContext = state.flightContexts[flightId];
      if (!pinnedContext) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `flight-tab-chip${flightId === state.activeFlightId ? " is-active" : ""}`;
      const directionLabel = pinnedContext.flight.direction
        ? pinnedContext.flight.direction === "arrival"
          ? "Arr"
          : "Dep"
        : "–";
      const chipDot = createFlightColorDot(getFlightColor(pinnedContext.flight));
      const chipText = document.createElement("span");
      chipText.textContent = `${pinnedContext.flight.flight_no || "Unbekannt"} · ${directionLabel}`;
      chip.appendChild(chipDot);
      chip.appendChild(chipText);
      chip.addEventListener("click", () => setActiveFlightId(flightId));
      tabList.appendChild(chip);
    });
  }
  tabBar.appendChild(tabList);
  panel.appendChild(tabBar);

  const summaryRow = document.createElement("div");
  summaryRow.className = "flight-summary-row";
  const summaryText = document.createElement("div");
  summaryText.className = "flight-summary-text";
  const applied = state.lastAppliedFlight;
  const hasFlight = Boolean(activeFlight.flight_no);
  summaryText.textContent = hasFlight
    ? `Aktiv: ${activeFlight.flight_no || "n/a"} · ${activeFlight.direction || "-"} · ${activeFlight.from_airport || "-"} → ${activeFlight.to_airport || "-"}`
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
      ["Flug", activeFlight.flight_no || "-"],
      ["Direction", activeFlight.direction || "-"],
      ["Route", `${activeFlight.from_airport || "-"} → ${activeFlight.to_airport || "-"}`],
      ["Gate/Stand", `Gate ${activeFlight.gate || "–"} · Stand ${activeFlight.stand || "–"}`],
      ["Airline", activeFlight.airline_code || "-"],
      ["Aircraft", activeFlight.aircraft_type || "-"],
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

  const showEditor = state.flightDetailsEditable || !activeFlight.flight_no;

  if (!showEditor && hasFlight) {
    const compact = document.createElement("div");
    compact.className = "flight-compact";
    compact.innerHTML = `
      <div><strong>Flug:</strong> ${activeFlight.flight_no || "-"} (${activeFlight.aircraft_type || "Type n/a"})</div>
      <div><strong>Route:</strong> ${activeFlight.from_airport || "-"} → ${activeFlight.to_airport || "-"} | Gate ${activeFlight.gate || "–"} | Stand ${activeFlight.stand || "–"}</div>
      <div><strong>Direction:</strong> ${activeFlight.direction || "–"} | Airport: ${activeFlight.airport || "-"}</div>
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
        value: activeFlight.airport,
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

    select.value = activeFlight.direction;
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
        value: activeFlight.flight_no,
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
        value: activeFlight.stand,
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
        value: activeFlight.gate,
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
        value: activeFlight.from_airport,
        placeholder: "z.B. FRA",
      })
    );

    observerRow.appendChild(
      createInputField({
        id: "to-airport",
        label: "To Airport (IATA, optional)",
        value: activeFlight.to_airport,
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
        value: activeFlight.airline_code,
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
        value: activeFlight.aircraft_type,
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

function getFlightSuggestionTimeMs(flight) {
  const rawTime =
    flight?.scheduled_time_local ||
    flight?.scheduledTimeLocal ||
    flight?.scheduled_time_utc ||
    flight?.scheduledTimeUtc ||
    "";
  if (!rawTime) return null;
  const parsed = Date.parse(rawTime);
  return Number.isNaN(parsed) ? null : parsed;
}

function getPreparedFlightSuggestions() {
  const query = (state.flightSuggestionQuery || "").trim().toLowerCase();
  const filterFields = ["flight_no", "gate", "stand", "from_airport", "to_airport"];
  const pinnedIds = new Set(state.pinnedFlights);
  const now = Date.now();

  return (state.flightSuggestions || [])
    .filter((flight) => {
      if (!query) return true;
      return filterFields.some((field) => String(flight?.[field] || "").toLowerCase().includes(query));
    })
    .sort((left, right) => {
      const leftContext = buildFlightContext({ flight: left, flightDate: getDefaultFlightDate() });
      const rightContext = buildFlightContext({ flight: right, flightDate: getDefaultFlightDate() });
      const leftPinned = pinnedIds.has(leftContext.flightId);
      const rightPinned = pinnedIds.has(rightContext.flightId);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

      const leftTime = getFlightSuggestionTimeMs(left);
      const rightTime = getFlightSuggestionTimeMs(right);
      const leftDiff = leftTime ? Math.abs(leftTime - now) : Number.POSITIVE_INFINITY;
      const rightDiff = rightTime ? Math.abs(rightTime - now) : Number.POSITIVE_INFINITY;
      if (leftDiff !== rightDiff) return leftDiff - rightDiff;

      return String(left.flight_no || "").localeCompare(String(right.flight_no || ""), "de", { numeric: true });
    });
}

function createFlightSuggestionGrid({ compact = false } = {}) {
  const flights = getPreparedFlightSuggestions().slice(0, MAX_FLIGHT_SUGGESTIONS);
  const list = document.createElement("div");
  list.id = "flight-suggestion-list";
  list.className = compact ? "compact-flight-grid" : "process-list";

  if (!state.flightSuggestions.length || !flights.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = state.flightSuggestions.length ? "Keine Treffer für den Filter." : "Noch keine Vorschläge geladen.";
    list.appendChild(empty);
    return list;
  }

  flights.forEach((flight) => {
    const card = document.createElement("div");
    card.className = compact ? "compact-flight-card" : "process-card";

    const header = document.createElement("div");
    header.className = compact ? "compact-flight-header" : "process-header";
    const heading = document.createElement("div");
    heading.className = "flight-heading";
    const colorDot = createFlightColorDot(getFlightColor(flight), "is-small");
    const chip = document.createElement("span");
    chip.className = "flight-chip";
    chip.textContent = flight.flight_no || "Unbekannt";
    const route = document.createElement("span");
    route.className = "flight-route";
    route.textContent = `${flight.from_airport || "-"} → ${flight.to_airport || "-"}`;
    heading.appendChild(colorDot);
    heading.appendChild(chip);
    heading.appendChild(route);
    const meta = document.createElement("div");
    meta.className = "flight-meta";
    meta.textContent = `${flight.direction ? (flight.direction === "arrival" ? "Arrival" : "Departure") : "–"} · ${
      flight.airline || "Airline n/a"
    }`;
    header.appendChild(heading);
    header.appendChild(meta);
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
    const previewContext = buildFlightContext({ flight, flightDate: getDefaultFlightDate() });
    const isActive = previewContext.flightId === state.activeFlightId;
    if (isActive) {
      card.classList.add("is-active");
      const activeBadge = document.createElement("span");
      activeBadge.className = "flight-active-badge";
      activeBadge.textContent = "Aktiv";
      heading.appendChild(activeBadge);
    }
    const applyButton = document.createElement("button");
    applyButton.className = "btn-start btn-small";
    applyButton.type = "button";
    applyButton.textContent = isActive ? "Aktiv" : "Flug auswählen";
    applyButton.disabled = isActive;
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
  const activeFlight = getActiveFlight();

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
  fetchButton.disabled = !activeFlight.airport || isLoading;
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
              : activeFlight.airport
                  ? `Airport ${activeFlight.airport} · ±${FLIGHT_TIME_WINDOW_MIN} Min · ${apiSource}`
                  : "Bitte Airport setzen und laden.";
  status.textContent = statusLabel;
  panel.appendChild(status);

  const filterRow = document.createElement("div");
  filterRow.className = "field-grid flight-filter-grid";
  filterRow.appendChild(
    createInputField({
      id: "flight-suggestion-filter",
      label: "Vorschläge filtern",
      value: state.flightSuggestionQuery,
      placeholder: "Flight-No, Gate, Stand, From, To",
    })
  );
  const filterInput = filterRow.querySelector("#flight-suggestion-filter");
  if (filterInput) {
    filterInput.addEventListener("input", (event) => {
      state = { ...state, flightSuggestionQuery: event.target.value };
      persistStateDebounced();
      const list = panel.querySelector("#flight-suggestion-list");
      const nextList = createFlightSuggestionGrid({ compact: true });
      if (list) {
        list.replaceWith(nextList);
      } else {
        panel.appendChild(nextList);
      }
    });
  }
  panel.appendChild(filterRow);

  const analysisNote = document.createElement("div");
  analysisNote.className = "card-hint";
  analysisNote.textContent = state.flightSuggestionAnalysis || "Noch nichts geladen.";
  panel.appendChild(analysisNote);

  const apiGrid = document.createElement("div");
  apiGrid.className = "field-grid flight-api-grid";

  const apiNote = document.createElement("div");
  apiNote.className = "card-hint";
  apiNote.textContent = `AeroDataBox RapidAPI wird automatisch mit dem gesetzten Airport genutzt (${state.flightApiConfig.url || AERODATABOX_RAPID_BASE_URL}). Bitte nur den persönlichen Key setzen.`;
  apiGrid.appendChild(apiNote);

  apiGrid.appendChild(
    createInputField({
      id: "flight-api-key",
      label: "RapidAPI Key (AeroDataBox, optional)",
      value: state.flightApiConfig.apiKey,
      placeholder: "wird als X-RapidAPI-Key gesendet",
    })
  );

  const apiKeyInput = apiGrid.querySelector("#flight-api-key");
  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", (event) => {
      setFlightApiConfig("apiKey", event.target.value.trim());
    });
  }

  const clearApiButton = document.createElement("button");
  clearApiButton.type = "button";
  clearApiButton.className = "btn-neutral ghost-btn";
  clearApiButton.textContent = "RapidAPI Key löschen";
  clearApiButton.disabled = !state.flightApiConfig.apiKey;
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
  const activeFlight = getActiveFlight();
  const now = new Date();
  const makeTimeLabel = (offsetMinutes) => {
    const target = new Date(now.getTime() + offsetMinutes * 60000);
    return target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const makeTimeIso = (offsetMinutes) => {
    const target = new Date(now.getTime() + offsetMinutes * 60000);
    return target.toISOString();
  };

  const samples = [
    {
      flight_no: `${activeFlight.airline_code || "LH"}${Math.floor(100 + Math.random() * 800)}`,
      airline: "Beispiel Airline",
      airline_code: activeFlight.airline_code || "LH",
      aircraft_type: "A20N",
      direction: activeFlight.direction || "departure",
      gate: "K5",
      stand: "G12",
      from_airport: airport,
      to_airport: "JFK",
      airport,
      scheduled_time_local: makeTimeIso(10),
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
      scheduled_time_local: makeTimeIso(-8),
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
      scheduled_time_local: makeTimeIso(2),
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
      scheduled_time_local: makeTimeIso(-12),
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
      scheduled_time_local: makeTimeIso(14),
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
      scheduled_time_local: makeTimeIso(18),
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
      scheduled_time_local: makeTimeIso(-4),
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
      scheduled_time_local: makeTimeIso(6),
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
      scheduled_time_local: makeTimeIso(-18),
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
      scheduled_time_local: makeTimeIso(20),
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
  const updates = Object.fromEntries(
    Object.entries({
      flight_no: flight.flight_no,
      airline_code: flight.airline_code,
      aircraft_type: flight.aircraft_type,
      direction: flight.direction,
      gate: flight.gate,
      stand: flight.stand,
      from_airport: flight.from_airport,
      to_airport: flight.to_airport,
      airport: flight.airport,
    }).filter(([, value]) => value)
  );
  updateActiveFlightContext(updates);

  state = {
    ...state,
    flightDetailsEditable: false,
    lastAppliedFlight: {
      flight_no: flight.flight_no || getActiveFlight().flight_no || "",
      direction: flight.direction || getActiveFlight().direction || "",
      airport: flight.airport || getActiveFlight().airport || "",
      from_airport: flight.from_airport || "",
      to_airport: flight.to_airport || "",
      gate: flight.gate || "",
      stand: flight.stand || "",
      aircraft_type: flight.aircraft_type || "",
      color: flight.color || deriveFlightColor(flight),
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
  const url = buildAerodataboxRapidUrl(airport);
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
    scheduled_time_local: scheduledLocal,
    description:
      direction === "arrival"
        ? `Anflug ${baseAirport} aus ${otherAirport || "Unbekannt"}${timeLabel}.`
        : `Abflug ${otherAirport} nach ${baseAirport || "Unbekannt"}${timeLabel}.`,
  };
}

async function fetchFlightSuggestions(options = {}) {
  const { source = "manual" } = options;
  const activeFlight = getActiveFlight();
  if (!activeFlight.airport) {
    setFeedback("Bitte zuerst einen Airport setzen.");
    return;
  }

  const requestUrl = buildAerodataboxRapidUrl(activeFlight.airport);

  state = {
    ...state,
    flightSuggestionStatus: source === "auto" ? "loading_auto" : "loading",
    flightSuggestionError: "",
    flightSuggestionSource: "unknown",
    flightSuggestionAnalysis: "",
    flightSuggestionStats: { count: 0, topAirline: "", windowMinutes: FLIGHT_TIME_WINDOW_MIN },
    flightPickerOpen: false,
    flightApiConfig: { ...state.flightApiConfig, url: requestUrl },
  };
  persistState();
  renderApp();

  const now = Math.floor(Date.now() / 1000);
  const start = now - FLIGHT_TIME_WINDOW_MIN * 60;
  const end = now + FLIGHT_TIME_WINDOW_MIN * 60;

  const windowApiConfig = typeof window !== "undefined" ? window.flightApiConfig || {} : {};
  const config = {
    url: requestUrl || AERODATABOX_RAPID_BASE_URL,
    apiKey: state.flightApiConfig?.apiKey || windowApiConfig.apiKey || "",
  };

  const hasRapidApiKey = Boolean(config.apiKey);
  let flights = [];
  let status = "idle";
  let errorMessage = "";
  let sourceLabel = "api";
  let analysis = "";

  if (!hasRapidApiKey) {
    flights = buildSampleFlights(activeFlight.airport);
    sourceLabel = "sample";
    analysis = "Bitte RapidAPI Key setzen, um Live-Flüge zu laden.";
  } else {
    try {
      flights = await fetchAerodataboxRapid({ airport: activeFlight.airport, apiKey: config.apiKey });
      analysis = flights.length
        ? `${flights.length} Flüge über RapidAPI geladen.`
        : "Keine Flüge über RapidAPI gefunden.";
    } catch (error) {
      flights = buildSampleFlights(activeFlight.airport);
      status = "idle";
      errorMessage = "";
      sourceLabel = "sample_fallback";
      analysis = `RapidAPI-Fehler: ${error.message || "unbekannt"}. Samples angezeigt.`;
    }
  }

  if (!flights.length) {
    flights = buildSampleFlights(activeFlight.airport);
    sourceLabel = "sample_fallback";
    analysis = analysis ? `${analysis} Samples hinzugefügt.` : "Samples geladen.";
    status = "idle";
    errorMessage = "";
  }

  const finalFlights = flights.slice(0, MAX_FLIGHT_SUGGESTIONS);
  const noFlightsFound = finalFlights.length === 0;

  if (noFlightsFound && status !== "error") {
    status = "error";
    errorMessage = `Keine Flüge für ${activeFlight.airport} im ±${FLIGHT_TIME_WINDOW_MIN} Min Fenster.`;
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
  const activeContext = getActiveFlightContext();
  summary.textContent = `${activeContext?.events?.length || 0} Events protokolliert`;

  header.appendChild(title);
  header.appendChild(summary);

  const actions = document.createElement("div");
  actions.className = "button-row";

  const exportButton = document.createElement("button");
  exportButton.id = "export-button";
  exportButton.className = "btn-export";
  exportButton.textContent = "CSV Export";
  exportButton.disabled = !(getExportEntries().length > 0);
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
  const { id: activeId, context: activeContext } = ensureActiveFlightContext();
  const activeFlight = activeContext?.flight || DEFAULT_FLIGHT;
  const flightNumberLabel = activeFlight.flight_no || "Flug";
  const directionLabel = activeFlight.direction ? (activeFlight.direction === "arrival" ? "ARR" : "DEP") : "–";
  const gateLabel = activeFlight.gate ? `Gate ${activeFlight.gate}` : "Gate –";
  const standLabel = activeFlight.stand ? `Stand ${activeFlight.stand}` : "Stand –";
  const gateStand = `${gateLabel} / ${standLabel}`;
  const aircraftLabel = activeFlight.aircraft_type ? activeFlight.aircraft_type : "Typ –";
  const routeLabel = (() => {
    if (!activeFlight.direction) {
      if (activeFlight.from_airport || activeFlight.to_airport) {
        return `${activeFlight.from_airport || "–"} → ${activeFlight.to_airport || "–"}`;
      }
      return "";
    }
    if (activeFlight.direction === "arrival") {
      return `${activeFlight.from_airport || "–"} → ${activeFlight.airport || "–"}`;
    }
    return `${activeFlight.airport || "–"} → ${activeFlight.to_airport || "–"}`;
  })();

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
  const activeDirection = activeFlight.direction;
  helper.textContent = activeDirection
    ? `Prozesse für ${activeDirection === "arrival" ? "Arrival" : "Departure"}`
    : "Start/Ende je Prozess";

  header.appendChild(title);
  header.appendChild(helper);
  panel.appendChild(header);

  const contextHeader = document.createElement("div");
  contextHeader.className = "process-context-header";
  const contextMain = document.createElement("div");
  contextMain.className = "process-context-main";

  const activeDot = createFlightColorDot(getFlightColor(activeFlight));
  const contextTitle = document.createElement("span");
  contextTitle.className = "process-context-title";
  contextTitle.textContent = "Aktiver Flug";
  const contextValue = document.createElement("span");
  contextValue.className = "process-context-value";
  contextValue.textContent = `${activeFlight.flight_no || "nicht gesetzt"} · ${directionLabel} · ${gateStand} · ${aircraftLabel}`;

  contextMain.appendChild(activeDot);
  contextMain.appendChild(contextTitle);
  contextMain.appendChild(contextValue);
  contextHeader.appendChild(contextMain);

  if (state.lastAppliedFlight?.flight_no) {
    const lastRow = document.createElement("div");
    lastRow.className = "process-context-secondary";
    const lastDot = createFlightColorDot(getFlightColor(state.lastAppliedFlight));
    const lastLabel = document.createElement("span");
    lastLabel.className = "process-context-secondary-label";
    lastLabel.textContent = "Zuletzt geloggt";
    const lastValue = document.createElement("span");
    lastValue.className = "process-context-secondary-value";
    const lastDirection = state.lastAppliedFlight.direction
      ? state.lastAppliedFlight.direction === "arrival"
        ? "ARR"
        : "DEP"
      : "–";
    lastValue.textContent = `${state.lastAppliedFlight.flight_no || "n/a"} · ${lastDirection}`;
    lastRow.appendChild(lastDot);
    lastRow.appendChild(lastLabel);
    lastRow.appendChild(lastValue);
    contextHeader.appendChild(lastRow);
  }

  panel.appendChild(contextHeader);

  const banner = document.createElement("div");
  banner.className = "process-context-banner";
  const bannerMain = document.createElement("div");
  bannerMain.className = "process-context-banner-main";
  const bannerDot = createFlightColorDot(getFlightColor(activeFlight), "is-small");
  const bannerLabel = document.createElement("span");
  bannerLabel.className = "process-context-banner-label";
  bannerLabel.textContent = "Aktiver Flug";
  const bannerValue = document.createElement("span");
  bannerValue.className = "process-context-banner-value";
  bannerValue.textContent = `${flightNumberLabel} · ${directionLabel} · ${gateStand} · ${aircraftLabel}`;
  bannerMain.appendChild(bannerDot);
  bannerMain.appendChild(bannerLabel);
  bannerMain.appendChild(bannerValue);
  banner.appendChild(bannerMain);
  panel.appendChild(banner);

  const list = document.createElement("div");
  list.className = "process-list";

  const visibleProcesses = activeFlight.direction
    ? PROCESS_CODES.filter((process) => process.directions?.includes(activeFlight.direction))
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

      const isActive = Boolean(activeContext?.activeProcesses?.[process.code]);
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
      startButton.innerHTML = "";
      const startLabel = document.createElement("span");
      startLabel.textContent = `Start ${process.label}`;
      const startFlight = document.createElement("span");
      startFlight.className = "process-action-flight";
      startFlight.textContent = `(${flightNumberLabel})`;
      startButton.appendChild(startLabel);
      startButton.appendChild(startFlight);
      startButton.disabled = isActive;
      startButton.addEventListener("click", () => handleAction(process, "start"));

      const endButton = document.createElement("button");
      endButton.className = "btn-end";
      endButton.innerHTML = "";
      const endLabel = document.createElement("span");
      endLabel.textContent = "Ende";
      const endFlight = document.createElement("span");
      endFlight.className = "process-action-flight";
      endFlight.textContent = `(${flightNumberLabel})`;
      endButton.appendChild(endLabel);
      endButton.appendChild(endFlight);
      endButton.disabled = !isActive;
      endButton.addEventListener("click", () => handleAction(process, "end"));

      const instanceButton = document.createElement("button");
      instanceButton.className = "btn-neutral";
      instanceButton.textContent = "Sub-Task hinzufügen";
      instanceButton.title = "Speichert eine zusätzliche Instanz für diesen Prozess im aktiven Flug (Flugdaten + Prozessdaten).";
      instanceButton.addEventListener("click", () => handleAction(process, "instance"));

      actions.appendChild(startButton);
      actions.appendChild(endButton);
      actions.appendChild(instanceButton);

      const showEndConfirmation =
        state.endConfirmation?.flightId === activeId && state.endConfirmation?.processCode === process.code;
      if (showEndConfirmation) {
        const confirmRow = document.createElement("div");
        confirmRow.className = "process-inline-confirm";

        const confirmLabel = document.createElement("span");
        confirmLabel.className = "process-inline-confirm-label";
        const flightLabel = activeFlight.flight_no || "aktuellen Flug";
        const confirmDetails = [];
        if (routeLabel) confirmDetails.push(routeLabel);
        if (activeFlight.gate || activeFlight.stand) confirmDetails.push(gateStand);
        const confirmSuffix = confirmDetails.length ? ` (${confirmDetails.join(" · ")})` : "";
        confirmLabel.textContent = `Ende ${process.code} für ${flightLabel}${confirmSuffix}?`;

        const confirmButton = document.createElement("button");
        confirmButton.className = "btn-end";
        confirmButton.textContent = "Ja, beenden";
        confirmButton.addEventListener("click", () => handleAction(process, "end"));

        confirmRow.appendChild(confirmLabel);
        confirmRow.appendChild(confirmButton);
        card.appendChild(confirmRow);
      }

      if (isActive) {
        const indicator = document.createElement("div");
        indicator.className = "process-indicator";
        const since = activeContext?.activeProcesses?.[process.code]?.startedAt || activeContext?.activeProcesses?.[process.code];
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
  const sortedContexts = Object.entries(state.flightContexts || {}).sort(([leftId, left], [rightId, right]) => {
    if (leftId === state.activeFlightId) return -1;
    if (rightId === state.activeFlightId) return 1;
    const leftFlight = left?.flight?.flight_no || "";
    const rightFlight = right?.flight?.flight_no || "";
    return leftFlight.localeCompare(rightFlight, "de");
  });

  const formatFlightLabel = (context) => {
    const flightNo = context?.flight?.flight_no || "Unbekannter Flug";
    const direction = context?.flight?.direction || "";
    const directionLabel =
      direction === "arrival" ? "Ankunft" : direction === "departure" ? "Abflug" : direction || "";
    const airport = context?.flight?.airport || "";
    const details = [directionLabel, airport].filter(Boolean).join(" · ");
    return details ? `${flightNo} · ${details}` : flightNo;
  };

  const createFlightGroup = ({ context, flightId, rowClassName }) => {
    const group = document.createElement("div");
    const isActive = flightId === state.activeFlightId;
    group.className = `process-viz-group${isActive ? " is-active" : " is-clickable"}`;
    if (!isActive) {
      group.setAttribute("role", "button");
      group.tabIndex = 0;
    }

    const titleRow = document.createElement("div");
    titleRow.className = "process-viz-group-header";

    const title = document.createElement("div");
    title.className = "process-viz-group-title";
    title.textContent = formatFlightLabel(context);

    titleRow.appendChild(title);

    if (!isActive) {
      const activateButton = document.createElement("button");
      activateButton.type = "button";
      activateButton.className = "process-viz-activate";
      activateButton.innerHTML = `<span class="process-viz-activate-icon">➜</span>Aktivieren`;
      activateButton.addEventListener("click", (event) => {
        event.stopPropagation();
        setActiveFlightId(flightId);
      });
      titleRow.appendChild(activateButton);
    }

    const row = document.createElement("div");
    row.className = rowClassName;

    if (!isActive) {
      const handleActivate = () => setActiveFlightId(flightId);
      group.addEventListener("click", handleActivate);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      });
    }

    group.appendChild(titleRow);
    group.appendChild(row);

    return { group, row };
  };

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
  activeRow.className = "token-row token-row-grouped";

  const activeGroups = sortedContexts
    .map(([flightId, context]) => {
      const activeEntries = Object.entries(context?.activeProcesses || {}).sort(
        ([_a, left], [_b, right]) => new Date(left?.startedAt || 0) - new Date(right?.startedAt || 0)
      );
      return { flightId, context, activeEntries };
    })
    .filter((group) => group.activeEntries.length);

  if (!activeGroups.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "lane-placeholder";
    placeholder.textContent = "Keine aktiven Prozesse";
    activeRow.appendChild(placeholder);
  } else {
    activeGroups.forEach(({ flightId, context, activeEntries }) => {
      const { group, row } = createFlightGroup({ context, flightId, rowClassName: "token-row" });

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
        row.appendChild(token);
      });

      activeRow.appendChild(group);
    });
  }

  activeLane.appendChild(activeRow);
  grid.appendChild(activeLane);

  const completedLane = document.createElement("div");
  completedLane.className = "process-viz-lane";
  completedLane.innerHTML = `<div class="lane-title">Abgeschlossen</div>`;
  const completedRow = document.createElement("div");
  completedRow.className = "token-row token-row-completed token-row-grouped";

  const completedGroups = sortedContexts
    .map(([flightId, context]) => {
      const completedEntries = Array.isArray(context?.completedProcesses)
        ? context.completedProcesses.slice(0, 10)
        : [];
      return { flightId, context, completedEntries };
    })
    .filter((group) => group.completedEntries.length);

  if (!completedGroups.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "lane-placeholder";
    placeholder.textContent = "Noch keine abgeschlossenen Prozesse";
    completedRow.appendChild(placeholder);
  } else {
    completedGroups.forEach(({ flightId, context, completedEntries }) => {
      const { group, row } = createFlightGroup({
        context,
        flightId,
        rowClassName: "token-row token-row-completed",
      });

      completedEntries.forEach((entry) => {
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
        row.appendChild(token);
      });

      completedRow.appendChild(group);
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

    const filterBar = document.createElement("div");
    filterBar.className = "log-filter-bar";

    const flightGroup = document.createElement("div");
    flightGroup.className = "field-group";
    const flightLabel = document.createElement("label");
    flightLabel.textContent = "Flugfilter (Mehrfachauswahl)";
    const flightSelect = document.createElement("select");
    flightSelect.id = "log-filter-flight";
    flightSelect.multiple = true;
    flightSelect.addEventListener("change", () => {
      const selected = Array.from(flightSelect.selectedOptions).map((option) => option.value);
      updateLogFilters({ flights: selected });
    });
    flightLabel.appendChild(flightSelect);
    flightGroup.appendChild(flightLabel);

    const eventGroup = document.createElement("div");
    eventGroup.className = "field-group";
    const eventLabel = document.createElement("label");
    eventLabel.textContent = "Event-Typ";
    const eventSelect = document.createElement("select");
    eventSelect.id = "log-filter-event";
    eventSelect.addEventListener("change", (event) => updateLogFilters({ eventType: event.target.value }));
    eventLabel.appendChild(eventSelect);
    eventGroup.appendChild(eventLabel);

    const processGroup = document.createElement("div");
    processGroup.className = "field-group";
    const processLabel = document.createElement("label");
    processLabel.textContent = "Prozess";
    const processSelect = document.createElement("select");
    processSelect.id = "log-filter-process";
    processSelect.addEventListener("change", (event) => updateLogFilters({ process: event.target.value }));
    processLabel.appendChild(processSelect);
    processGroup.appendChild(processLabel);

    const jumpGroup = document.createElement("div");
    jumpGroup.className = "log-jump-group";
    const jumpLabel = document.createElement("span");
    jumpLabel.className = "log-jump-label";
    jumpLabel.textContent = "Navigation";
    const jumpRow = document.createElement("div");
    jumpRow.className = "log-jump-row";

    const jumpCurrentButton = document.createElement("button");
    jumpCurrentButton.id = "jump-current-flight";
    jumpCurrentButton.type = "button";
    jumpCurrentButton.className = "btn-neutral btn-small";
    jumpCurrentButton.textContent = "Zum aktuellen Flug";
    jumpCurrentButton.addEventListener("click", () => {
      if (!state.activeFlightId) return;
      jumpToLogItem(`li[data-flight-id="${state.activeFlightId}"]`);
    });

    const jumpLastButton = document.createElement("button");
    jumpLastButton.id = "jump-last-event";
    jumpLastButton.type = "button";
    jumpLastButton.className = "btn-neutral btn-small";
    jumpLastButton.textContent = "Zum letzten Event";
    jumpLastButton.addEventListener("click", () => jumpToLogItem("last"));

    jumpRow.appendChild(jumpCurrentButton);
    jumpRow.appendChild(jumpLastButton);
    jumpGroup.appendChild(jumpLabel);
    jumpGroup.appendChild(jumpRow);

    filterBar.appendChild(flightGroup);
    filterBar.appendChild(eventGroup);
    filterBar.appendChild(processGroup);
    filterBar.appendChild(jumpGroup);
    logPanel.appendChild(filterBar);

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
  const activeFlight = getActiveFlight();
  const defaultAirport = activeFlight.airport || "MUC";
  const initialContext = buildFlightContext({ flight: { ...DEFAULT_FLIGHT, airport: defaultAirport } });
  state = {
    ...state,
    started: true,
    flightContexts: { [initialContext.flightId]: initialContext },
    pinnedFlights: [],
    activeFlightId: initialContext.flightId,
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

  ensureActiveFlightContext();
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

  const activeContext = getActiveFlightContext();
  const activeFlight = activeContext?.flight || DEFAULT_FLIGHT;
  const rail = document.createElement("div");
  rail.id = "status-rail";
  rail.className = "status-rail card";

  const activeCount = Object.keys(activeContext?.activeProcesses || {}).length;
  const completedCount = activeContext?.completedProcesses?.length || 0;

  const items = [
    {
      label: "Flug",
      value: activeFlight.flight_no || "nicht gesetzt",
      hint: activeFlight.direction
        ? activeFlight.direction === "arrival"
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
      value: activeContext?.events?.length || 0,
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

function getLogFilters() {
  const filters = state.logFilters || {};
  return {
    flights: Array.isArray(filters.flights) ? filters.flights : [],
    eventType: filters.eventType || "",
    process: filters.process || "",
  };
}

function updateLogFilters(nextFilters) {
  const merged = { ...getLogFilters(), ...nextFilters };
  state = { ...state, logFilters: merged };
  persistStateDebounced();
  populateLog();
}

function getDropdownLabel(optionKey, value) {
  const options = DROPDOWN_OPTIONS[optionKey] || [];
  const match = options.find((option) => option.value === value);
  return match ? match.label : value || "-";
}

function getLogEntries() {
  return Object.entries(state.flightContexts || {}).flatMap(([flightId, context]) => {
    const events = Array.isArray(context?.events) ? context.events : [];
    return events.map((event) => ({
      ...event,
      _flightId: flightId,
      _flight: context?.flight || DEFAULT_FLIGHT,
    }));
  });
}

function buildFlightFilterLabel(context, flightId) {
  const flight = context?.flight || DEFAULT_FLIGHT;
  const flightNo = flight.flight_no || "Unbekannter Flug";
  const direction =
    flight.direction === "arrival" ? "Arrival" : flight.direction === "departure" ? "Departure" : "Richtung?";
  const airport = flight.airport || "-";
  const count = context?.events?.length || 0;
  return `${flightNo} · ${direction} · ${airport} (${count})`;
}

function getLogFilterOptions(entries) {
  const flightOptions = Object.entries(state.flightContexts || {}).map(([flightId, context]) => ({
    value: flightId,
    label: buildFlightFilterLabel(context, flightId),
  }));

  const eventTypes = new Set(entries.map((entry) => entry.event_type).filter(Boolean));
  const eventTypeOptions = Array.from(eventTypes).map((type) => ({
    value: type,
    label: EVENT_TYPE_LABELS[type] || type,
  }));

  const knownProcessCodes = PROCESS_CODES.map((process) => ({
    value: process.code,
    label: `${process.code} – ${process.label}`,
  }));
  const extraCodes = Array.from(new Set(entries.map((entry) => entry.process_code).filter(Boolean)))
    .filter((code) => !PROCESS_CODES.some((process) => process.code === code))
    .map((code) => ({ value: code, label: code }));

  return {
    flightOptions,
    eventTypeOptions,
    processOptions: [...knownProcessCodes, ...extraCodes],
  };
}

function sanitizeLogFilters(filters, options) {
  const flightSet = new Set(options.flightOptions.map((option) => option.value));
  const eventSet = new Set(options.eventTypeOptions.map((option) => option.value));
  const processSet = new Set(options.processOptions.map((option) => option.value));
  return {
    flights: filters.flights.filter((id) => flightSet.has(id)),
    eventType: eventSet.has(filters.eventType) ? filters.eventType : "",
    process: processSet.has(filters.process) ? filters.process : "",
  };
}

function createLogMetaItem(label, value, className = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `log-meta-item${className ? ` ${className}` : ""}`;

  const labelEl = document.createElement("span");
  labelEl.className = "log-meta-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "log-meta-value";
  valueEl.textContent = value || "-";

  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);
  return wrapper;
}

function createLogDetailItem(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "log-detail-item";

  const title = document.createElement("span");
  title.className = "log-detail-label";
  title.textContent = label;

  const detail = document.createElement("span");
  detail.className = "log-detail-value";
  detail.textContent = value || "-";

  wrapper.appendChild(title);
  wrapper.appendChild(detail);
  return wrapper;
}

function highlightLogItem(item) {
  if (!item) return;
  item.classList.add("is-highlighted");
  window.setTimeout(() => item.classList.remove("is-highlighted"), 1200);
}

function jumpToLogItem(selector) {
  const list = document.getElementById("log-list");
  if (!list) return;
  const item = selector === "last" ? list.firstElementChild : list.querySelector(selector);
  if (item) {
    item.scrollIntoView({ behavior: "smooth", block: "start" });
    highlightLogItem(item);
  }
}

function populateLog() {
  const list = document.getElementById("log-list");
  if (!list) return;
  list.innerHTML = "";

  const entries = getLogEntries();
  const options = getLogFilterOptions(entries);
  const sanitizedFilters = sanitizeLogFilters(getLogFilters(), options);

  if (
    sanitizedFilters.flights.length !== getLogFilters().flights.length ||
    sanitizedFilters.eventType !== getLogFilters().eventType ||
    sanitizedFilters.process !== getLogFilters().process
  ) {
    state = { ...state, logFilters: sanitizedFilters };
    persistStateDebounced();
  }

  const filters = sanitizedFilters;
  const filtered = entries
    .filter((entry) => (filters.flights.length ? filters.flights.includes(entry._flightId) : true))
    .filter((entry) => (filters.eventType ? entry.event_type === filters.eventType : true))
    .filter((entry) => (filters.process ? entry.process_code === filters.process : true))
    .sort((a, b) => new Date(b.event_timestamp || 0) - new Date(a.event_timestamp || 0));

  const flightSelect = document.getElementById("log-filter-flight");
  const eventSelect = document.getElementById("log-filter-event");
  const processSelect = document.getElementById("log-filter-process");
  if (flightSelect) {
    flightSelect.innerHTML = "";
    options.flightOptions.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (filters.flights.includes(option.value)) {
        opt.selected = true;
      }
      flightSelect.appendChild(opt);
    });
    flightSelect.size = Math.min(Math.max(options.flightOptions.length, 2), 6);
  }
  if (eventSelect) {
    eventSelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Alle Event-Typen";
    eventSelect.appendChild(allOption);
    options.eventTypeOptions.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      eventSelect.appendChild(opt);
    });
    eventSelect.value = filters.eventType;
  }
  if (processSelect) {
    processSelect.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Alle Prozesse";
    processSelect.appendChild(allOption);
    options.processOptions.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      processSelect.appendChild(opt);
    });
    processSelect.value = filters.process;
  }

  const jumpCurrentButton = document.getElementById("jump-current-flight");
  const jumpLastButton = document.getElementById("jump-last-event");
  const hasCurrentFlight = filtered.some((entry) => entry._flightId === state.activeFlightId);
  if (jumpCurrentButton) {
    jumpCurrentButton.disabled = !hasCurrentFlight;
  }
  if (jumpLastButton) {
    jumpLastButton.disabled = filtered.length === 0;
  }

  if (!filtered.length) {
    const empty = document.createElement("li");
    empty.className = "log-empty";
    empty.textContent = "Keine Events für diese Filter.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach((event) => {
    const item = document.createElement("li");
    item.className = "log-item";
    item.dataset.flightId = event._flightId;

    const card = document.createElement("article");
    card.className = "log-card";

    const header = document.createElement("div");
    header.className = "log-card-header";

    const metaGrid = document.createElement("div");
    metaGrid.className = "log-meta-grid";

    const timeValue = event.event_timestamp
      ? new Date(event.event_timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "-";
    const directionValue =
      event.direction === "arrival" ? "Arrival" : event.direction === "departure" ? "Departure" : "-";
    const eventLabel = EVENT_TYPE_LABELS[event.event_type] || event.event_type || "-";
    const processLabel = [event.process_code, event.process_label ? `(${event.process_label})` : ""]
      .filter(Boolean)
      .join(" ");

    metaGrid.appendChild(createLogMetaItem("Zeit", timeValue));
    metaGrid.appendChild(createLogMetaItem("Event-Typ", eventLabel, "is-event-type"));
    metaGrid.appendChild(createLogMetaItem("Prozess", processLabel));
    metaGrid.appendChild(createLogMetaItem("Flug", event.flight_no || "-"));
    metaGrid.appendChild(createLogMetaItem("Richtung", directionValue));
    metaGrid.appendChild(createLogMetaItem("Gate/Stand", `${event.gate || "-"} / ${event.stand || "-"}`));

    header.appendChild(metaGrid);
    card.appendChild(header);

    const details = document.createElement("details");
    details.className = "log-details";
    const summary = document.createElement("summary");
    summary.textContent = "Zusätzliche Details";
    details.appendChild(summary);

    const detailGrid = document.createElement("div");
    detailGrid.className = "log-detail-grid";
    detailGrid.appendChild(createLogDetailItem("Disruption", getDropdownLabel("disruption_type", event.disruption_type)));
    detailGrid.appendChild(createLogDetailItem("Equipment", getDropdownLabel("equipment_type", event.equipment_type)));
    detailGrid.appendChild(createLogDetailItem("Pax", getDropdownLabel("pax_mix", event.pax_mix)));
    detailGrid.appendChild(createLogDetailItem("Notizen", event.notes || "-"));
    details.appendChild(detailGrid);

    card.appendChild(details);
    item.appendChild(card);
    list.appendChild(item);
  });
}

function updateSessionSummary() {
  const summary = document.getElementById("session-summary");
  const activeContext = getActiveFlightContext();
  if (summary) {
    const activeFlight = getActiveFlight();
    const activeSession = (activeContext?.events?.length || 0) > 0 || activeFlight.flight_no || activeFlight.direction;
    const suffix = activeSession ? " – gespeicherte Session aktiv" : "";
    summary.textContent = `${activeContext?.events?.length || 0} Events protokolliert${suffix}`;
  }

  const exportButton = document.getElementById("export-button");
  if (exportButton) {
    exportButton.disabled = !(getExportEntries().length > 0);
  }
}

function handleAction(process, action) {
  const { id: activeId } = ensureActiveFlightContext();
  if (action !== "end" && state.endConfirmation) {
    state = { ...state, endConfirmation: null };
  }

  if (action === "end") {
    const pending = state.endConfirmation;
    if (!pending || pending.processCode !== process.code || pending.flightId !== activeId) {
      state = { ...state, endConfirmation: { processCode: process.code, flightId: activeId } };
      const app = document.getElementById("app");
      if (app) renderProcessCards(app);
      return;
    }
    state = { ...state, endConfirmation: null };
  }

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
  } else if (action === "instance") {
    const flightLabel = getActiveFlight().flight_no || "aktuellen Flug";
    setFeedback(`Sub-Task gespeichert (zusätzliche Instanz für ${process.code} im ${flightLabel}).`);
  }
}

function getExportEntries() {
  return Object.entries(state.flightContexts || {}).flatMap(([, context]) => {
    const events = Array.isArray(context?.events) ? context.events : [];
    const flight = context?.flight || DEFAULT_FLIGHT;

    return events
      .filter((event) => Boolean(event.end_time_abs))
      .map((event) => ({
        ...event,
        flight_no: flight.flight_no || event.flight_no || "",
        direction: flight.direction || event.direction || "",
        airport: flight.airport || event.airport || "",
        from_airport: flight.from_airport || event.from_airport || "",
        to_airport: flight.to_airport || event.to_airport || "",
        airline_code: flight.airline_code || event.airline_code || "",
        aircraft_type: flight.aircraft_type || event.aircraft_type || "",
        stand: flight.stand || event.stand || "",
        gate: flight.gate || event.gate || "",
      }));
  });
}

function toCsv() {
  const header = [
    "turnaround_id",
    "instance_id",
    "process_id",
    "process_label",
    "flight_no",
    "direction",
    "airport",
    "from_airport",
    "to_airport",
    "airline_code",
    "aircraft_type",
    "stand",
    "gate",
    "start_time_abs",
    "end_time_abs",
    "duration_min",
    "notes",
    "staff_count",
    "time_of_instance_taking",
    // "disruption_flag",
    // "disruption_type",
    // "equipment_type",
    // "observer_id",
    // "location_latitude",
    // "location_longitude",
    // "location_accuracy_m",
  ];

  const escapeValue = (value) => {
    if (value == null) return "";
    const stringValue = String(value);
    if (stringValue.includes('"') || stringValue.includes(",") || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = getExportEntries().map((event) => header.map((key) => escapeValue(event[key])));
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
  if (!getExportEntries().length) {
    setFeedback("Keine abgeschlossenen Instanzen für den Export.");
    return;
  }
  const filename = downloadCsv();
  setFeedback(`CSV exportiert: ${filename}`);
  const shouldReset = window.confirm("Session löschen?");
  if (shouldReset) {
    resetSession();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  state = loadState();
  if (state.started) {
    ensureActiveFlightContext();
  }
  renderApp();
  populateLog();
  updateSessionSummary();
  setFeedback("");
});
