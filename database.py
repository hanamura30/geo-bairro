"""
Camada de acesso ao banco de dados (SQLite) do Geo Bairro.

Duas tabelas:
- consultas: histórico de buscas por localidade (estado/cidade/bairro)
  feitas na tela principal, com o risco climático calculado (ODS 13).
- leituras_esp32: leituras reais enviadas pela estação meteorológica
  (ESP32 + DHT22 + BMP280 + MQ-135 + BH1750), quando o hardware
  estiver montado e enviando dados.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

# No Render, usa /tmp/ (gravável); localmente, usa a pasta do projeto
DB_PATH = Path("/tmp/geo_bairro.db") if os.path.exists("/tmp") else Path(__file__).parent / "geo_bairro.db"


@contextmanager
def conectar():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Cria as tabelas caso ainda não existam."""
    with conectar() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS consultas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                estado TEXT NOT NULL,
                cidade TEXT NOT NULL,
                bairro TEXT NOT NULL,
                municipio_encontrado TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                temperatura REAL,
                nivel_risco TEXT NOT NULL,
                data_hora TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leituras_esp32 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                temperatura REAL,
                umidade REAL,
                pressao REAL,
                qualidade_ar REAL,
                luminosidade REAL,
                data_hora TEXT NOT NULL
            )
            """
        )


def salvar_consulta(
    estado,
    cidade,
    bairro,
    municipio_encontrado,
    latitude,
    longitude,
    temperatura,
    nivel_risco,
):
    with conectar() as conn:
        conn.execute(
            """
            INSERT INTO consultas
                (estado, cidade, bairro, municipio_encontrado,
                 latitude, longitude, temperatura, nivel_risco, data_hora)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                estado,
                cidade,
                bairro,
                municipio_encontrado,
                latitude,
                longitude,
                temperatura,
                nivel_risco,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


def buscar_historico(limite=20):
    with conectar() as conn:
        linhas = conn.execute(
            """
            SELECT estado, cidade, bairro, municipio_encontrado,
                   temperatura, nivel_risco, data_hora
            FROM consultas
            ORDER BY id DESC
            LIMIT ?
            """,
            (limite,),
        ).fetchall()
        return [dict(linha) for linha in linhas]


def salvar_leitura(temperatura, umidade, pressao, qualidade_ar, luminosidade):
    """Grava uma leitura enviada pela estação ESP32."""
    with conectar() as conn:
        conn.execute(
            """
            INSERT INTO leituras_esp32
                (temperatura, umidade, pressao, qualidade_ar, luminosidade, data_hora)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                temperatura,
                umidade,
                pressao,
                qualidade_ar,
                luminosidade,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )


def buscar_ultima_leitura():
    """Retorna a leitura mais recente da estação, ou None se ainda não houver nenhuma."""
    with conectar() as conn:
        linha = conn.execute(
            """
            SELECT temperatura, umidade, pressao, qualidade_ar, luminosidade, data_hora
            FROM leituras_esp32
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
        return dict(linha) if linha else None


def buscar_leituras(limite=20):
    """Retorna as últimas leituras da estação, mais recente primeiro."""
    with conectar() as conn:
        linhas = conn.execute(
            """
            SELECT temperatura, umidade, pressao, qualidade_ar, luminosidade, data_hora
            FROM leituras_esp32
            ORDER BY id DESC
            LIMIT ?
            """,
            (limite,),
        ).fetchall()
        return [dict(linha) for linha in linhas]

