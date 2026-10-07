# Roadmap

Bu yol haritasi hedefleri listeler; tamamlanmis ozellikler icin `CHANGELOG.md` ve `progress.md`'ye bak.

## P0 - Deneme kararliligi

- [x] Tokenless local simulation ve gateway token akisi.
- [x] SQLite/PostgreSQL kaliciligi, sohbet CRUD ve mesaj revision'lari.
- [x] llama.cpp OpenAI uyumlu stream adapter'i.
- [x] TXT/MD/PDF lexical retrieval ve salt-okunur repo aramasi.
- [ ] Kalici otomatik test paketi (su an bazi kontroller smoke test olarak calistiriliyor).
- [ ] DB migration ve yedek/geri yukleme proseduru.

## P1 - Guvenlik ve operasyon

- [ ] OIDC login; mevcut bearer/token owner modelinden gecis.
- [ ] TLS reverse-proxy tarifi, CSRF/Origin testleri ve secret management.
- [ ] Dagitik rate limit, request ID, structured redacted logs.
- [ ] Yukleme karantinasi, retention ayarlari ve silme/export endpoint'leri.

## P2 - Bilgi kalitesi

- [ ] Chunk tabanli retrieval ve kaynak konum/citation.
- [ ] Yerel embedding provider + vektor index; owner bazli isolation.
- [ ] Retrieval evaluation seti, relevance threshold ve prompt-injection regression testleri.

## P3 - Extensibility

- [ ] Tam MCP Streamable HTTP veya stdio adapter'i.
- [ ] Versioned plugin manifest, permission review ve sandbox.
- [ ] Onayli mutating tool'lar; her calistirmada user consent.

## P4 - Multimodal ve scale

- [ ] Vision model/format matrisini GPU testleriyle dogrula.
- [ ] Yerel transcription servisini Compose profiline ekle.
- [ ] Queue/throughput benchmark ve model/context profiles.
- [ ] Coklu inference worker ancak tek-GPU limitleri ve operasyon ihtiyaci olusunca.