const inputs = {
  flow: document.getElementById("flowInput"),
  contamination: document.getElementById("contaminationInput"),
  ozone: document.getElementById("ozoneInput"),
  contact: document.getElementById("contactInput"),
  temp: document.getElementById("tempInput"),
  ph: document.getElementById("phInput"),
};

const values = {
  flow: document.getElementById("flowValue"),
  contamination: document.getElementById("contaminationValue"),
  ozone: document.getElementById("ozoneValue"),
  contact: document.getElementById("contactValue"),
  temp: document.getElementById("tempValue"),
  ph: document.getElementById("phValue"),
};

const outputs = {
  quality: document.getElementById("qualityValue"),
  residual: document.getElementById("residualValue"),
  efficiency: document.getElementById("efficiencyValue"),
  energy: document.getElementById("energyValue"),
  qualityNote: document.getElementById("qualityNote"),
  residualNote: document.getElementById("residualNote"),
  efficiencyNote: document.getElementById("efficiencyNote"),
  energyNote: document.getElementById("energyNote"),
  qualityBadge: document.getElementById("qualityBadge"),
  residualBadge: document.getElementById("residualBadge"),
  energyBadge: document.getElementById("energyBadge"),
  qualityBadgeNote: document.getElementById("qualityBadgeNote"),
  residualBadgeNote: document.getElementById("residualBadgeNote"),
  energyBadgeNote: document.getElementById("energyBadgeNote"),
};

const indicators = {
  tau: document.getElementById("tauValue"),
  orp: document.getElementById("orpValue"),
  uv: document.getElementById("uvValue"),
  safety: document.getElementById("safetyPill"),
  mode: document.getElementById("modeIndicator"),
  statusLoops: document.getElementById("statusLoops"),
  statusRisk: document.getElementById("statusRisk"),
  statusScenario: document.getElementById("statusScenario"),
};

const scenarioSelect = document.getElementById("scenarioSelect");
const disturbanceToggle = document.getElementById("disturbanceToggle");
const toggleButton = document.getElementById("toggleSimulation");
const resetButton = document.getElementById("resetSimulation");
const chart = document.getElementById("trendChart");
const ctx = chart.getContext("2d");
const eventLog = document.querySelector("#eventLog ul");

let running = false;
let history = [];
let lastTimestamp = 0;
let lastEvent = 0;
let lastControl = { ozone: Number(inputs.ozone.value), contact: Number(inputs.contact.value) };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randomNoise = (scale) => (Math.random() - 0.5) * scale;

const scenarios = {
  nominal: {
    label: "Номинал",
    flow: 65,
    contamination: 22,
    ozone: 120,
    contact: 14,
    temp: 18,
    ph: 7.2,
  },
  peak: {
    label: "Пиковые загрязнения",
    flow: 75,
    contamination: 55,
    ozone: 180,
    contact: 20,
    temp: 19,
    ph: 7.0,
  },
  cold: {
    label: "Холодный режим",
    flow: 58,
    contamination: 30,
    ozone: 150,
    contact: 18,
    temp: 8,
    ph: 7.4,
  },
  shock: {
    label: "Гидроудар",
    flow: 110,
    contamination: 26,
    ozone: 170,
    contact: 10,
    temp: 16,
    ph: 7.1,
  },
};

const updateInputValues = () => {
  values.flow.textContent = inputs.flow.value;
  values.contamination.textContent = inputs.contamination.value;
  values.ozone.textContent = inputs.ozone.value;
  values.contact.textContent = inputs.contact.value;
  values.temp.textContent = inputs.temp.value;
  values.ph.textContent = Number.parseFloat(inputs.ph.value).toFixed(1);
};

const logEvent = (message) => {
  const item = document.createElement("li");
  const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  item.textContent = `[${time}] ${message}`;
  eventLog.prepend(item);
  while (eventLog.children.length > 8) {
    eventLog.removeChild(eventLog.lastChild);
  }
};

