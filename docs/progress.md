# Progress

## Durum

Tek-host deneme MVP'si uygulanmis durumda. Yerel varsayilan, `CHATBOT_API_TOKEN` bosken simulation provider'dir. SQLite verisi `data/chatbot.db`'de tutulur; Compose PostgreSQL kullanir.

## Tamamlanan

- [x] Shell install/run ve `.env` yukleme.
- [x] Gateway/inference servis siniri, internal bearer ve SSE stream.
- [x] Sohbet kaliciligi, arama, adlandirma/silme, edit/regenerate ve revision diff.
- [x] Model sampling ayarlari ve model allowlist.
- [x] TXT/MD/PDF lexical retrieval ve owner-scoped belgeler.
- [x] Repo ve document icin salt-okunur MCP benzeri JSON-RPC tools.
- [x] Gorsel upload gate/vision profile; opsiyonel transcription URL.
- [x] Rate limit, temel latency/queue metrikleri, Compose GPU ve vision overlays.
- [x] Tokenless same-origin simulation session.
- [x] llama.cpp CUDA server Compose overlay'i: inference provider'ini llamacpp'ye sabitler ve modeli ozel server-side agda tutar.

## Dogrulama

- Python compile, JavaScript syntax, shell syntax ve Compose config kontrolleri calistirildi.
- SQLite store CRUD/revision smoke testleri yapildi.
- HTTP session/auth, SSE, edit/regenerate, belge CRUD, MCP, metrics, vision test adapter'i ve per-token owner izolasyonu smoke test edildi.
- GPU gercek model cikarimi ve harici transcription endpoint'i bu makinede dogrulanmadi.

## Bilinen aciklar

- `gateway/main.py` henuz tek buyuk route modulu; DB modeli otomatik `create_all`, migration yok.
- Dokuman retrieval lexical'dir; embedding/vector search degildir.
- `/api/mcp` sinirli JSON-RPC HTTP girisi; genel amacli plugin discovery/sandbox degildir.
- Tokenless simulation ortak local owner kullanir; private dev ortam disinda acilmamali.
- OIDC, TLS production config, dagitik rate limit ve formal automated test suite eksik.

Siradaki onerilen is: kalici test suite + Alembic migration, ardindan OIDC ve TLS deployment tarifi.