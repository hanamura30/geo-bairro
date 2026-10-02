/* ============================================================
   Geo Bairro — lógica de consulta e renderização (front-end)
   Todo o acesso à API passa pelo back-end Flask, que também
   grava e lê os dados no SQLite.

   IMPORTANTE: o back-end (pasta backend/) precisa estar rodando
   em http://127.0.0.1:5000 para o site funcionar.
   ============================================================ */

const API_BASE = '';

// A busca por localidade foi removida da tela. O boletim e a previsão
// abaixo usam esta localidade fixa — troque pelos dados da sua cidade.
const LOCAL_PADRAO = { estado: 'SP', cidade: 'São Paulo', bairro: 'Estação ESP32' };

// Intervalo (ms) de atualização automática da leitura da estação física.
const INTERVALO_ATUALIZACAO_SENSOR = 8000;

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const WEATHER_CODES = {
  0: ['Céu limpo', 'sol'],
  1: ['Predomínio de sol', 'sol-nuvem'],
  2: ['Parcialmente nublado', 'sol-nuvem'],
  3: ['Nublado', 'nuvem'],
  45: ['Neblina', 'neblina'],
  48: ['Neblina com geada', 'neblina'],
  51: ['Garoa leve', 'garoa'],
  53: ['Garoa moderada', 'garoa'],
  55: ['Garoa densa', 'garoa'],
  56: ['Garoa congelante', 'garoa'],
  57: ['Garoa congelante densa', 'garoa'],
  61: ['Chuva leve', 'chuva'],
  63: ['Chuva moderada', 'chuva'],
  65: ['Chuva forte', 'chuva'],
  66: ['Chuva congelante leve', 'chuva'],
  67: ['Chuva congelante forte', 'chuva'],
  71: ['Neve leve', 'neve'],
  73: ['Neve moderada', 'neve'],
  75: ['Neve forte', 'neve'],
  77: ['Grãos de neve', 'neve'],
  80: ['Pancadas de chuva leves', 'chuva'],
  81: ['Pancadas de chuva moderadas', 'chuva'],
  82: ['Pancadas de chuva violentas', 'chuva'],
  85: ['Pancadas de neve leves', 'neve'],
  86: ['Pancadas de neve fortes', 'neve'],
  95: ['Trovoada', 'tempestade'],
  96: ['Trovoada com granizo leve', 'tempestade'],
  99: ['Trovoada com granizo forte', 'tempestade']
};

function descricaoClima(codigo) {
  return WEATHER_CODES[codigo] ? WEATHER_CODES[codigo][0] : 'Condição desconhecida';
}

function categoriaIcone(codigo) {
  return WEATHER_CODES[codigo] ? WEATHER_CODES[codigo][1] : 'nuvem';
}

function iconeSVG(categoria) {
  const icones = {
    sol: `<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>`,
    'sol-nuvem': `<circle cx="8" cy="9" r="3.2"/><path d="M8 3.5v1.6M3.5 9h1.6M12.5 9h-1M4.9 5.4l1.1 1.1M11 5.4l-1.1 1.1"/><path d="M8.5 16.5a4 4 0 0 1 .3-8c1.6-.1 3 .8 3.6 2.1a3.4 3.4 0 0 1 3.9 3.3 3.4 3.4 0 0 1-3.4 3.4H8.7"/>`,
    nuvem: `<path d="M7 17.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/>`,
    neblina: `<path d="M4 8h16M2 12h20M4 16h16M6 20h12"/>`,
    garoa: `<path d="M7 13.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M8 18v2M12 18v2M16 18v2"/>`,
    chuva: `<path d="M7 12.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M7.5 17.5 6 21M12 17.5 10.5 21M16.5 17.5 15 21"/>`,
    neve: `<path d="M7 12.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="M8 17v4M6 19h4M13 17v4M11 19h4M17 17v3M15.5 18.5h3"/>`,
    tempestade: `<path d="M7 11.5a4 4 0 0 1 .4-8c1.7-.2 3.2.8 3.8 2.2a3.6 3.6 0 0 1 4.1 3.5 3.6 3.6 0 0 1-3.6 3.6H7.4"/><path d="m13 14-2.5 4h3L11 22"/>`
  };
  const miolo = icones[categoria] || icones.nuvem;
  return `<svg class="icone-clima" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${miolo}</svg>`;
}

// ---------------- Elementos do DOM ----------------

const mensagemErroEl = document.getElementById('mensagemErro');
const alertaContainer = document.getElementById('alertaClimaticoContainer');
const infograficoEl = document.getElementById('infografico');
const previsaoEl = document.getElementById('previsao');
const historicoEl = document.getElementById('historicoLista');
const leituraAtualizadaEmEl = document.getElementById('leituraAtualizadaEm');
const estacaoLatitudeEl = document.getElementById('estacaoLatitude');
const estacaoLongitudeEl = document.getElementById('estacaoLongitude');
const estacaoLocalidadeEl = document.getElementById('estacaoLocalidade');
let mapaEstacao = null;
let marcadorEstacao = null;

