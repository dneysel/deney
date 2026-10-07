# API Specification

Tum API yollarinin prefix'i `/api`'dir. JSON govdeli isteklerde `Content-Type: application/json` kullanilir. Gercek tokenli modda `Authorization: Bearer <CHATBOT_API_TOKEN>` gerekir. Yerel tokenless sim mode, yalnizca `UI_AUTO_AUTH=true` iken ayni-origin cookie/istek kabul eder.

## Endpoint'ler

| Method | Path | Amac |
|---|---|---|
| GET | `/api/health` | Basit servis durumu; kimlik dogrulamaz. |
| GET | `/api/session` | Provider, izinli modeller, varsayilan ayarlar ve capability bilgisi. |
| GET | `/api/metrics` | Gateway ve inference toplu metrikleri; auth gerekir. |
| POST | `/api/chat/stream` | Sohbet mesaji gonderir, SSE yaniti dondurur. |
| GET | `/api/conversations?q=` | Sahibe ait sohbetleri listeler/arar. |
| GET | `/api/conversations/{conversation_id}` | Sohbet ve mesajlari, ek URL'leriyle dondurur. |
| GET | `/api/conversations/{conversation_id}/revisions` | Onceki assistant yanitlarini listeler. |
| PUT | `/api/conversations/{conversation_id}` | Sohbet basligini degistirir. |
| DELETE | `/api/conversations/{conversation_id}` | Sohbet, mesajlar, revizyonlar ve ek dosyalarini siler. |
| POST | `/api/conversations/{conversation_id}/messages/{message_id}` | Kullanici mesajini duzenler, sonraki mesajlari kaldirir. |
| GET/POST | `/api/documents` | Belge listeler/yukler (TXT, MD, text PDF). |
| DELETE | `/api/documents/{document_id}` | Belgeyi siler. |
| GET | `/api/attachments/{attachment_id}` | Sahip denetimli medya indirme. |
| POST | `/api/transcribe` | Yapilandirilmis yerel transcription servisine ses aktarir. |
| POST | `/api/mcp` | Sinirli JSON-RPC MCP benzeri HTTP girisi. |

## Chat request

```json
{
  "conversation_id": null,
  "message": "Merhaba",
  "regenerate": false,
  "settings": {"model":"local-model","temperature":0.7,"top_p":0.95,"max_tokens":1024},
  "use_documents": true,
  "include_repository": false,
  "image_data_url": null,
  "image_name": null
}
```

Yeni sohbet icin `conversation_id` null birakilir. Yeniden uretmede mevcut kimlik ve `regenerate: true` gonderilir; `message` gerekmez. Gorsel data URL'leri yalnizca `VISION_ENABLED=true` iken kabul edilir. Izinli model disindaki secim `422` dondurur.

Basarili response `X-Conversation-ID` header'i tasir. Body `text/event-stream` formatindadir:

```text
data: {"delta":"merhaba"}

data: [DONE]

```

Model/provider hatalari akista `{ "error": "..." }` olayi ve ardindan `[DONE]` olarak iletilebilir. Stream basladiktan sonra hata SSE olayi olur.

## Sinirlar ve durum kodlari

- `401`: bearer token eksik/gecersiz (anonim sim modu haric).
- `403`: tokenless yazma istegi ayni-origin degil.
- `404`: kaynak yok veya cagiran kullaniciya ait degil.
- `413`: mesaj, gorsel veya belge boyut limiti asildi.
- `415`: belge uzantisi desteklenmiyor.
- `422`: model, payload veya mesaj gecersiz.
- `429`: token sahibi icin dakikalik rate limit asildi.
- `502/503`: transcription, inference veya model servisi hazir degil.

MCP endpoint'i tam Streamable HTTP/stdio sunucusu degildir; yalnizca `initialize`, `tools/list`, `tools/call` ve ilgili sinirli JSON-RPC davranisini sunar. Ayrintilar `PLUGIN_SYSTEM.md` icindedir.