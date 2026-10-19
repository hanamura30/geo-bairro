/* ============================================================
   Geo Bairro — lógica de consulta e renderização (front-end)
   Versão final: MQTT para sensores + API Open-Meteo direta.
   ============================================================ */

const LOCAL_PADRAO = {
  estado: "SP",
  cidade: "São Paulo",
  bairro: "Estação ESP32",
};
const LAT_PADRAO = -23.5475;
const LON_PADRAO = -46.6361;

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const WEATHER_CODES = {
  0: ["Céu limpo", "sol"],
  1: ["Predomínio de sol", "sol-nuvem"],
  2: ["Parcialmente nublado", "sol-nuvem"],
  3: ["Nublado", "nuvem"],
  45: ["Neblina", "neblina"],
  48: ["Neblina com geada", "neblina"],
  51: ["Garoa leve", "garoa"],
  53: ["Garoa moderada", "garoa"],
  55: ["Garoa densa", "garoa"],
  56: ["Garoa congelante", "garoa"],
  57: ["Garoa congelante densa", "garoa"],
  61: ["Chuva leve", "chuva"],
  63: ["Chuva moderada", "chuva"],
  65: ["Chuva forte", "chuva"],
  66: ["Chuva congelante leve", "chuva"],
  67: ["Chuva congelante forte", "chuva"],
  71: ["Neve leve", "neve"],
  73: ["Neve moderada", "neve"],
  75: ["Neve forte", "neve"],
  77: ["Grãos de neve", "neve"],
  80: ["Pancadas de chuva leves", "chuva"],
  81: ["Pancadas de chuva moderadas", "chuva"],
  82: ["Pancadas de chuva violentas", "chuva"],
  85: ["Pancadas de neve leves", "neve"],
  86: ["Pancadas de neve fortes", "neve"],
  95: ["Trovoada", "tempestade"],
  96: ["Trovoada com granizo leve", "tempestade"],
  99: ["Trovoada com granizo forte", "tempestade"],
};

function descricaoClima(codigo) {
  return WEATHER_CODES[codigo]
    ? WEATHER_CODES[codigo][0]
    : "Condição desconhecida";
}
function categoriaIcone(codigo) {
  return WEATHER_CODES[codigo] ? WEATHER_CODES[codigo][1] : "nuvem";
}

function iconeSVG(categoria) {
  const icones = {
    sol: `<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>`,
    "sol-nuvem": `<circle cx="8" cy="9" r="3.2"/><path d="M8 3.5v1.6M3.5 9h1.6M12.5 9h-1M4.9 5.4l1.1 1.1M11 5.4l-1.1 1.1"/><path d="M8.5 16.5a4 4 0 0 1 .3-8c1.6-.1 3 .8 3.6 2.1a3.4 3.4 0 0 1 3.9 3.3 3.4 3.4 0 0 1-3.4 3.4H8.7"/>`,
    nuvem: `<path d="M7 17.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/>`,
    neblina: `<path d="M4 8h16M2 12h20M4 16h16M6 20h12"/>`,
    garoa: `<path d="M7 13.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M8 18v2M12 18v2M16 18v2"/>`,
    chuva: `<path d="M7 12.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M7.5 17.5 6 21M12 17.5 10.5 21M16.5 17.5 15 21"/>`,
    neve: `<path d="M7 12.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M8 17v4M6 19h4M13 17v4M11 19h4M17 17v3M15.5 18.5h3"/>`,
    tempestade: `<path d="M7 11.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="m13 14-2.5 4h3L11 22"/>`,
  };
  return `<svg class="icone-clima" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icones[categoria] || icones.nuvem}</svg>`;
}

// ---------------- Elementos do DOM ----------------
const mensagemErroEl = document.getElementById("mensagemErro");
const alertaContainer = document.getElementById("alertaClimaticoContainer");
const infograficoEl = document.getElementById("infografico");
const previsaoEl = document.getElementById("previsao");
const historicoEl = document.getElementById("historicoLista");
const leituraAtualizadaEmEl = document.getElementById("leituraAtualizadaEm");
const estacaoLatitudeEl = document.getElementById("estacaoLatitude");
const estacaoLongitudeEl = document.getElementById("estacaoLongitude");
const estacaoLocalidadeEl = document.getElementById("estacaoLocalidade");
let mapaEstacao = null;
let marcadorEstacao = null;

// ---------------- MQTT (Dados em tempo real) ----------------
const MQTT_BROKER = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_TOPIC = "estacao/dados";
let historicoLocal = []; // Armazena na memória do navegador