function mostrarErro(texto) {
  if (!mensagemErroEl) return;
  mensagemErroEl.textContent = texto;
  mensagemErroEl.style.display = 'block';
}

function limparErro() {
  if (mensagemErroEl) mensagemErroEl.style.display = 'none';
}

// ---------------- Consulta ao back-end (Flask) ----------------

async function buscarClima(estado, cidade, bairro) {
  const params = new URLSearchParams({ estado, cidade, bairro });
  const resp = await fetch(`${API_BASE}/api/clima?${params.toString()}`);
  const dados = await resp.json();

  if (!resp.ok) {
    throw new Error(dados.erro || 'Não foi possível obter os dados climáticos agora.');
  }

  return dados;
}

async function carregarBoletimPadrao() {
  limparErro();
  try {
    const dadosClima = await buscarClima(LOCAL_PADRAO.estado, LOCAL_PADRAO.cidade, LOCAL_PADRAO.bairro);
    renderizarLocalizacao(dadosClima);
    renderizarInfografico(dadosClima, dadosClima.nome_localidade, LOCAL_PADRAO.bairro);
    renderizarPrevisao(dadosClima);
    renderizarAlerta(dadosClima.risco, LOCAL_PADRAO.bairro);
  } catch (erro) {
    console.error(erro);
    mostrarErro(erro.message || 'Não foi possível obter os dados meteorológicos agora.');
  }
}

// ---------------- Localização da estação / Geometria Analítica ----------------

