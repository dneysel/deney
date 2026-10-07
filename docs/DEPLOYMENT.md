# Deployment

## Yerel deneme

```sh
sh install.sh
sh run.sh
```

`run.sh` `.env` dosyasini yukler. `CHATBOT_API_TOKEN` bos/yoksa provider `simulation` olur ve same-origin UI anonim kullanilir. Tokenless mod yalnizca yerel/ozel deneme icindir. `HOST=127.0.0.1` ile sadece loopback'te dinletilebilir.

## Docker Compose

Simulasyon icin `CHATBOT_API_TOKEN`, `INFERENCE_SERVICE_TOKEN`, `POSTGRES_PASSWORD` ayarlanmalidir. Compose gateway portunu `127.0.0.1:8000`'e yayinlar; inference, llama.cpp ve Postgres portlarini host'a acmaz. Kalici PostgreSQL `chatbot-db`; dosyalar `chatbot-media` volume'undadir.

## Tek GPU / llama.cpp

NVIDIA Container Toolkit, Compose `gpus: all`, CUDA server imaji ve `/models` altinda GGUF gerekir. `.env.gpu.example` dosyasini `.env.gpu` olarak kopyalayip uc secret degerini ve `MODEL_FILE` yolunu ayarlayin:

```sh
docker compose --env-file .env.gpu -f compose.yaml -f compose.gpu.yaml up --build
```

GPU overlay `MODEL_PROVIDER=llamacpp` degerini zorunlu kilar. llama.cpp modeli server-side CUDA container'inda yukler; sadece `private` Compose network'unde `llama:8080` adresinden inference servisine aciktir. Host'a llama portu yayinlanmaz. `MODEL_DIR`, `MODEL_FILE`, `CONTEXT_SIZE` ve `GPU_LAYERS` `.env.gpu` ile ayarlanir. Vision icin uygun `MM_PROJ_FILE` ekleyip `compose.vision.yaml` overlay'ini de verin. GPU bellegi model, context boyutu, quantization ve mmproj boyutuna gore degisir; otomatik kapasite tespiti yoktur.

## Transcription

Ses ozelligi varsayilan kapali. `TRANSCRIPTION_URL`, OpenAI uyumlu multipart transcription endpoint'ini gostermelidir. Gateway webm/wav/mp3/ogg verisini sunucu tarafinda gonderir. Bu endpoint/servis Compose'a otomatik eklenmez.

## Production oncesi

OIDC, TLS/reverse proxy, guvenilir proxy header'lari, secret manager, DB migration/backup, dagitik rate limit, retention/silme politikalari, non-root container, image pinning ve GPU quota eklenmeli. `.env`, `.gateway_token`, DB, media ve model dosyalari version control'a commit edilmemelidir.