const applyScenario = (key) => {
  const preset = scenarios[key];
  if (!preset) return;
  inputs.flow.value = preset.flow;
  inputs.contamination.value = preset.contamination;
  inputs.ozone.value = preset.ozone;
  inputs.contact.value = preset.contact;
  inputs.temp.value = preset.temp;
  inputs.ph.value = preset.ph;
  indicators.statusScenario.textContent = preset.label;
  updateInputValues();
  snapshot();
  logEvent(`Применён сценарий: ${preset.label}`);
};

const calculateControl = (state, disturbances) => {
  const feedforward = state.contamination * 1.4 + state.flow * 0.4;
  const feedbackQuality = (100 - disturbances.quality) * 0.8;
  const feedbackResidual = disturbances.residual > 0.5 ? -20 : 0;

  const targetOzone = clamp(feedforward + feedbackQuality + feedbackResidual, 40, 260);
  const rampLimit = 18;
  const ozone = clamp(
    lastControl.ozone + clamp(targetOzone - lastControl.ozone, -rampLimit, rampLimit),
    40,
    260
  );

  const targetContact = clamp(10 + state.contamination / 8 - (state.flow - 60) / 20, 6, 30);
  const contact = clamp(
    lastControl.contact + clamp(targetContact - lastControl.contact, -2, 2),
    6,
    30
  );

  lastControl = { ozone, contact };

  return { ozone, contact };
};

const calculateProcess = (state) => {
  const disturbanceOn = disturbanceToggle.checked;
  const temp = state.temp + (disturbanceOn ? randomNoise(0.8) : 0);
  const ph = state.ph + (disturbanceOn ? randomNoise(0.12) : 0);
  const pressure = disturbanceOn ? 1 + randomNoise(0.08) : 1;

  const temperatureFactor = clamp(1 - Math.abs(temp - 18) * 0.018, 0.65, 1.15);
  const phFactor = clamp(1 - Math.abs(ph - 7.2) * 0.1, 0.55, 1.1);
  const mixingEfficiency = clamp((state.ozone / (state.flow * 1.4)) * 0.9, 0.35, 1.3);

  const oxidation = clamp(
    (state.ozone * state.contact * mixingEfficiency * temperatureFactor * phFactor * pressure) /
      (state.contamination * 42),
    0,
    1.4
  );

  const quality = clamp(oxidation * 100, 12, 99);
  const residual = clamp((state.ozone / state.flow) * 0.32 - oxidation * 0.12, 0, 2.6);
  const efficiency = clamp(oxidation * 0.88 + mixingEfficiency * 0.12, 0.1, 1.2);
  const energy = clamp(state.ozone * 0.017 + state.flow * 0.004 + 0.4, 0.5, 6.4);
  const orp = clamp(550 + oxidation * 180 - state.contamination * 1.2, 420, 780);
  const uv = clamp(2.1 + state.contamination / 12 - oxidation * 1.2, 0.5, 5.2);

  return {
    quality,
    residual,
    efficiency,
    energy,
    orp,
    uv,
    temp,
    ph,
  };
};

const updateStatus = (data) => {
  const safe = data.residual < 0.4 && data.quality > 90;
  indicators.safety.textContent = safe ? "Норма" : "Риск";
  indicators.safety.style.background = safe ? "rgba(34, 197, 94, 0.2)" : "rgba(248, 113, 113, 0.2)";
  indicators.safety.style.color = safe ? "#22c55e" : "#f87171";

  indicators.statusLoops.textContent = data.quality > 88 ? "Стабильно" : "Требуется коррекция";
  indicators.statusRisk.textContent = data.residual < 0.4 ? "Низкий" : "Средний";
};

