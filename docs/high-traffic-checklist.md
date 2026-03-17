# Yüksek Trafik Hazırlık Listesi

Bu belge MVP sonrası kullanıcı büyümesiyle birlikte ele alınması gereken teknik konuları listeler.
Her madde bir eşik veya tetikleyici koşulla birlikte verilmiştir.

---

## Redis

- [ ] **Bellek limiti ve eviction politikası ayarlanmalı**
  - `maxmemory` ve `maxmemory-policy` (önerilen: `allkeys-lru`) konfigürasyonu
  - Tetikleyici: Redis bellek kullanımı %70'i aşıyorsa

- [ ] **Usage key yapısı gözden geçirilmeli**
  - Şu an: `usage:whatif:{userId}:{date}` — kullanıcı başına günlük 1 key
  - Yüksek kullanıcı sayısında (>500k aktif/gün) Lua script yükü izlenmeli
  - Tetikleyici: Günlük aktif kullanıcı 100k'yı aşarsa

- [ ] **Redis Cluster veya Redis Sentinel kurulumu**
  - Tek node Redis, single point of failure
  - Tetikleyici: Uptime SLA %99.9 hedefleniyorsa veya aktif kullanıcı 50k+

- [ ] **Bağlantı havuzu (connection pool) boyutu izlenmeli**
  - `StackExchange.Redis` varsayılan pool yeterli olup olmadığı kontrol edilmeli
  - Tetikleyici: P99 latency artışı veya timeout hataları görülürse

- [ ] **Cache key namespace'leri versiyonlanmalı**
  - Şu an `whatif:v2:...` formatında — breaking değişiklikte versiyon artırılmalı
  - Tetikleyici: Cache yapısını kıran her backend değişikliğinde

---

## PostgreSQL / TimescaleDB

- [ ] **`price_points` hypertable chunk interval optimize edilmeli**
  - Şu an 1 aylık chunk; sorgu paternine göre 1 haftalık daha verimli olabilir
  - Tetikleyici: Ortalama sorgu süresi 100ms'yi aşarsa

- [ ] **Sık kullanılan asset+tarih aralığı sorgularına partial index eklenmeli**
  - Tetikleyici: EXPLAIN ANALYZE'da seq scan görünürse

- [ ] **Connection pool boyutu (Npgsql) gözden geçirilmeli**
  - Varsayılan: 100 bağlantı — API replica sayısına göre artırılmalı
  - Tetikleyici: "connection pool exhausted" hatası görülürse

- [ ] **Read replica eklenmeli**
  - Hesaplama sorguları (SELECT ağırlıklı) read replica'ya yönlendirilebilir
  - Tetikleyici: Günlük aktif kullanıcı 50k+ veya DB CPU sürekli >70%

---

## API

- [ ] **Rate limiting API gateway seviyesine taşınmalı**
  - Şu an Redis'te uygulama içi rate limiting var
  - DDoS veya scraping senaryolarında gateway (nginx, Cloudflare) seviyesinde ek koruma gerekli
  - Tetikleyici: Anormal trafik desenleri görülürse

- [ ] **Horizontal scaling: API stateless mi doğrulanmalı**
  - Şu an: Evet, stateless. Doğrulama: Session state veya in-memory cache yok mu?
  - Tetikleyici: İkinci API replica eklemeden önce

- [ ] **`/v1/what-if/calculate` endpoint'i için ayrı rate limit katmanı**
  - Hesaplama endpoint'i diğerlerinden daha pahalı; ayrı bir limitle korunabilir
  - Tetikleyici: Bu endpoint'in toplam CPU'nun %50'sini tükettiği görülürse

---

## Gözlemlenebilirlik (Observability)

- [ ] **Alerting kuralları tanımlanmalı**
  - P95 latency > 500ms
  - Error rate > %1
  - Redis connection hatası
  - Tetikleyici: Prodüksiyon yayınından önce

- [ ] **Daily limit aşım oranı izlenmeli**
  - Kaç kullanıcı limiti dolduruyor? Bu premium conversion için sinyal
  - Tetikleyici: Uygulama canlıya geçtiğinde

- [ ] **Cache hit/miss oranı Prometheus metric'i eklenmeli**
  - Şu an loglarda var; Grafana dashboard'a taşınmalı
  - Tetikleyici: Grafana dashboard kurulduğunda

---

## Güvenlik

- [ ] **Device-ID sahteciliği koruması**
  - Şu an device_id header'dan okunuyor; kötü niyetli kullanıcı sonsuz device_id üretebilir
  - Çözüm: Device fingerprint veya hesaplama başına CAPTCHA (premium öncesi)
  - Tetikleyici: Limit bypass girişimleri tespit edilirse

- [ ] **Secret rotation planı**
  - Veritabanı, Redis bağlantı string'leri ve API key'leri için rotasyon prosedürü
  - Tetikleyici: İlk prodüksiyon yayınından önce

---

## Maliyet

- [ ] **macOS GitHub Actions runner kullanımı izlenmeli**
  - iOS release build'leri macOS runner kullanıyor (10x dakika tüketimi)
  - Tetikleyici: Aylık Actions dakikasının %50'si dolduğunda

- [ ] **TimescaleDB veri retention politikası**
  - Freemium kullanıcılar için 1 yıllık veri yeterli; eski veriler daha ucuz depolamaya taşınabilir
  - Tetikleyici: `price_points` tablosu 10GB'ı aşarsa