function conectarMQTT() {
  const client = mqtt.connect(MQTT_BROKER, {
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 30 * 1000,
  });

  client.on("connect", () => {
    console.log("✅ Conectado ao broker MQTT!");
    client.subscribe(MQTT_TOPIC);
  });

  client.on("message", (topic, message) => {
    if (topic === MQTT_TOPIC) {
      try {
        const dados = JSON.parse(message.toString());
        dados.data_hora = new Date().toISOString();

        historicoLocal.unshift(dados);
        if (historicoLocal.length > 10) historicoLocal.pop();

        renderizarLeituraSensor(dados);
        renderizarHistorico(historicoLocal);
      } catch (e) {
        console.error("Erro no JSON do MQTT:", e);
      }
    }
  });
}

function renderizarLeituraSensor(leitura) {
  const CAMPO_LEITURA = {
    temperatura: { id: "leitura-temperatura", unidade: "°C" },
    umidade: { id: "leitura-umidade", unidade: "%" },
    pressao: { id: "leitura-pressao", unidade: " hPa" },
    qualidade_ar: { id: "leitura-qualidade-ar", unidade: " ppm" },
    luminosidade: { id: "leitura-luminosidade", unidade: " " },
  };

  Object.entries(CAMPO_LEITURA).forEach(([chave, { id, unidade }]) => {
    const el = document.getElementById(id);
    if (el && leitura[chave] !== undefined) {
      el.textContent = `${leitura[chave]}${unidade}`;
    }
  });

  if (leituraAtualizadaEmEl && leitura.data_hora) {
    leituraAtualizadaEmEl.textContent = `Atualizado às ${formatarDataHora(leitura.data_hora)}`;
  }
}

function renderizarHistorico(linhas) {
  if (!historicoEl) return;
  if (linhas.length === 0) {
    historicoEl.innerHTML =
      '<p class="historico-vazio">Aguardando dados do ESP32 via MQTT...</p>';
    return;
  }
  historicoEl.innerHTML = linhas
    .map(
      (l) => `
    <div class="historico-item">
      <span class="historico-local">
        ${l.temperatura != null ? Math.round(l.temperatura) + "°C" : "—"} ·
        ${l.umidade != null ? Math.round(l.umidade) + "%" : "—"} ·
        ${l.pressao != null ? Math.round(l.pressao) + " hPa" : "—"} ·
        ${l.qualidade_ar != null ? Math.round(l.qualidade_ar) + " ppm" : "—"} ·
        ${l.luminosidade != null ? Math.round(l.luminosidade) + " lx" : "—"}
      </span>
      <span class="historico-data">${formatarDataHora(l.data_hora)}</span>
    </div>
  `,
    )
    .join("");
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ---------------- API Clima (Open-Meteo direto) ----------------
async function buscarClima() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT_PADRAO}&longitude=${LON_PADRAO}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Falha ao buscar clima");
  return await resp.json();
}

async function carregarBoletimPadrao() {
  limparErro();
  try {
    const dadosClima = await buscarClima();
    renderizarLocalizacao({
      latitude: LAT_PADRAO,
      longitude: LON_PADRAO,
      nome_localidade: `${LOCAL_PADRAO.cidade} - ${LOCAL_PADRAO.estado}`,
      bairro: LOCAL_PADRAO.bairro,
    });
    renderizarInfografico(dadosClima);
    renderizarPrevisao(dadosClima);

    const precipMax = Math.max(
      ...dadosClima.daily.precipitation_probability_max,
    );
    const risco =
      precipMax >= 70 ? "alto" : precipMax >= 40 ? "medio" : "baixo";
    renderizarAlerta(risco, LOCAL_PADRAO.bairro);
  } catch (erro) {
    console.error(erro);
    mostrarErro("Erro ao carregar previsão do tempo.");
  }
}

// ---------------- Funções Visuais ----------------
function mostrarErro(texto) {
  if (mensagemErroEl) {
    mensagemErroEl.textContent = texto;
    mensagemErroEl.style.display = "block";
  }
}
function limparErro() {
  if (mensagemErroEl) mensagemErroEl.style.display = "none";
}

