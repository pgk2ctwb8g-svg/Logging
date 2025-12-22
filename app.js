const statusText = document.getElementById("status-text");
const lastSaved = document.getElementById("last-saved");
const statusToggle = document.getElementById("status-toggle");
const entryList = document.getElementById("entry-list");
const entryCount = document.getElementById("entry-count");
const noteInput = document.getElementById("note-input");
const saveButton = document.getElementById("save-button");
const clearButton = document.getElementById("clear-button");

const entries = [];
let lastSavedAt = null;

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderStatus() {
  statusText.hidden = !statusToggle.checked;
  if (statusText.hidden) return;

  const text = lastSavedAt ? formatTimestamp(lastSavedAt) : "Noch nichts gespeichert";
  lastSaved.textContent = text;
}

function renderEntries() {
  entryList.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Noch keine Einträge gespeichert";
    entryList.appendChild(empty);
  } else {
    entries.forEach((entry, index) => {
      const item = document.createElement("li");

      const meta = document.createElement("div");
      meta.className = "meta";

      const title = document.createElement("span");
      title.textContent = `Notiz ${index + 1}`;

      const created = document.createElement("span");
      created.textContent = entry.created;

      meta.append(title, created);

      const text = document.createElement("p");
      text.textContent = entry.text;

      item.append(meta, text);
      entryList.appendChild(item);
    });
  }

  entryCount.textContent = `${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"}`;
}

function addEntry(text) {
  entries.unshift({
    text,
    created: formatTimestamp(),
  });
  renderEntries();
}

saveButton.addEventListener("click", () => {
  const value = noteInput.value.trim();
  if (!value) return;
  addEntry(value);
  lastSavedAt = new Date();
  renderStatus();
  noteInput.value = "";
  noteInput.focus();
});

clearButton.addEventListener("click", () => {
  noteInput.value = "";
  noteInput.focus();
});

statusToggle.addEventListener("change", () => {
  renderStatus();
});

renderStatus();
renderEntries();
