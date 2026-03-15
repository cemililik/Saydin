# Saydın - Mimari Genel Bakış

## Uygulama Nedir?

Saydın, Türk kullanıcılara yönelik bir finansal "ya alsaydım?" (what if) mobil uygulamasıdır. Kullanıcılar altın, gümüş, dolar, euro, BIST hisseleri veya kripto paralar için tarihi "ne olurdu?" hesaplamaları yapabilir.

**Örnek sorular:**
- "2020 başında 10.000 TL ile dolar alsaydım bugün ne kadar ederdi?"
- "01.03.2020'de Bitcoin alıp 01.01.2021'de satsaydım kar mı zarar mı ederdim?"

---

## Yüksek Seviye Mimari

```
┌─────────────────────────────────────────────────────────┐
│                   Saydin.Client                         │
│               Flutter 3.41.0 (iOS + Android)            │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/REST (X-Device-ID auth)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Saydin.Api                           │
│            .NET 10 Minimal API                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  WhatIf      │  │  Assets      │  │  Scenarios   │  │
│  │  Endpoints   │  │  Endpoints   │  │  Endpoints   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └─────────────────┼─────────────────┘          │
│                           ▼                             │
│               IWhatIfCalculator / IPriceRepository      │
└──────────────────┬────────────────────────┬─────────────┘
                   │                        │
                   ▼                        ▼
┌─────────────────────────┐   ┌────────────────────────────┐
│   PostgreSQL            │   │   Redis                    │
│   + TimescaleDB         │   │   (Response Cache)         │
│   (price_points table)  │   │   TTL: 1-24 saat           │
└────────────┬────────────┘   └────────────────────────────┘
             │
             │ (veritabanı üzerinden iletişim)
             │
┌────────────┴────────────────────────────────────────────┐
│                 Saydin.PriceIngestion                   │
│              .NET 10 Background Worker                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │
│  │  TCMB   │ │ CoinGecko │ │ GoldAPI  │ │TwelveData│  │
│  │ Adapter │ │  Adapter  │ │  Adapter │ │ Adapter  │  │
│  └────┬────┘ └─────┬─────┘ └────┬─────┘ └────┬─────┘  │
└───────┼────────────┼────────────┼─────────────┼────────┘
        │            │            │             │
        ▼            ▼            ▼             ▼
   TCMB XML    CoinGecko     GoldAPI.io    Twelve Data
   (Ücretsiz)  (Freemium)    (Freemium)    (Freemium)
```

---

## Servisler

### Saydin.Api
- .NET 10 Minimal API
- HTTP endpoint'leri Flutter uygulamasına sunar
- Hiçbir dış finansal API'ye doğrudan bağlanmaz
- Redis üzerinden response caching uygular
- Auth: MVP'de `X-Device-ID` header, Phase 2'de JWT

### Saydin.PriceIngestion
- .NET 10 Worker Service (`IHostedService`)
- HTTP endpoint expose etmez
- Zamanlanmış görevlerle dış API'lerden günlük fiyat verisi çeker
- PostgreSQL'e idempotent UPSERT ile yazar
- Polly ile retry/circuit-breaker yönetimi

### Saydin.Shared
- Her iki servisin referans aldığı ortak sınıf kütüphanesi
- Entity'ler: `Asset`, `PricePoint`, `AssetType`
- Exception'lar: `PriceNotFoundException`, `ExternalApiException`

### Saydin.Client
- Flutter 3.41.0, iOS ve Android
- Clean Architecture + BLoC pattern
- Feature-first klasör yapısı

---

## Desteklenen Asset'ler

| Sembol | Görünen Ad | Kategori | Kaynak |
|--------|------------|----------|--------|
| `USDTRY` | Dolar/TL | currency | TCMB |
| `EURTRY` | Euro/TL | currency | TCMB |
| `XAU_TRY_GRAM` | Altın (Gram/TL) | precious_metal | GoldAPI |
| `XAG_TRY_GRAM` | Gümüş (Gram/TL) | precious_metal | GoldAPI |
| `BTC` | Bitcoin | crypto | CoinGecko |
| `ETH` | Ethereum | crypto | CoinGecko |
| `THYAO` | Türk Hava Yolları | stock | Twelve Data |
| `GARAN` | Garanti Bankası | stock | Twelve Data |
| ... | ... | ... | ... |

---

## Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Mobil | Flutter | 3.41.0 |
| Backend | .NET Minimal API | 10 |
| Veritabanı | PostgreSQL + TimescaleDB | latest |
| Cache | Redis | latest |
| Geliştirme Ortamı | Docker Compose | latest |

### MVP'de Kullanılmayanlar

| Teknoloji | Neden Yok |
|-----------|-----------|
| Kafka | 1 producer + 1 consumer → PostgreSQL yeterli |
| Dapr | 2 servis birbirleriyle konuşmuyor |
| Kubernetes | Hetzner VPS yeterli, ölçek gerektikçe eklenecek |

Detaylı gerekçe için: [ADR-001](../decisions/ADR-001-no-kafka-mvp.md), [ADR-005](../decisions/ADR-005-backend-monorepo.md)

---

## Servisler Arası İletişim

MVP'de servisler **yalnızca PostgreSQL veritabanı üzerinden** haberleşir:

1. `PriceIngestion` → fiyat verilerini `price_points` tablosuna yazar
2. `Api` → aynı tablodan okur

Bu yaklaşım Kafka veya Dapr gerektirmeksizin tam bağımsızlık sağlar. Notification servisi gibi gerçek zamanlı ihtiyaçlar ortaya çıktığında event streaming değerlendirilecektir.

---

## Güvenlik Kaideleri

- API key'ler asla `appsettings.json`'a yazılmaz → environment variable / Docker secrets
- SQL parametreleri her zaman parameterized query ile geçilir
- Tüm dış API isteklerinde timeout ve circuit-breaker uygulanır
