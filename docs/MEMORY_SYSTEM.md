# Memory System

Buradaki “memory”, modelin uzun donem semantik hafizasi degil, sohbet ve belge kaliciligidir. Vektor/embedding hafizasi mevcut degildir.

## Saklanan veriler

- `conversations`: id, owner hash, baslik, olusturma/guncelleme zamanlari.
- `messages`: sohbet kimligi, rol, govde ve zaman.
- `message_revisions`: onceki assistant yanitlari.
- `documents`: sahip kimligi, dosya adi, cikartilmis metin ve olusturma zamani.
- `attachments`: sahip, mesaj, MIME ve media-volume dosya yolu.

Yerel varsayilan `data/chatbot.db` SQLite'tir. Compose `DATABASE_URL` ile PostgreSQL kullanir. Medya yerelde `data/media`, Compose'ta `chatbot-media` volume'undadir. `.gitignore` veritabani, `.env`, model ve medya dosyalarini repo disinda tutar.

## Sahiplik ve saklama

Owner ID, kullanici tokeninin acik degerinden degil, yapilandirilmis owner kimliginin SHA-256 hash'inden uretilir. Varsayilan tek yerel token owner `local` olur; `CHATBOT_API_TOKENS` ile token -> owner eslemesi yapilabilir. Anonim sim kullanicilari ortak `local-simulation` owner'ini kullanir ve bu nedenle gercek cok kullanicili ortama uygun degildir.

Sohbet silme mesajlari, revision'lari ve attachment kayitlarini siler; media dosyalarini da kaldirir. Belge silme DB kaydini kaldirir. Belge verisi ve sohbet icerigi application log'larina yazilmaz.

## Gelecek

Retention ayari, kullanici bazli export, DB migration, encrypt-at-rest, semantik memory ve silme denetimi production oncesi tasarlanmalidir. Bu repo su an migration framework'u veya otomatik retention job'u icermez.