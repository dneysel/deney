# Real Engine Structure

Bu hedef yapidir; calisan kaynak agacinin birebir kopyasi degildir. Bugunku gercek agac `gateway/main.py`, `gateway/store.py`, `inference/main.py` ve `web/` dosyalarindan olusur. Buyudukce sorumluluklar modullere ayrilabilir:

```text
gateway/
  api/              # route groups, schemas, error mapping
  auth/             # bearer/OIDC providers, owner resolution
  application/      # chat, document and conversation use cases
  domain/           # conversation, message, revision types
  repositories/     # SQLAlchemy implementations + migrations
  retrieval/        # parsers, chunking, lexical/vector retrieval
  tools/            # MCP transport, registry, permissions
  media/            # validation, private storage, transcription client
  observability/    # metrics, traces, redaction
inference/
  api/              # internal request schemas
  orchestration/    # queue, cancellation, limits
  providers/        # simulation, llama.cpp, future providers
web/
  app/              # state, API client, views, components
deploy/
  compose/          # local, GPU and optional vision overlays
  migrations/
docs/
tests/
```

## Tasarim ilkeleri

- API handler yalnizca parse/auth/use-case/response katmani olsun.
- Domain paketleri FastAPI/SQLAlchemy import etmesin.
- Repository interfaces DB detayini application logic'ten ayirsin.
- Inference provider contract'i async iterator ile cancellation'i desteklesin.
- Plugin/tool permission'lari allowlist ve explicit user consent ile verilsin.
- Harici context her zaman untrusted; secrets ve prompt'lar telemetry disinda kalsin.
- Her ayrisma oncesi test ve operasyonel gerekce olsun; MVP'yi erkenden mikroservislere bolme.