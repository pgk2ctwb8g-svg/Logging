const PROCESS_CODES = [
  { code: "P01", label: "Check-In" },
  { code: "P02", label: "Sicherheitskontrolle" },
  { code: "P03", label: "Boarding" },
  { code: "P04", label: "Gepäckabfertigung" },
];

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

function handleAction(process, action) {
  const values = Object.fromEntries(
    Object.keys(DROPDOWN_OPTIONS).map((key) => {
      const select = document.querySelector(`select[name="${key}"]`);
      return [key, select?.value ?? ""];
    })
  );

  const message = `${action.toUpperCase()} ${process.code} (${process.label}) | ` +
    `Disruption: ${values.disruption_type || "-"}, ` +
    `Equipment: ${values.equipment_type || "-"}, ` +
    `Pax-Mix: ${values.pax_mix || "-"}, ` +
    `Observation: ${values.observation_quality || "-"}`;

  logMessage(message);
}

function logMessage(text) {
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

    document.getElementById("app").appendChild(logPanel);
  }

  const list = document.getElementById("log-list");
  const item = document.createElement("li");
  item.textContent = text;
  list.prepend(item);
}

function renderApp() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  renderDropdowns(app);
  renderProcessCards(app);
}

renderApp();