function renderizarLocalizacao(dados) {
  const lat = Number(dados.latitude);
  const lon = Number(dados.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  if (estacaoLatitudeEl) estacaoLatitudeEl.textContent = lat.toFixed(6);
  if (estacaoLongitudeEl) estacaoLongitudeEl.textContent = lon.toFixed(6);
  if (estacaoLocalidadeEl) {
    estacaoLocalidadeEl.textContent = `${dados.nome_localidade}${dados.bairro ? ' — ' + dados.bairro : ''}`;
  }

  if (typeof L === 'undefined') return;
  const ponto = [lat, lon];
  if (!mapaEstacao) {
    mapaEstacao = L.map('mapaEstacao').setView(ponto, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaEstacao);
    marcadorEstacao = L.marker(ponto).addTo(mapaEstacao);
  } else {
    mapaEstacao.setView(ponto, 13);
    marcadorEstacao.setLatLng(ponto);
  }
  marcadorEstacao.bindPopup(`Estação Geo Bairro<br>(${lat.toFixed(6)}, ${lon.toFixed(6)})`);
}

// ---------------- Leitura em tempo real da estação física ----------------

const CAMPO_LEITURA = {
  temperatura: { id: 'leitura-temperatura', unidade: '°C' },
  umidade: { id: 'leitura-umidade', unidade: '%' },
  pressao: { id: 'leitura-pressao', unidade: ' hPa' },
  qualidade_ar: { id: 'leitura-qualidade-ar', unidade: ' ppm' },
  luminosidade: { id: 'leitura-luminosidade', unidade: ' ' }
};

async function atualizarLeituraSensor() {
  try {
    const resp = await fetch(`${API_BASE}/api/leituras/ultima`);
    if (!resp.ok) return;
    const leitura = await resp.json();
    renderizarLeituraSensor(leitura);
  } catch (erro) {
    console.error(erro);
  }
}

function renderizarLeituraSensor(leitura) {
  Object.entries(CAMPO_LEITURA).forEach(([chave, { id, unidade }]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const valor = leitura ? leitura[chave] : null;
    el.textContent = (valor === null || valor === undefined) ? '—' : `${valor}${unidade}`;
  });

  if (!leituraAtualizadaEmEl) return;
  if (!leitura) {
    leituraAtualizadaEmEl.textContent = 'Aguardando a primeira leitura do hardware...';
    return;
  }
  leituraAtualizadaEmEl.textContent = `Atualizado às ${formatarDataHora(leitura.data_hora)}`;
}

// ---------------- Histórico de leituras da estação ----------------

async function carregarHistorico() {
  if (!historicoEl) return;
  try {
    const resp = await fetch(`${API_BASE}/api/leituras?limite=10`);
    if (!resp.ok) return;
    renderizarHistorico(await resp.json());
  } catch (erro) {
    console.error(erro);
  }
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function renderizarHistorico(linhas) {
  if (!linhas || linhas.length === 0) {
    historicoEl.innerHTML = '<p class="historico-vazio">Nenhuma leitura registrada ainda.</p>';
    return;
  }

  historicoEl.innerHTML = linhas.map(l => `
    <div class="historico-item">
      <span class="historico-local">
        ${l.temperatura != null ? Math.round(l.temperatura) + '°C' : '—'} ·
        ${l.umidade != null ? Math.round(l.umidade) + '%' : '—'} ·
        ${l.pressao != null ? Math.round(l.pressao) + ' hPa' : '—'} ·
        ${l.qualidade_ar != null ? Math.round(l.qualidade_ar) + ' ppm' : '—'} ·
        ${l.luminosidade != null ? Math.round(l.luminosidade) + ' lx' : '—'}
      </span>
      <span class="historico-data">${formatarDataHora(l.data_hora)}</span>
    </div>
  `).join('');
}

// ---------------- Boletim / Previsão / Alerta (mesma lógica de antes) ----------------

function renderizarInfografico(dados, localidade, bairro) {
  const atual = dados.current;
  const categoria = categoriaIcone(atual.weather_code);

  infograficoEl.innerHTML = `
    <div class="infografico-hero">
      <span class="temp-valor">${Math.round(atual.temperature_2m)}</span>
      <span class="temp-unidade">°C</span>
    </div>
    <div class="infografico-descricao">
      ${iconeSVG(categoria)}
      <span class="descricao-texto">${descricaoClima(atual.weather_code)}</span>
    </div>
    <div class="infografico-stats">
      <div class="stat-linha">
        <span class="stat-label">Sensação térmica</span>
        <span class="stat-valor">${Math.round(atual.apparent_temperature)}°C</span>
      </div>
      <div class="stat-linha">
        <span class="stat-label">Umidade relativa</span>
        <span class="stat-valor">${Math.round(atual.relative_humidity_2m)}%</span>
      </div>
      <div class="stat-linha">
        <span class="stat-label">Vento</span>
        <span class="stat-valor">${Math.round(atual.wind_speed_10m)} km/h</span>
      </div>
      <div class="stat-linha">
        <span class="stat-label">Precipitação atual</span>
        <span class="stat-valor">${atual.precipitation} mm</span>
      </div>
    </div>
    <p class="localidade-nota">
      Dados de ${localidade}${bairro ? ' — referência de bairro: ' + bairro : ''}.
      A previsão é calculada para o município; a estação meteorológica não possui granularidade por bairro.
    </p>
  `;
}

function renderizarPrevisao(dados) {
  const dias = dados.daily.time;
  previsaoEl.innerHTML = '';

  dias.forEach((dataISO, i) => {
    const data = new Date(dataISO + 'T00:00:00');
    const nomeDia = DIAS_SEMANA[data.getDay()];
    const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const codigo = dados.daily.weather_code[i];
    const max = Math.round(dados.daily.temperature_2m_max[i]);
    const min = Math.round(dados.daily.temperature_2m_min[i]);
    const precip = dados.daily.precipitation_probability_max[i];
    const categoria = categoriaIcone(codigo);

    let corSeveridade = 'var(--color-teal)';
    if (precip >= 70) corSeveridade = 'var(--color-risco-alto)';
    else if (precip >= 40) corSeveridade = 'var(--color-risco-medio)';

    const card = document.createElement('div');
    card.className = 'dia-card';
    card.style.setProperty('--cor-severidade', corSeveridade);
    card.innerHTML = `
      <span class="dia-nome">${i === 0 ? 'Hoje' : nomeDia}</span>
      <span class="dia-data">${dataFormatada}</span>
      ${iconeSVG(categoria)}
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
      classe: 'risco-alto',
      titulo: '⚠️ Alerta Climático Preventivo (ODS 13):',
      texto: `Alta probabilidade de chuva intensa e/ou rajadas de vento fortes em ${bairro || 'sua região'}. Evite áreas de alagamento e fique atento a comunicados da Defesa Civil.`
    },
    medio: {
      classe: 'risco-medio',
      titulo: 'Atenção (ODS 13):',
      texto: `Chance moderada de chuva ou vento nos próximos dias em ${bairro || 'sua região'}. Acompanhe a previsão ao longo da semana.`
    },
    baixo: {
      classe: 'risco-baixo',
      titulo: 'Condições estáveis (ODS 13):',
      texto: `Sem sinais de risco climático relevante para ${bairro || 'sua região'} nos próximos dias.`
    }
  };

  const { classe, titulo, texto } = config[nivel];
  alertaContainer.innerHTML = `
    <div class="alerta-box ${classe}">
      <div>
        <strong>${titulo}</strong> ${texto}
      </div>
    </div>
  `;
  alertaContainer.style.display = 'block';
  alertaContainer.classList.remove('visivel');
  void alertaContainer.offsetWidth;
  alertaContainer.classList.add('visivel');
}

// ---------------- Inicialização ----------------

document.addEventListener('DOMContentLoaded', () => {
  carregarBoletimPadrao();
  atualizarLeituraSensor();
  carregarHistorico();

  setInterval(() => {
    atualizarLeituraSensor();
    carregarHistorico();
  }, INTERVALO_ATUALIZACAO_SENSOR);
});
