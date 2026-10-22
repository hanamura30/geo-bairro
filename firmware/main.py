from machine import Pin, ADC, I2C
import dht
import time
import network
import json
from umqtt.simple import MQTTClient

# --- Configuração Wi-Fi ---
WIFI_SSID = "celular hanamura"
WIFI_SENHA = "hanaique"

# --- Configuração MQTT (Dashboard no GitHub Pages) ---
MQTT_BROKER = "broker.hivemq.com"
MQTT_CLIENT_ID = "ESP32_GeoBairro_Hanamura"
MQTT_TOPIC = b"estacao/dados"

# --- Configuração do Banco de Dados Local ---
ARQUIVO_CSV = "dados.csv"

# --- Inicialização dos sensores ---
sensor_dht = dht.DHT22(Pin(5))
ldr = Pin(23, Pin.IN, Pin.PULL_UP)

adc_mq = ADC(Pin(34))
adc_mq.atten(ADC.ATTN_11DB)

i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=100000)
try:
    from bme280_float import BME280
    bmp = BME280(i2c=i2c)
    print("BMP280 inicializado com sucesso.")
except Exception as e:
    print(f"Erro ao inicializar BMP280: {e}")
    bmp = None

def sincronizar_hora_ntp():
    import ntptime
    import utime
    print("Sincronizando hora com a internet...")
    try:
        # Servidor do Google para pegar a hora certa
        ntptime.host = 'pool.ntp.org'
        ntptime.settime()
        
        #horário de Brasília (UTC-3)
        # 3 horas = 3 * 3600 segundos
        hora_atual = utime.time() - (3 * 3600)
        
        # Atualiza o relógio interno do ESP32
        import machine
        machine.RTC().datetime(utime.localtime(hora_atual))
    except Exception as e:
        print(f"Falha ao sincronizar hora (usando hora interna): {e}")

def conectar_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando ao Wi-Fi...")
        wlan.connect(WIFI_SSID, WIFI_SENHA)
        tentativas = 0
        while not wlan.isconnected() and tentativas < 20:
            time.sleep(1)
            tentativas += 1
    if wlan.isconnected():
        print(f"Wi-Fi conectado! IP: {wlan.ifconfig()[0]}")
        return True
    else:
        print("Falha ao conectar ao Wi-Fi.")
        return False

def inicializar_csv():
    try:
        with open(ARQUIVO_CSV, 'r') as f:
            pass # Arquivo já existe
    except OSError:
        # Novo cabeçalho com colunas de Data e Hora separadas
        with open(ARQUIVO_CSV, 'w') as f:
            f.write("data;hora;temperatura;umidade;pressao;qualidade_ar;luminosidade\n")
            print("Arquivo de banco de dados CSV criado (Data e Hora separadas).")

def salvar_no_csv(payload):
    try:
        import utime
        
        # Converte os valores para string e troca ponto por vírgula
        temp = str(payload.get("temperatura", "")).replace(".", ",")
        umid = str(payload.get("umidade", "")).replace(".", ",")
        pressao = str(payload.get("pressao", "")).replace(".", ",")
        ar = str(payload.get("qualidade_ar", ""))
        luz = str(payload.get("luminosidade", ""))
        
        # Pega o tempo atual e formata separadamente
        t = utime.localtime()
        data_formatada = "{:02d}/{:02d}/{:04d}".format(t[2], t[1], t[0]) # Ex: 22/10/2026
        hora_formatada = "{:02d}:{:02d}:{:02d}".format(t[3], t[4], t[5]) # Ex: 17:30:00
        
        # Monta a linha com as colunas separadas por ponto e vírgula
        linha = f"{data_formatada};{hora_formatada};{temp};{umid};{pressao};{ar};{luz}\n"
        
        with open(ARQUIVO_CSV, 'a') as f:
            f.write(linha)
        print("Salvo no CSV local.")
    except Exception as e:
        print(f"Erro ao salvar no CSV: {e}")

def main():
    conectar_wifi()
    sincronizar_hora_ntp()
    inicializar_csv()

    print("Conectando ao Broker MQTT...")
    client = MQTTClient(MQTT_CLIENT_ID, MQTT_BROKER)
    try:
        client.connect()
        print("MQTT Conectado com sucesso!")
    except Exception as e:
        print(f"Erro MQTT: {e}")
        client = None

    while True:
        try:
            sensor_dht.measure()
            temp = sensor_dht.temperature()
            umid = sensor_dht.humidity()

            if bmp:
                valores = bmp.values
                pressao = float(valores[1].replace("hPa", ""))
            else:
                pressao = None

            qualidade_ar = adc_mq.read()
            luz = ldr.value()
            status_luz= "CLARO" if luz==0 else "ESCURO"
            
            # Payload para o CSV e MQTT
            payload = {
                "temperatura": round(temp, 1),
                "umidade": round(umid, 1),
                "pressao": round(pressao, 2) if pressao else None,
                "qualidade_ar": qualidade_ar,
                "luminosidade": status_luz,
            }
            
            print(f"Temp: {temp}°C | Umid: {umid}% | Pressão: {pressao} hPa | Ar: {qualidade_ar} | Luz: {status_luz}")

            # 1. Salva no CSV
            salvar_no_csv(payload)

            # 2. Envia via MQTT
            if client:
                try:
                    client.publish(MQTT_TOPIC, json.dumps(payload))
                    print("Publicado no MQTT (Dashboard).")
                except Exception as e:
                    print(f"Erro MQTT: {e}")

            print("-" * 40)

        except OSError as e:
            print(f"Erro na leitura: {e}")

        time.sleep(10)

if __name__ == "__main__":
    main()
