# Projeto GeoBairro - Estação Meteorológica para Cidades Inteligentes (IoT)

**\[ CLIQUE AQUI PARA ASSISTIR AO VÍDEO TÉCNICO DE DEMONSTRAÇÃO\]** *(https://drive.google.com/file/d/1WSdwq5R03OKUS3b-eThivCg7NLJddEKF/view?usp=sharing)*

## Visão Geral

O GeoBairro é uma estação meteorológica baseada em ESP32 projetada para monitoramento microclimático, visando aplicações em Cidades Inteligentes (Smart Cities). O sistema atua como um datalogger autônomo, coletando dados de sensores ambientais, armazenando-os localmente com precisão temporal e transmitindo telemetria via protocolo MQTT.

## Sumário

1. [Sobre o Projeto](#sobre-o-projeto)

2. [Arquitetura da Solução](#arquitetura-da-solução)

3. [Esquema Elétrico e Hardware](#esquema-elétrico-e-hardware)

4. [Detalhes Técnicos e Arquitetura](#detalhes-técnicos-e-arquitetura)

5. [Guia de Instalação e Configuração](#guia-de-instalação-e-configuração)

6. [Galeria e Demonstração](#-galeria-e-demonstração)

7. [Equipe](#-equipe)

## Sobre o Projeto

O sistema capta dados climáticos e de qualidade do ar através de uma estação baseada no microcontrolador ESP32. Estes dados são processados, persistidos localmente (para análises em planilhas) e enviados em tempo real para um Dashboard Web interativo.

**Principais Funcionalidades:**

* Monitoramento de *temperatura*, *umidade*, *pressão atmosférica*, *luminosidade* e *qualidade do ar*.

* Conexão Wi-Fi e sincronização de horário via protocolo NTP.

* Armazenamento de dados local em formato .csv (pronto para Microsoft Excel).

* Transmissão de telemetria via protocolo MQTT (broker público HiveMQ).

* Dashboard Web interativo com geolocalização (Leaflet) e integração com a API Open-Meteo.

## Arquitetura da Solução

O projeto é dividido em três camadas principais:

1. **Edge/Hardware (MicroPython):** Leitura dos sensores, estruturação do payload JSON e armazenamento em arquivo CSV.

2. **Comunicação (MQTT):** Envio dos dados em tempo real utilizando o tópico `estacao/dados` através do broker `broker.hivemq.com`.

3. **Frontend (HTML/CSS/JS):** Interface do usuário acessível pelo navegador que consome o MQTT para atualização em tempo real e a API *Open-Meteo* para previsão de 7 dias e alertas climáticos.

## Esquema Elétrico e Hardware

### Componentes Utilizados

* Placa de Desenvolvimento **ESP32**

* Sensor **DHT22** (Temperatura e umidade)

* Sensor **BMP280** (Pressão barométrica)

* Sensor **MQ-135** (Qualidade do ar)

* Sensor **LDR** (Luminosidade)

### Esquemático Eletrônico e Mapeamento de Pinos (Pinout)

Diagrama de ligações elétricas demonstrando o uso de barramento I2C, divisores de tensão e conexões de pull-up/pull-down:

<img width="500" height="400" alt="Esquemático eletrônico da Estação Meteorológica" src="https://github.com/user-attachments/assets/ff796573-2333-49c0-8e31-3a88628d4adb" />

| Componente | Pino ESP32 | Função/Protocolo | Notas Adicionais | 
| ----- | ----- | ----- | ----- | 
| **DHT22** | `GPIO 5` | Sinal Digital (1-Wire) | \- | 
| **BMP280 (SDA)** | `GPIO 21` | I²C | Compartilha barramento | 
| **BMP280 (SCL)** | `GPIO 22` | I²C | Compartilha barramento | 
| **MQ-135** | `GPIO 34` | Analógico (ADC) | Atenuação 11DB configurada | 
| **LDR** | `GPIO 23` | Sinal Digital | Configurado com resistor Pull-Up interno | 

> **Atenção à Alimentação:** O MQ-135 demanda maior corrente por conta de seu aquecedor interno. Recomenda-se separar os barramentos de alimentação na protoboard.

## Detalhes Técnicos e Arquitetura

### Autonomia de Hardware e Alimentação

A arquitetura física foi otimizada para garantir operação independente. A alimentação do circuito é gerenciada através de um roteamento específico de tensões (3.3V para lógica e 5V para sensores específicos), permitindo o uso de fontes externas. A conexão via cabo USB serve exclusivamente para a extração pontual do arquivo `dados.csv`.

### Sincronização Temporal (NTP)

Para garantir a integridade dos timestamps:

* A função `sincronizar_hora_ntp()` conecta o ESP32 ao servidor `pool.ntp.org`.

* O Relógio de Tempo Real (RTC) é ajustado automaticamente para o fuso horário de Brasília (UTC-3), mantendo a precisão mesmo após reinicializações.

### Armazenamento de Dados Local (CSV)

O código MicroPython (`main.py`) gera automaticamente um arquivo chamado `dados.csv` na raiz do sistema de arquivos do ESP32. A estrutura de gravação na memória Flash foca na localização (padrão Brasil):

* **Cabeçalho:** `data;hora;temperatura;umidade;pressao;qualidade_ar;luminosidade`.

* **Formatação:** Utiliza ponto e vírgula (`;`) como separador e converte pontos decimais para vírgulas, garantindo compatibilidade nativa com o Microsoft Excel em português.

Para extrair este arquivo, utilize a IDE Thonny (detalhes no Guia de Instalação).

### Resiliência e Tratamento de Erros

O firmware possui alto nível de tolerância a falhas. O uso extensivo de `try/except` (na inicialização I2C, NTP e MQTT) impede que falhas pontuais de rede travem o sistema. O datalogger continua gravando dados localmente (CSV) de forma ininterrupta até a comunicação ser restabelecida.

### Tratamento de Sensores (LDR)

A leitura do fotoresistor (Pino 23) utiliza o resistor de `PULL_UP` interno. O sinal digital é traduzido textualmente (`0` para **"CLARO"** e `1` para **"ESCURO"**), facilitando a leitura direta e o tratamento no backend.

## Guia de Instalação e Configuração

Siga os passos abaixo para reproduzir o projeto:

**1. Pré-requisitos:**

* Placa ESP32.

* Thonny IDE instalado no computador.

* Firmware MicroPython mais recente "flasheado" no ESP32.

**2. Clonando o Repositório:**

```
git clone https://github.com/hanamura30/geo-bairro.git

```

**3. Configuração do Código (Firmware):**

* Abra o arquivo `main.py` no Thonny IDE.

* Configure as credenciais da sua rede Wi-Fi e os dados do Broker MQTT nas variáveis globais do início do arquivo.

   ```
   WIFI_SSID = "SEU_WIFI"
   WIFI_SENHA = "SUA_SENHA"
   ```

* Salve os arquivos (`main.py`, `boot.py` e `bme280_float.py`) diretamente na memória do ESP32.

* Reinicie o ESP32 (botão EN/RST). Acompanhe o console no Thonny para confirmar a conexão MQTT e Wi-Fi.

**4. Execução do Backend:**

* No computador servidor, instale a biblioteca MQTT para Python: `pip install paho-mqtt`

* Execute o script de assinatura (Subscriber) para iniciar a coleta e persistência no banco de dados.

**5. Extraindo o Banco de Dados (CSV)**

* Com o ESP32 rodando via Thonny, pause a execução do código (Ctrl+C).

* Na aba lateral (Arquivos do Dispositivo), localize o arquivo `dados.csv`.

* Clique com o botão direito e selecione **"Fazer download para /..."** (Salvar no computador).

* Abra o arquivo com o Microsoft Excel.

**6. Executando o Dashboard Web**

O frontend não exige servidor backend local rodando, pois consome dados via Websockets (HiveMQ) e APIs abertas.

* Navegue até a pasta raiz onde estão `index.html`, `style.css` e `script.js`.

* Dê um duplo clique no arquivo `index.html` para abri-lo no seu navegador de preferência.

* Se o ESP32 estiver ligado e enviando dados para o MQTT, o dashboard atualizará a seção "Estação Local (ESP32)" automaticamente.

## Galeria e Demonstração

Abaixo está o funcionamento da nossa interface web, que consome os dados do broker MQTT e os exibe em tempo real:

https://github.com/user-attachments/assets/e578ea43-09fb-42d7-aaf2-7a7d564a52ca

Detalhes da montagem física na protoboard, destacando o ESP32 e a integração dos sensores:

<img width="400" height="300" alt="Protoboard com cabo jumper conectado" src="https://github.com/user-attachments/assets/1f161b1e-138c-41a7-a1f2-8a87944a05c7" />

<img width="400" height="300" alt="Protoboard com cabo USB de dados conectado" src="https://github.com/user-attachments/assets/ce428e9b-1238-42dd-851d-426c51b73e57" />

## Equipe

* **\[Hanaiquê Simomura Indicatti\]** - Matrícula: \[H8793A6\]

* **\[Lara Magalhães de Souza\]** - Matrícula: \[R310BD3\]

* **\[Vanessa Castro Silva\]** - Matrícula: \[R2365J9\]

Projeto de graduação para a disciplina **68F3 – Projeto e Desenvolvimento II** (Ciência da Computação).
