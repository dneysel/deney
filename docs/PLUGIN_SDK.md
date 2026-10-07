# Plugin SDK

Bu dosya gelistirici sozlesmesini taslaklar. Bugun repo icinde genel amacli plugin SDK paketi yoktur; yalnizca `gateway/main.py` icindeki sabit `repo_search` ve `document_search` tool tanimlari calisir.

## Mevcut MCP tool arayuzu

Istekler `POST /api/mcp` uzerinden JSON-RPC 2.0 kullanir. Tool argumani:

```json
{"query":"string (max 240 karakter)"}
```

`tools/list` iki salt-okunur araci listeler. `tools/call` sonucu `result.content[]` icinde text dondurur. Unknown tool `isError: true` ile dondurulur.

## Onerilen SDK kontrati

- `ToolManifest`: name, version, description, input_schema, permission scopes.
- `ToolContext`: owner_id, conversation_id, request_id, deadline, cancellation signal.
- `ToolResult`: bounded content blocks, metadata, redacted error.
- Handler: async, idempotent olabildigince, timeout ve max output siniri olan.
- Registration: explicit allowlist; runtime auto-discovery yapmaz.

SDK gelistirilirken schema validation, tenant scoping, prompt-injection handling, cancellation, trace ID ve test harness zorunlu kabul edilmeli. Python callable'i serbestce calistiran bir API verme.