const STORAGE_KEY = "hiwi_logger_state";
const DEFAULT_STATE = {
  events: [],
  nextLogId: 1,
};

const processInput = document.querySelector("#process-code");
const flightInput = document.querySelector("#flight-number");
const startBtn = document.querySelector("#start-btn");
const endBtn = document.querySelector("#end-btn");
const logBody = document.querySelector("#log-body");
const emptyLog = document.querySelector("#empty-log");
const storageStatus = document.querySelector("#storage-status");
const runningList = document.querySelector("#running-list");

let state = { ...DEFAULT_STATE };

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    storageStatus.textContent = "Default-State gesetzt (keine lokalen Daten gefunden).";
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.events) && typeof parsed.nextLogId === "number") {
      state = parsed;
      storageStatus.textContent = "State aus localStorage geladen.";
      return;
    }
  } catch (err) {
    console.warn("Konnte gespeicherten State nicht parsen:", err);
  }

  storageStatus.textContent = "Persistente Daten ungültig, Default-State gesetzt.";
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  storageStatus.textContent = "State im localStorage gespeichert.";
}

function renderLog() {
  logBody.innerHTML = "";

  if (!state.events.length) {
    emptyLog.style.display = "block";
    return;
  }

  emptyLog.style.display = "none";
  state.events
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach((event) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${event.log_id}</td>
        <td>${event.action}</td>
        <td>${event.timestamp}</td>
        <td>${event.process_code}</td>
        <td>${event.flight_number}</td>
        <td>${event.source}</td>
        <td>${event.airport}</td>
      `;
      logBody.appendChild(row);
    });
}

function renderRunning() {
  runningList.innerHTML = "";
  const runningMap = new Map();

  for (const event of state.events) {
    const key = `${event.process_code}::${event.flight_number}`;
    if (event.action === "START") {
      runningMap.set(key, event);
    } else if (event.action === "END") {
      runningMap.delete(key);
    }
  }

  if (!runningMap.size) {
    runningList.innerHTML = '<span class="muted">Keine laufenden Prozesse erkannt.</span>';
    return;
  }

  const now = Date.now();

  for (const [key, startEvent] of runningMap.entries()) {
    const since = new Date(startEvent.timestamp).getTime();
    const durationMs = Math.max(now - since, 0);
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    const [process_code, flight_number] = key.split("::");

    const item = document.createElement("div");
    item.className = "running-item";
    item.innerHTML = `
      <div>
        <strong>${process_code}</strong> / ${flight_number}
      </div>
      <div>Läuft seit ${minutes}m ${seconds}s (gestartet um ${startEvent.timestamp})</div>
    `;
    runningList.appendChild(item);
  }
}

function generateLogId() {
  const id = state.nextLogId;
  state.nextLogId += 1;
  return id;
}

function createEvent(action) {
  const process_code = processInput.value.trim();
  const flight_number = flightInput.value.trim();

  if (!process_code || !flight_number) {
    alert("Bitte Prozess-Code und Flugnummer ausfüllen.");
    return null;
  }

  return {
    log_id: generateLogId(),
    action,
    timestamp: new Date().toISOString(),
    source: "HIWI_LOGGER_V1",
    airport: "MUC",
    process_code,
    flight_number,
  };
}

function handleAction(action) {
  const event = createEvent(action);
  if (!event) return;

  state.events.push(event);
  saveState();
  renderLog();
  renderRunning();
}

function init() {
  loadState();
  renderLog();
  renderRunning();

  startBtn.addEventListener("click", () => handleAction("START"));
  endBtn.addEventListener("click", () => handleAction("END"));
}

document.addEventListener("DOMContentLoaded", init);
