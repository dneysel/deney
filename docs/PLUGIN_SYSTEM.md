# Plugin System

## Mevcut durum

Plugin registry, third-party plugin install'i veya tool execution runtime'i yoktur. `POST /api/mcp`, auth korumali ve salt-okunur iki araci JSON-RPC benzeri HTTP endpoint'i uzerinden sunar:

- `repo_search`: `REPO_ROOT` altinda izin verilen metin dosyalarinda sinirli excerpt arar.
- `document_search`: yalnizca cagiran owner'in yukledigi belgelerde arar.

Shell calistirma, dosya yazma, arbitrary URL fetch veya dinamik Python import'u tool olarak sunulmaz. MCP endpoint'i tam stateful Streamable HTTP ya da stdio transport degildir.

## Guven siniri

Tool cagrisi kullanici bearer auth ve rate limit'ten gecer. Dokuman owner filtresi uygulanir. Repo kokunun disina cikilmaz, gizli uzantilar ve `.env` atlanir, boyut ve dosya sayisi sinirlidir. Tool sonucu modele untrusted context olarak eklenmelidir.

## Ileri plugin sistemi

Plugin'ler manifest + version + input schema + permission listesi ile kaydedilmeli. Varsayilan deny; her plugin icin capability, timeout, output boyut siniri, network allowlist ve audit kimligi olmali. Ucuncu taraf kodu ana process'te import etmek yerine subprocess/container sandbox dusunulmeli. Kurulum ve guvenlik incelemesi olmadan plugin marketplace acilmamali.