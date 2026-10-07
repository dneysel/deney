# Changelog

Bu dosya kullaniciya gorunen degisiklikleri kaydeder. Repo henuz formal release/tag kullanmiyor.

## Unreleased

### Added

- FastAPI gateway + inference servisleri; SSE stream ve simulation provider.
- llama.cpp OpenAI uyumlu chat completion adapter'i ve tek-GPU semaphore kuyrugu.
- SQLite yerel / PostgreSQL Compose kaliciligi; sohbet arama, CRUD, mesaj duzenleme ve assistant revision diff'i.
- TXT/MD/PDF metin yukleme; lexical document retrieval.
- Salt-okunur `repo_search` ve `document_search` araclari, `/api/mcp` HTTP endpoint'i.
- Vision upload gate, attachment sahiplik kontrolu, optional transcription URL adapter'i.
- Per-owner rate limit, temel metrikler ve `sh install.sh` / `sh run.sh` akisi.
- `.env` token yokken token istemeyen local simulation fallback.

### Notes

Vision/GPU ve transcription davranislari bu host'ta production donanim/servisiyle dogrulanmis sayilmaz. Semantik RAG, OIDC, tam plugin runtime'i ve harici event broker mevcut degildir.