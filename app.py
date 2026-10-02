"""
Geo Bairro — back-end Flask.

Responsabilidades:
- Geocodificar município + UF e buscar a previsão do tempo na API
  gratuita Open-Meteo (o front-end não fala mais direto com ela).
- Calcular o nível de risco climático (ODS 13).
- Persistir cada consulta no SQLite (histórico).
- Servir os arquivos estáticos do front-end (front e back juntos).
"""

import threading
import unicodedata
import webbrowser
from datetime import datetime

import httpx
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from database import (
    buscar_historico,
    buscar_leituras,
    buscar_ultima_leitura,
    init_db,
    salvar_consulta,
    salvar_leitura,
)
# ===== FORÇA A CRIAÇÃO DAS TABELAS =====
try:
    from database import init_db
    init_db()
    print("✅ Banco de dados inicializado com sucesso!")
except Exception as e:
    print(f"❌ Erro ao inicializar banco: {e}")
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)  # permite que o front-end (porta diferente, ex: Live Server 5500) chame a API

UF_NOMES = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão",
    "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco",
    "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima",
    "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe",
    "TO": "Tocantins",
}
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"




def normalizar(texto):
    texto = unicodedata.normalize("NFD", texto or "")
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto.strip().lower()



def buscar_coordenadas(cidade, uf):
    try:
        with httpx.Client(timeout=30.0, http2=True) as client:
            resp = client.get(
                GEOCODING_URL,
                params={"name": cidade, "count": 10, "language": "pt", "format": "json"},
            )
            resp.raise_for_status()
            resultados = resp.json().get("results") or []
            candidatos_br = [r for r in resultados if r.get("country_code") == "BR"]
            if not candidatos_br:
                return None

            nome_estado = UF_NOMES.get(uf.upper())
            escolhido = None
            if nome_estado:
                for r in candidatos_br:
                    if normalizar(r.get("admin1")) == normalizar(nome_estado):
                        escolhido = r
                        break

            return escolhido or candidatos_br[0]
    except httpx.RequestError as e:
        print(f"❌ ERRO GEOCODIFICAÇÃO: {type(e).__name__} - {e}")
        raise


def buscar_previsao(lat, lon):
    try:
        with httpx.Client(timeout=30.0, http2=True) as client:
            resp = client.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
                    "timezone": "auto",
                    "forecast_days": 7,
                },
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.RequestError as e:
        print(f"❌ ERRO PREVISÃO: {type(e).__name__} - {e}")
        raise


def avaliar_risco(daily):
    """Risco preventivo (ODS 13) com base nos próximos 2 dias."""
    janela = min(2, len(daily["time"]))
    precip_max = max(daily["precipitation_probability_max"][:janela], default=0)
    vento_max = max(daily["wind_speed_10m_max"][:janela], default=0)

    if precip_max >= 70 or vento_max >= 50:
        return "alto"
    if precip_max >= 40 or vento_max >= 35:
        return "medio"
    return "baixo"




@app.route("/api/clima")
def api_clima():
    try:
        estado = (request.args.get("estado") or "").strip()
        cidade = (request.args.get("cidade") or "").strip()
        bairro = (request.args.get("bairro") or "").strip()

        if not estado or not cidade or not bairro:
            return jsonify({"erro": "Preencha estado, município e bairro."}), 400

        localidade = buscar_coordenadas(cidade, estado)
        if not localidade:
            return jsonify({"erro": f'Não encontramos "{cidade} - {estado.upper()}".'}), 404

        dados_clima = buscar_previsao(localidade["latitude"], localidade["longitude"])
        risco = avaliar_risco(dados_clima["daily"])
        nome_localidade = f'{localidade["name"]} - {localidade.get("admin1", estado.upper())}'

        salvar_consulta(
            estado=estado.upper(),
            cidade=cidade,
            bairro=bairro,
            municipio_encontrado=nome_localidade,
            latitude=localidade["latitude"],
            longitude=localidade["longitude"],
            temperatura=dados_clima["current"]["temperature_2m"],
            nivel_risco=risco,
        )

        return jsonify({
            "nome_localidade": nome_localidade,
            "bairro": bairro,
            "latitude": localidade["latitude"],
            "longitude": localidade["longitude"],
            "current": dados_clima["current"],
            "daily": dados_clima["daily"],
            "risco": risco,
        })
    except Exception as e:
        print(f"❌ ERRO /api/clima: {type(e).__name__} - {e}")
        return jsonify({"erro": str(e)}), 500


@app.route("/api/historico")
def api_historico():
    limite = request.args.get("limite", default=8, type=int)
    return jsonify(buscar_historico(limite))



@app.route("/api/leituras", methods=["GET", "POST"])
def api_leituras():
    try:
        if request.method == "POST":
            dados = request.get_json(silent=True) or {}
            salvar_leitura(
                temperatura=dados.get("temperatura"),
                umidade=dados.get("umidade"),
                pressao=dados.get("pressao"),
                qualidade_ar=dados.get("qualidade_ar"),
                luminosidade=dados.get("luminosidade"),
            )
            return jsonify({"status": "ok"}), 201

        limite = request.args.get("limite", default=20, type=int)
        return jsonify(buscar_leituras(limite))
    except Exception as e:
        print(f"❌ ERRO /api/leituras: {type(e).__name__} - {e}")
        return jsonify({"erro": str(e)}), 500