const renderOutputs = (data, control) => {
  outputs.quality.textContent = `${data.quality.toFixed(1)}%`;
  outputs.residual.textContent = `${data.residual.toFixed(2)} мг/л`;
  outputs.efficiency.textContent = `${(data.efficiency * 100).toFixed(0)}%`;
  outputs.energy.textContent = `${data.energy.toFixed(2)} кВт·ч/м³`;

  outputs.qualityNote.textContent = data.quality > 92 ? "норма" : "требуется коррекция";
  outputs.residualNote.textContent = data.residual < 0.4 ? "безопасный уровень" : "приближение к лимиту";
  outputs.efficiencyNote.textContent = data.efficiency > 0.75 ? "эффективно" : "умеренно";
  outputs.energyNote.textContent = data.energy < 2.3 ? "экономичный режим" : "повышенное потребление";

  outputs.qualityBadge.textContent = `${data.quality.toFixed(0)}%`;
  outputs.residualBadge.textContent = `${data.residual.toFixed(2)} мг/л`;
  outputs.energyBadge.textContent = `${data.energy.toFixed(2)} кВт·ч/м³`;

  outputs.qualityBadgeNote.textContent = data.quality > 90 ? "качество в норме" : "ниже нормы";
  outputs.residualBadgeNote.textContent = data.residual < 0.4 ? "безопасно" : "требует контроля";
  outputs.energyBadgeNote.textContent = data.energy < 2.3 ? "оптимальный режим" : "нагрузка";

  indicators.tau.textContent = `${control.contact.toFixed(1)} мин`;
  indicators.orp.textContent = `${Math.round(data.orp)} мВ`;
  indicators.uv.textContent = `${data.uv.toFixed(2)} ед`;
};

const renderChart = () => {
  ctx.clearRect(0, 0, chart.width, chart.height);
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, chart.width, chart.height);

  const padding = 42;
  const width = chart.width - padding * 2;
  const height = chart.height - padding * 2;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, chart.height - padding);
  ctx.lineTo(chart.width - padding, chart.height - padding);
  ctx.stroke();

  const points = history.slice(-50);
  if (points.length < 2) {
    return;
  }

  const plotLine = (key, color, max) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = padding + (index / (points.length - 1)) * width;
      const y = chart.height - padding - clamp(point[key] / max, 0, 1) * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  plotLine("quality", "#38bdf8", 100);
  plotLine("residual", "#f97316", 2.6);
  plotLine("energy", "#22c55e", 6.4);
  plotLine("load", "#a855f7", 120);
};

const snapshot = () => {
  const baseState = {
    flow: Number(inputs.flow.value),
    contamination: Number(inputs.contamination.value),
    ozone: Number(inputs.ozone.value),
    contact: Number(inputs.contact.value),
    temp: Number(inputs.temp.value),
    ph: Number(inputs.ph.value),
  };

  const control = calculateControl(baseState, { quality: history.at(-1)?.quality ?? 90, residual: history.at(-1)?.residual ?? 0.3 });
  const state = { ...baseState, ozone: control.ozone, contact: control.contact };
  const data = calculateProcess(state);

  renderOutputs(data, control);
  updateStatus(data);

  history.push({
    quality: data.quality,
    residual: data.residual,
    energy: data.energy,
    load: state.flow,
  });

  if (history.length > 120) {
    history.shift();
  }

  renderChart();
};

const loop = (timestamp) => {
  if (!running) {
    return;
  }
  if (timestamp - lastTimestamp > 900) {
    snapshot();
    lastTimestamp = timestamp;
  }
  if (timestamp - lastEvent > 7000) {
    if (disturbanceToggle.checked) {
      logEvent("Обнаружено возмущение: корректировка уставок QO3 и τ.");
    }
    lastEvent = timestamp;
  }
  requestAnimationFrame(loop);
};

const toggleSimulation = () => {
  running = !running;
  toggleButton.textContent = running ? "Остановить" : "Запустить";
  indicators.mode.textContent = running ? "AUTO" : "MANUAL";
  if (running) {
    lastTimestamp = 0;
    lastEvent = 0;
    requestAnimationFrame(loop);
    logEvent("Симуляция запущена. Контуры в автоматическом режиме.");
  } else {
    logEvent("Симуляция остановлена. Переход в ручной режим.");
  }
};

const resetSimulation = () => {
  history = [];
  lastControl = { ozone: Number(inputs.ozone.value), contact: Number(inputs.contact.value) };
  snapshot();
  logEvent("Состояние сброшено до текущих уставок.");
};

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", () => {
    updateInputValues();
    snapshot();
  });
});

scenarioSelect.addEventListener("change", (event) => {
  applyScenario(event.target.value);
});

resetButton.addEventListener("click", resetSimulation);

toggleButton.addEventListener("click", toggleSimulation);

updateInputValues();
applyScenario("nominal");
