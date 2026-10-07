# Boot Sequence

## Yerel `sh run.sh`

1. Script kendi dizinine gecer ve `.venv/bin/python` arar; yoksa `sh install.sh` ister.
2. Varsa `.env` export edilerek yuklenir. Shell'den gelen bos olmayan degerler `.env` degerlerine onceliklidir.
3. `CHATBOT_API_TOKEN` yoksa `MODEL_PROVIDER` zorla `simulation` olur. Inference servis tokeni yoksa rastgele uretilir.
4. Inference Uvicorn sureci `INFERENCE_HOST:INFERENCE_PORT` adresinde arka planda baslar.
5. Gateway Uvicorn sureci `$HOST:$PORT` adresinde baslar. `UI_AUTO_AUTH=true` ve gateway tokeni varsa ana sayfa HttpOnly cookie verir.
6. Tokenless sim modunda cookie gerekmez; ayni-origin API yazma istekleri kabul edilir.
7. `Ctrl+C`, gateway'i kapatir ve trap inference alt surecini durdurur.

## Compose boot

1. Gateway, inference ve PostgreSQL imajlarini hazirlar.
2. Postgres healthcheck `pg_isready` ile saglikli olana kadar gateway bekler.
3. Inference, gateway ile ayni ozel network'te baslar.
4. GPU override kullaniliyorsa `llama` servisi inference'e ozel agda baslar ve GGUF volume'unu read-only baglar.
5. Gateway portu varsayilan olarak host loopback'ine (`127.0.0.1:8000`) yayinlanir.

## Hazirlik sinyalleri

- Gateway: `GET /api/health` -> `{"status":"ok"}`.
- Inference: Compose aginda `GET /internal/health`; production disina yayinlanmaz.
- Compose: PostgreSQL `service_healthy` kosulu.

Yerel SQLite tablolarini `gateway.store` import sirasinda olusturur. PostgreSQL'de de ayni `metadata.create_all` calisir; bu MVP migration araci kullanmaz.