from flask import Flask, jsonify, Response
from prometheus_client import Counter, Histogram, generate_latest
import time

app = Flask(__name__)

# --- MÉTRICAS PROMETHEUS ---
# Contador total de requests
REQUEST_COUNT = Counter(
    'app_requests_total',
    'Total de requests recibidas'
)

# Histograma para medir latencia (p95)
REQUEST_LATENCY = Histogram(
    'app_request_latency_seconds',
    'Latencia por request'
)


@app.route('/')
def home():
    start = time.time()      # Tiempo inicial
    REQUEST_COUNT.inc()      # Sumar 1 request

    # --- TU RESPUESTA ---
    respuesta = jsonify({"mensaje": "¡Hola desde mi primer servicio web monitoreado!"})

    # Guardamos la latencia
    REQUEST_LATENCY.observe(time.time() - start)

    return respuesta


# --- ENDPOINT PARA PROMETHEUS ---
@app.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype="text/plain")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
