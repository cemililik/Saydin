# Yerel Geliştirme Ortamı Kurulumu

## Gereksinimler

| Araç | Versiyon | Kurulum |
|------|----------|---------|
| Docker Desktop | latest | docker.com |
| .NET SDK | 10 | dotnet.microsoft.com |
| Flutter SDK | 3.41.0 | flutter.dev |
| Git | latest | git-scm.com |

---

## 1. Altyapıyı Başlat

```bash
# Saydın kök dizininde
docker-compose up -d

# Kontrol et
docker-compose ps
# postgresql ve redis servislerinin "Up" durumunda olması beklenir
```

---

## 2. Veritabanı Migration

```bash
# PostgreSQL'e bağlan ve migration'ı uygula
docker exec -i saydin-postgres psql -U saydin -d saydin \
    < src/Saydin.Services/infrastructure/postgres/migrations/001_initial.sql
```

Migration başarılı ise:
```
CREATE EXTENSION
CREATE EXTENSION
CREATE TYPE
CREATE TABLE
SELECT 1   ← hypertable oluşturuldu
...
INSERT 0 8  ← seed verisi eklendi
```

---

## 3. Backend Servisleri Çalıştır

```bash
cd src/Saydin.Services

# API servisini başlat (port 5000)
dotnet run --project src/Saydin.Api

# Yeni terminal — Ingestion worker'ı başlat
dotnet run --project src/Saydin.PriceIngestion
```

### Ortam Değişkenleri

`src/Saydin.Services/src/Saydin.Api/appsettings.Development.json` dosyasını **git'e commit etme**. Bunun yerine `dotnet user-secrets` kullan:

```bash
cd src/Saydin.Services/src/Saydin.Api
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=saydin;Username=saydin;Password=saydin_dev"
dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379"
```

`src/Saydin.Services/src/Saydin.PriceIngestion` için:
```bash
cd src/Saydin.Services/src/Saydin.PriceIngestion
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=saydin;Username=saydin;Password=saydin_dev"
dotnet user-secrets set "ExternalApis:CoinGecko:ApiKey" "<your-key>"
dotnet user-secrets set "ExternalApis:GoldApi:ApiKey" "<your-key>"
dotnet user-secrets set "ExternalApis:TwelveData:ApiKey" "<your-key>"
# TCMB için API key gerekmez
```

---

## 4. API'yi Test Et

```bash
# Health check
curl http://localhost:5000/health

# Asset listesi
curl http://localhost:5000/v1/assets

# Belirli tarihte fiyat
curl http://localhost:5000/v1/assets/USDTRY/price/2020-01-01

# "Ya alsaydım?" hesabı
curl -X POST http://localhost:5000/v1/what-if/calculate \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: test-device-001" \
  -d '{
    "assetSymbol": "USDTRY",
    "buyDate": "2020-03-01",
    "amount": 10000,
    "amountType": "try"
  }'
```

---

## 5. Flutter Uygulamasını Çalıştır

```bash
cd src/Saydin.Client

# Bağımlılıkları yükle
flutter pub get

# iOS Simulator veya Android Emulator'da çalıştır
flutter run
```

Emülatörden API'ye bağlantı için `lib/core/network/` dosyasında base URL'yi `http://10.0.2.2:5000` (Android) veya `http://localhost:5000` (iOS) olarak ayarla.

---

## 6. Testleri Çalıştır

```bash
# Backend testleri
cd src/Saydin.Services
dotnet test

# Flutter testleri
cd src/Saydin.Client
flutter test
```

---

## Bağlantı Bilgileri (Docker)

| Servis | URL / Host:Port | Kullanıcı | Şifre |
|--------|-----------------|-----------|-------|
| PostgreSQL | localhost:5432 | saydin | saydin_dev |
| Redis | localhost:6379 | — | — |
| pgAdmin | http://localhost:5050 | admin@saydin.dev | admin |
| Redis Insight | http://localhost:5540 | — | — |
| Aspire Dashboard | http://localhost:18888 | — | — |
| OTLP/gRPC (Aspire) | localhost:4317 | — | — |
| Prometheus | http://localhost:9090 | — | — |

### pgAdmin İlk Bağlantı
pgAdmin açıldığında `servers.json` sayesinde "Saydın PostgreSQL" sunucusu otomatik görünür. Şifreyi elle gir: `saydin_dev`

### Redis Insight İlk Bağlantı

1. http://localhost:5540 adresini aç
2. **"Add Redis Database"** butonuna tıkla
3. Aşağıdaki bilgileri gir:
   - **Host:** `redis` *(Docker servis adı — `localhost` değil)*
   - **Port:** `6379`
   - **Name:** `Saydın Redis` *(isteğe bağlı)*
   - Şifre yok, boş bırak
4. **"Add Redis Database"** ile kaydet

> **Not:** Host olarak `localhost` yazarsan bağlantı başarısız olur. Redis Insight, Compose iç network'ünde çalıştığı için Redis'e servis adıyla (`redis`) ulaşır.

### Aspire Dashboard OTLP
`.NET` servisler şu environment variable ile Aspire Dashboard'a bağlanır:
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```
Ya da doğrudan `appsettings.Development.json`'da konfigüre edilir (bkz. observability.md)

---

## Sorun Giderme

**PostgreSQL bağlanamıyor:**
```bash
docker-compose logs postgres
# "database system is ready" mesajını bekle
```

**TimescaleDB extension yüklenmiyor:**
```bash
# Image'in TimescaleDB versiyonu olduğunu kontrol et
docker exec saydin-postgres psql -U saydin -c "SELECT default_version FROM pg_available_extensions WHERE name = 'timescaledb';"
```

**Redis bağlanamıyor:**
```bash
docker exec saydin-redis redis-cli ping
# PONG dönmeli
```