function renderizarLocalizacao(dados) {
  if (estacaoLatitudeEl)
    estacaoLatitudeEl.textContent = dados.latitude.toFixed(6);
  if (estacaoLongitudeEl)
    estacaoLongitudeEl.textContent = dados.longitude.toFixed(6);
  if (estacaoLocalidadeEl)
    estacaoLocalidadeEl.textContent = `${dados.nome_localidade} — ${dados.bairro}`;
  if (typeof L === "undefined") return;

  const ponto = [dados.latitude, dados.longitude];
  if (!mapaEstacao) {
    mapaEstacao = L.map("mapaEstacao").setView(ponto, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(mapaEstacao);
    marcadorEstacao = L.marker(ponto).addTo(mapaEstacao);
  } else {
    mapaEstacao.setView(ponto, 13);
    marcadorEstacao.setLatLng(ponto);
  }
  marcadorEstacao.bindPopup(
    `Estação Geo Bairro<br>(${dados.latitude}, ${dados.longitude})`,
  );
}

function renderizarInfografico(dados) {
  const atual = dados.current;
  infograficoEl.innerHTML = `
    <div class="infografico-hero">
      <span class="temp-valor">${Math.round(atual.temperature_2m)}</span><span class="temp-unidade">°C</span>
    </div>
    <div class="infografico-descricao">
      ${iconeSVG(categoriaIcone(atual.weather_code))}
      <span class="descricao-texto">${descricaoClima(atual.weather_code)}</span>
    </div>
    <div class="infografico-stats">
      <div class="stat-linha"><span class="stat-label">Sensação térmica</span><span class="stat-valor">${Math.round(atual.apparent_temperature)}°C</span></div>
      <div class="stat-linha"><span class="stat-label">Umidade relativa</span><span class="stat-valor">${Math.round(atual.relative_humidity_2m)}%</span></div>
      <div class="stat-linha"><span class="stat-label">Vento</span><span class="stat-valor">${Math.round(atual.wind_speed_10m)} km/h</span></div>
      <div class="stat-linha"><span class="stat-label">Precipitação atual</span><span class="stat-valor">${atual.precipitation} mm</span></div>
    </div>
    <p class="localidade-nota">Dados de ${LOCAL_PADRAO.cidade} — referência de bairro: ${LOCAL_PADRAO.bairro}.</p>
  `;
}

function renderizarPrevisao(dados) {
  const dias = dados.daily.time;
  previsaoEl.innerHTML = "";
  dias.forEach((dataISO, i) => {
    const data = new Date(dataISO + "T00:00:00");
    const max = Math.round(dados.daily.temperature_2m_max[i]);
    const min = Math.round(dados.daily.temperature_2m_min[i]);
    const precip = dados.daily.precipitation_probability_max[i];
    let corSeveridade =
      precip >= 70
        ? "var(--color-risco-alto)"
        : precip >= 40
          ? "var(--color-risco-medio)"
          : "var(--color-teal)";

    const card = document.createElement("div");
    card.className = "dia-card";
    card.style.setProperty("--cor-severidade", corSeveridade);
    card.innerHTML = `
      <span class="dia-nome">${i === 0 ? "Hoje" : DIAS_SEMANA[data.getDay()]}</span>
      <span class="dia-data">${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
      ${iconeSVG(categoriaIcone(dados.daily.weather_code[i]))}
      <span class="dia-temps"><strong>${max}°</strong> <span class="temp-min">${min}°</span></span>
      <div class="precip-barra" style="--precip:${precip}%"><span></span></div>
      <span class="precip-valor">${precip}% chuva</span>
    `;
    previsaoEl.appendChild(card);
  });
}

function renderizarAlerta(nivel, bairro) {
  const config = {
    alto: {
      classe: "risco-alto",
      titulo: "⚠️ Alerta Climático (ODS 13):",
      texto: `Alta probabilidade de chuva intensa em ${bairro}. Evite áreas de alagamento.`,
    },
    medio: {
      classe: "risco-medio",
      titulo: "Atenção (ODS 13):",
      texto: `Chance moderada de chuva em ${bairro}. Acompanhe a previsão.`,
    },
    baixo: {
      classe: "risco-baixo",
      titulo: "Condições estáveis (ODS 13):",
      texto: `Sem sinais de risco climático relevante para ${bairro}.`,
    },
  };
  const { classe, titulo, texto } = config[nivel];
  alertaContainer.innerHTML = `<div class="alerta-box ${classe}"><div><strong>${titulo}</strong> ${texto}</div></div>`;
  alertaContainer.style.display = "block";
}

// ---------------- Inicialização ----------------
document.addEventListener("DOMContentLoaded", () => {
  conectarMQTT(); // Liga a recepção em tempo real
  carregarBoletimPadrao(); // Busca previsão do tempo 1 vez
  setInterval(carregarBoletimPadrao, 900000); // Atualiza previsão a cada 15 min
});
