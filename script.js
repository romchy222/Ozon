const { createApp } = Vue;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randomNoise = (scale) => (Math.random() - 0.5) * scale;

createApp({
  data() {
    return {
      running: false,
      inputs: {
        flow: 65,
        contamination: 22,
        ozone: 120,
        contact: 14,
        temp: 18,
        ph: 7.2,
      },
      control: {
        feedforward: 0,
        feedbackQuality: 0,
        feedbackResidual: 0,
        ozone: 120,
        contact: 14,
      },
      metrics: {
        quality: 92,
        residual: 0.32,
        energy: 1.8,
        efficiency: 0.9,
        orp: 620,
        uv: 1.2,
        temp: 18,
        ph: 7.2,
        qualityNote: "норма",
        residualNote: "безопасно",
        energyNote: "оптимальный режим",
      },
      status: {
        loops: "Стабильно",
        risk: "Низкий",
      },
      modules: [
        { id: 1, name: "Смешивание", type: "Оператор 1", efficiency: 0.86, loss: 0.05, rate: 55 },
        { id: 2, name: "Дозирование O3", type: "Оператор 6", efficiency: 0.91, loss: 0.08, rate: 72 },
        { id: 3, name: "Контакт", type: "Оператор 13", efficiency: 0.88, loss: 0.06, rate: 64 },
        { id: 4, name: "Дегазация", type: "Оператор 12", efficiency: 0.92, loss: 0.04, rate: 61 },
        { id: 5, name: "Разделение", type: "Оператор 3", efficiency: 0.9, loss: 0.05, rate: 58 },
      ],
      newModule: {
        name: "",
        type: "Смешивание",
      },
      scenarios: {
        nominal: { label: "Номинал", flow: 65, contamination: 22, ozone: 120, contact: 14, temp: 18, ph: 7.2 },
        peak: { label: "Пиковые загрязнения", flow: 80, contamination: 60, ozone: 190, contact: 20, temp: 19, ph: 7.0 },
        cold: { label: "Холодный режим", flow: 58, contamination: 32, ozone: 160, contact: 18, temp: 8, ph: 7.4 },
        shock: { label: "Гидроудар", flow: 120, contamination: 26, ozone: 180, contact: 10, temp: 16, ph: 7.1 },
      },
      selectedScenario: "nominal",
      events: [],
      chart: null,
      stateChart: null,
      history: [],
      lastTick: 0,
    };
  },
  computed: {
    scenarioLabel() {
      return this.scenarios[this.selectedScenario].label;
    },
  },
  mounted() {
    this.initCharts();
    this.applyScenario();
    this.snapshot();
  },
  methods: {
    addModule() {
      if (!this.newModule.name.trim()) return;
      this.modules.push({
        id: Date.now(),
        name: this.newModule.name,
        type: this.newModule.type,
        efficiency: 0.85,
        loss: 0.06,
        rate: 50,
      });
      this.newModule.name = "";
      this.logEvent(`Добавлен модуль: ${this.modules.at(-1).name}`);
    },
    applyScenario() {
      const preset = this.scenarios[this.selectedScenario];
      this.inputs = { ...preset };
      this.logEvent(`Сценарий: ${preset.label}`);
      this.snapshot();
    },
    toggleSimulation() {
      this.running = !this.running;
      if (this.running) {
        this.lastTick = performance.now();
        requestAnimationFrame(this.loop);
        this.logEvent("Симуляция запущена.");
      } else {
        this.logEvent("Симуляция остановлена.");
      }
    },
    resetSimulation() {
      this.history = [];
      this.snapshot();
      this.logEvent("Состояние сброшено.");
    },
    logEvent(message) {
      const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      this.events.unshift({ id: Date.now(), message: `[${time}] ${message}` });
      if (this.events.length > 6) {
        this.events.pop();
      }
    },
    calculateControl(previous) {
      const feedforward = this.inputs.contamination * 1.35 + this.inputs.flow * 0.42;
      const feedbackQuality = (100 - previous.quality) * 0.85;
      const feedbackResidual = previous.residual > 0.5 ? -18 : 0;

      const targetOzone = clamp(feedforward + feedbackQuality + feedbackResidual, 40, 280);
      const rampLimit = 15;
      const ozone = clamp(
        this.control.ozone + clamp(targetOzone - this.control.ozone, -rampLimit, rampLimit),
        40,
        280
      );

      const targetContact = clamp(11 + this.inputs.contamination / 9 - (this.inputs.flow - 60) / 22, 6, 32);
      const contact = clamp(
        this.control.contact + clamp(targetContact - this.control.contact, -2, 2),
        6,
        32
      );

      this.control = {
        feedforward,
        feedbackQuality,
        feedbackResidual,
        ozone,
        contact,
      };

      return { ozone, contact };
    },
    calculateProcess(state) {
      const temp = state.temp + randomNoise(0.7);
      const ph = state.ph + randomNoise(0.1);
      const pressure = 1 + randomNoise(0.06);

      const temperatureFactor = clamp(1 - Math.abs(temp - 18) * 0.02, 0.6, 1.2);
      const phFactor = clamp(1 - Math.abs(ph - 7.2) * 0.11, 0.5, 1.15);
      const mixingEfficiency = clamp((state.ozone / (state.flow * 1.35)) * 0.92, 0.32, 1.35);

      const moduleBoost = this.modules.reduce((acc, module) => acc + module.efficiency, 0) / this.modules.length;
      const oxidation = clamp(
        (state.ozone * state.contact * mixingEfficiency * temperatureFactor * phFactor * pressure * moduleBoost) /
          (state.contamination * 44),
        0,
        1.5
      );

      return {
        quality: clamp(oxidation * 100, 10, 99),
        residual: clamp((state.ozone / state.flow) * 0.3 - oxidation * 0.1, 0, 2.8),
        efficiency: clamp(oxidation * 0.85 + mixingEfficiency * 0.15, 0.1, 1.2),
        energy: clamp(state.ozone * 0.016 + state.flow * 0.004 + 0.35, 0.4, 6.8),
        orp: clamp(540 + oxidation * 190 - state.contamination * 1.1, 420, 800),
        uv: clamp(2.0 + state.contamination / 11 - oxidation * 1.3, 0.4, 5.4),
        temp,
        ph,
      };
    },
    updateStatus(metrics) {
      this.status.loops = metrics.quality > 88 ? "Стабильно" : "Требует коррекции";
      this.status.risk = metrics.residual < 0.45 ? "Низкий" : "Средний";
    },
    snapshot() {
      const previous = this.history.at(-1) || { quality: this.metrics.quality, residual: this.metrics.residual };
      const control = this.calculateControl(previous);
      const state = {
        flow: this.inputs.flow,
        contamination: this.inputs.contamination,
        ozone: control.ozone,
        contact: control.contact,
        temp: this.inputs.temp,
        ph: this.inputs.ph,
      };

      const metrics = this.calculateProcess(state);
      this.metrics = {
        ...metrics,
        qualityNote: metrics.quality > 92 ? "норма" : "требуется корректировка",
        residualNote: metrics.residual < 0.45 ? "безопасно" : "контроль лимитов",
        energyNote: metrics.energy < 2.4 ? "оптимальный режим" : "повышенная нагрузка",
      };
      this.updateStatus(metrics);

      this.history.push({
        quality: metrics.quality,
        residual: metrics.residual,
        energy: metrics.energy,
        load: state.flow,
        orp: metrics.orp,
        uv: metrics.uv,
      });
      if (this.history.length > 80) this.history.shift();
      this.updateCharts();
    },
    loop(timestamp) {
      if (!this.running) return;
      if (timestamp - this.lastTick > 1000) {
        this.snapshot();
        this.lastTick = timestamp;
      }
      requestAnimationFrame(this.loop);
    },
    initCharts() {
      const trendCtx = document.getElementById("trendChart");
      const stateCtx = document.getElementById("stateChart");

      this.chart = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Качество", data: [], borderColor: "#38bdf8", tension: 0.35 },
            { label: "Residual O3", data: [], borderColor: "#f97316", tension: 0.35 },
            { label: "Энергия", data: [], borderColor: "#22c55e", tension: 0.35 },
            { label: "Нагрузка", data: [], borderColor: "#a855f7", tension: 0.35 },
          ],
        },
        options: {
          responsive: true,
          animation: { duration: 500 },
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.1)" } },
          },
        },
      });

      this.stateChart = new Chart(stateCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "ORP", data: [], borderColor: "#facc15", tension: 0.35 },
            { label: "UV254", data: [], borderColor: "#fb7185", tension: 0.35 },
          ],
        },
        options: {
          responsive: true,
          animation: { duration: 500 },
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148, 163, 184, 0.1)" } },
          },
        },
      });
    },
    updateCharts() {
      const labels = this.history.map((_, index) => index + 1);
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = this.history.map((point) => point.quality);
      this.chart.data.datasets[1].data = this.history.map((point) => point.residual);
      this.chart.data.datasets[2].data = this.history.map((point) => point.energy);
      this.chart.data.datasets[3].data = this.history.map((point) => point.load);
      this.chart.update();

      this.stateChart.data.labels = labels;
      this.stateChart.data.datasets[0].data = this.history.map((point) => point.orp);
      this.stateChart.data.datasets[1].data = this.history.map((point) => point.uv);
      this.stateChart.update();
    },
  },
}).mount("#app");
