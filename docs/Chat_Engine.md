# Chat Engine

## Calisan mesaj akisi

1. Tarayici `POST /api/chat/stream` ile tek yeni mesaji ve ayarlari gonderir.
2. Gateway kullanici kimligini cozer, rate limit uygular, model adini allowlist ile karsilastirir ve sohbet sahipligini denetler.
3. Ilk mesajda sohbet olusturur; kullanici mesajini DB'ye yazar.
4. Istege bagli olarak kullanici dokumanlarinda kelime eslesmesi yapar ve repo dosyalarindan sinirli excerpt cikarir.
5. Dis kaynaklar system mesaji olarak “guvenilmeyen icerik” uyarisi ile modele eklenir.
6. Gateway ayri servis tokeniyla inference'e JSON gonderir.
7. Inference semaphore/GPU kuyrugunu alir; simulation veya llama.cpp provider'ini calistirir.
8. Delta'lar SSE ile gateway ve tarayiciya aktarilir. Tam assistant cevabi sona erince DB'ye yazilir.

## Mesaj ve model davranisi

Mesaj rolleri `system`, `user`, `assistant` ile sinirlidir. Son mesaj user olmalidir. Gateway model ayarlarinda `temperature`, `top_p` ve `max_tokens` dogrular. Tek-GPU varsayilani `GPU_CONCURRENCY=1`'dir.

`simulation` gercek LLM degildir; test yaniti token token olusturur. `llamacpp`, `/v1/chat/completions` OpenAI uyumlu streaming endpoint'ine baglanir.

## Duzenleme ve revizyon

Bir user mesaji duzenlenince sonraki mesajlar silinir; silinecek assistant cevaplari `message_revisions` tablosunda saklanir. Yeniden uretme son assistant cevabini revizyona alir ve ayni user baglamindan yeni cevap uretir. UI satir bazli diff goruntuler.

## Hata ve iptal

Tarayici `AbortController` ile istegi kesebilir. Gateway istemci disconnect'ini kontrol eder. Model hatalari SSE error olayi olur; bos assistant kaydi DB'de birakilmaz. Hata govdeleri kullanici prompt'unu loglamaz.