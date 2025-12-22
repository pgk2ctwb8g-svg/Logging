const statusText = document.getElementById("status-text");
const lastSaved = document.getElementById("last-saved");
const statusToggle = document.getElementById("status-toggle");
const entryList = document.getElementById("entry-list");
const entryCount = document.getElementById("entry-count");
const noteInput = document.getElementById("note-input");
const saveButton = document.getElementById("save-button");
const clearButton = document.getElementById("clear-button");

const entries = [];

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderStatus(timestamp) {
  lastSaved.textContent = timestamp ?? "-";
  statusText.hidden = !statusToggle.checked;
}

function renderEntries() {
  entryList.innerHTML = "";

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="meta">
        <span>Notiz ${index + 1}</span>
        <span>${entry.created}</span>
      </div>
      <p>${entry.text}</p>
    `;
    entryList.appendChild(item);
  });

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
  renderStatus(formatTimestamp());
  noteInput.value = "";
  noteInput.focus();
});

clearButton.addEventListener("click", () => {
  noteInput.value = "";
  noteInput.focus();
});

statusToggle.addEventListener("change", () => {
  renderStatus(lastSaved.textContent);
});

renderStatus("-");
renderEntries();
