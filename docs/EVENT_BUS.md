# Event Bus

## Bugunku olay akisi

Harici broker veya durable event bus yoktur. Gercek zamanli yanit `text/event-stream` SSE'dir:

```text
data: {"delta":"..."}

data: [DONE]

```

Gateway, inference SSE satirlarini istemciye aktarir. Icer servis cagrisi HTTP'dir; inference kuyrugu process-local `asyncio.Semaphore` ile uygulanir. Birden fazla replica arasinda ortak kuyruk/ordering saglanmaz.

## Basit event semantigi

- `delta`: assistant metin parcasi.
- `error`: kullaniciya gosterilebilir hata mesaji.
- `[DONE]`: stream sonu.
- `X-Conversation-ID`: stream'in sohbet kimligi response header'i.

SSE retry ID, resume cursor, durable replay ve event version mevcut degildir.

## Gelecek broker

Gereksinim olusursa event envelope su alanlari tasiyabilir: `event_id`, `event_type`, `schema_version`, `occurred_at`, `trace_id`, `conversation_id`, `owner_id`, `payload`. Prompt veya ham hassas icerigi broker log'una koyma. At-least-once teslimde idempotency; retry/DLQ; retention; tenant partition; consumer auth; stream-to-client backpressure planlanmalidir.

Tek host / tek GPU MVP'sinde Redis/Kafka eklemek operasyonel yuku artirir ve bugunku akislarda gerekli degildir.