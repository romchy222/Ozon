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
};

const toggleButton = document.getElementById("toggleSimulation");
const resetButton = document.getElementById("resetSimulation");
const chart = document.getElementById("trendChart");
const ctx = chart.getContext("2d");

let running = false;
let history = [];
let lastTimestamp = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateInputValues = () => {
  values.flow.textContent = inputs.flow.value;
  values.contamination.textContent = inputs.contamination.value;
  values.ozone.textContent = inputs.ozone.value;
  values.contact.textContent = inputs.contact.value;
  values.temp.textContent = inputs.temp.value;
  values.ph.textContent = Number.parseFloat(inputs.ph.value).toFixed(1);
};

const calculateProcess = (state) => {
  const flow = state.flow;
  const contamination = state.contamination;
  const ozone = state.ozone;
  const contact = state.contact;
  const temp = state.temp;
  const ph = state.ph;

  const temperatureFactor = clamp(1 - Math.abs(temp - 18) * 0.015, 0.7, 1.1);
  const phFactor = clamp(1 - Math.abs(ph - 7.2) * 0.08, 0.6, 1.1);
  const mixingEfficiency = clamp((ozone / (flow * 1.5)) * 0.8, 0.3, 1.2);

  const oxidation = clamp(
    (ozone * contact * mixingEfficiency * temperatureFactor * phFactor) /
      (contamination * 40),
    0,
    1.3
  );

  const quality = clamp(oxidation * 100, 10, 99);
  const residual = clamp((ozone / flow) * 0.35 - oxidation * 0.1, 0, 2.4);
  const efficiency = clamp(oxidation * 0.9 + mixingEfficiency * 0.1, 0.1, 1.1);
  const energy = clamp(ozone * 0.018 + flow * 0.003, 0.4, 6);

  return {
    quality,
    residual,
    efficiency,
    energy,
  };
};

const renderOutputs = (data) => {
  outputs.quality.textContent = `${data.quality.toFixed(1)}%`;
  outputs.residual.textContent = `${data.residual.toFixed(2)} мг/л`;
  outputs.efficiency.textContent = `${(data.efficiency * 100).toFixed(0)}%`;
  outputs.energy.textContent = `${data.energy.toFixed(2)} кВт·ч/м³`;

  outputs.qualityNote.textContent = data.quality > 90 ? "норма" : "требуется корректировка";
  outputs.residualNote.textContent = data.residual < 0.4 ? "безопасный уровень" : "приближение к лимиту";
  outputs.efficiencyNote.textContent = data.efficiency > 0.75 ? "эффективно" : "умеренно";
  outputs.energyNote.textContent = data.energy < 2 ? "экономичный режим" : "повышенное энергопотребление";

  outputs.qualityBadge.textContent = `${data.quality.toFixed(0)}%`;
  outputs.residualBadge.textContent = `${data.residual.toFixed(2)} мг/л`;
  outputs.energyBadge.textContent = `${data.energy.toFixed(2)} кВт·ч/м³`;
};

const renderChart = () => {
  ctx.clearRect(0, 0, chart.width, chart.height);
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, chart.width, chart.height);

  const padding = 32;
  const width = chart.width - padding * 2;
  const height = chart.height - padding * 2;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, chart.height - padding);
  ctx.lineTo(chart.width - padding, chart.height - padding);
  ctx.stroke();

  const points = history.slice(-40);
  if (points.length < 2) {
    return;
  }

  const plotLine = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = padding + (index / (points.length - 1)) * width;
      const y =
        chart.height -
        padding -
        clamp(point[key] / point.max, 0, 1) * height;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  plotLine("quality", "#38bdf8");
  plotLine("residual", "#f97316");
  plotLine("energy", "#22c55e");
};

const snapshot = () => {
  const state = {
    flow: Number(inputs.flow.value),
    contamination: Number(inputs.contamination.value),
    ozone: Number(inputs.ozone.value),
    contact: Number(inputs.contact.value),
    temp: Number(inputs.temp.value),
    ph: Number(inputs.ph.value),
  };

  const data = calculateProcess(state);
  renderOutputs(data);

  history.push({
    quality: data.quality,
    residual: data.residual,
    energy: data.energy,
    max: 100,
  });

  if (history.length > 80) {
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
  requestAnimationFrame(loop);
};

const toggleSimulation = () => {
  running = !running;
  toggleButton.textContent = running ? "Остановить" : "Запустить симуляцию";
  toggleButton.classList.toggle("active", running);
  if (running) {
    lastTimestamp = 0;
    requestAnimationFrame(loop);
  }
};

const resetSimulation = () => {
  history = [];
  snapshot();
};

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", () => {
    updateInputValues();
    snapshot();
  });
});

toggleButton.addEventListener("click", toggleSimulation);
resetButton.addEventListener("click", resetSimulation);

updateInputValues();
snapshot();
