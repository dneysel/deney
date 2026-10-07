# RAG Pipeline

## Mevcut pipeline

Mevcut ozellik semantik/vector RAG degil; kucuk yerel denemeler icin lexical aramadir.

1. Kullanici TXT, Markdown veya metin iceren PDF yukler (4 MB upload limiti).
2. PDF metni `pypdf` ile cikartilir; bos icerik reddedilir. Saklanan metin 1 MB ile sinirlanir.
3. `documents` tablosu owner ID ile yazar.
4. Mesajda `use_documents=true` ise query tokenlari (3 karakterden uzun) dokuman metninde sayilir.
5. En cok eslesen en fazla dort dokumandan 900 karakterlik excerpt prompt'a eklenir.
6. Kaynak adlari prompt'a yazilir ve retrieved metin talimatlari guvenilmeyen veri saymasi modele acikca soylenir.

`/api/mcp` `document_search` araci da ayni lexical store aramasini kullanir. Embedding modeli, chunk index'i, vector DB, reranker ve relevance threshold yoktur.

## Sinirlar

Kelime aramasi es anlam, dil varyanti ve uzun dokumanlarda zayiftir. Chunk'lar belge bazli substring'den ibarettir. Model prompt injection'i tamamen engelleyemez; retrieved context'e yetki veya talimat olarak guvenilmemelidir.

## Semantik RAG icin hedef tasarim

- Parser adapters: PDF/MD/TXT, MIME ve boyut denetimi.
- Chunker: baslik/sayfa sinirlarini koru, overlap ve metadata ekle.
- Embedding provider: CPU/GPU secilebilir; inference ile GPU kaynagi paylasimini kuyrukla.
- Vector store: owner_id zorunlu filter, kaynak silme ile index silme.
- Retriever: hybrid lexical/vector, top-k ve score threshold.
- Reranker: opsiyonel ve ayri latency budget.
- Context builder: token budget, kaynak URL/konum, untrusted-source delimiter.
- Evaluation: recall@k, citation correctness, prompt-injection regression testleri.

Bu hedef roadmap'tir; bugunku uygulama bu pipeline'i calistirdigini iddia etmez.