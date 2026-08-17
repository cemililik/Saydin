# Saydın API Sözleşmesi

**Base URL (Production):** `https://api.saydin.app/v1`
**Base URL (Local Dev):** `http://localhost:5080/v1`
**API Dokümantasyonu (Local Dev):** `http://localhost:5080/scalar/v1` (Development modunda)
**Format:** JSON
**Auth (MVP):** `X-Device-ID: <uuid>` header
**Auth (Phase 2):** `Authorization: Bearer <jwt>`
**Lokalizasyon:** `Accept-Language` header (desteklenen: `tr`, `en` — varsayılan: `tr`)

---

## POST /what-if/calculate

Ana hesaplama endpoint'i. "Ya alsaydım?" sorusunu yanıtlar.

### Request

```json
{
  "assetSymbol": "USDTRY",
  "buyDate": "2020-03-01",
  "sellDate": "2024-01-15",
  "amount": 10000,
  "amountType": "try"
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `assetSymbol` | string | ✓ | Asset sembolü (bkz. assets listesi) |
| `buyDate` | date (YYYY-MM-DD) | ✓ | Alım tarihi |
| `sellDate` | date (YYYY-MM-DD) | — | Satış tarihi. Boş bırakılırsa bugün |
| `amount` | number | ✓ | Tutar |
| `amountType` | enum | ✓ | `try` \| `units` \| `grams` |
| `includeInflation` | boolean | — | `true` ise reel getiri hesaplanır (TÜFE/EVDS). Default: `false` |

**amountType açıklaması:**
- `try` → TL cinsinden yatırım tutarı (örn: 10.000 TL)
- `units` → Birim sayısı (örn: 100 adet hisse, 0.5 BTC)
- `grams` → Gram cinsinden (altın/gümüş için)

### Response 200

```json
{
  "assetSymbol": "USDTRY",
  "assetDisplayName": "Dolar/TL",
  "buyDate": "2020-03-01",
  "sellDate": "2024-01-15",
  "buyPrice": 6.42,
  "sellPrice": 30.18,
  "unitsAcquired": 1557.63,
  "initialValueTry": 10000.00,
  "finalValueTry": 47010.34,
  "profitLossTry": 37010.34,
  "profitLossPercent": 370.10,
  "isProfit": true,
  "cumulativeInflationPercent": 312.50,
  "realProfitLossPercent": 13.98,
  "inflationDataAsOf": "2023-11-01",
  "actualBuyDate": null,
  "actualSellDate": "2024-01-12",
  "priceHistory": [
    { "date": "2020-03-01", "price": 6.42 },
    { "date": "2022-07-15", "price": 17.83 },
    { "date": "2024-01-15", "price": 30.18 }
  ]
}
```

| Alan | Tip | Açıklama |
|------|-----|----------|
| `cumulativeInflationPercent` | number \| null | `includeInflation: true` ise alış-satış dönemi arasındaki kümülatif TÜFE enflasyonu (%). Enflasyon verisi yoksa `null`. |
| `realProfitLossPercent` | number \| null | Fisher denklemiyle hesaplanan reel getiri: `((1 + nominal/100) / (1 + enflasyon/100) - 1) * 100`. Negatif ise enflasyon altında kalmış demektir. |
| `inflationDataAsOf` | date \| null | TÜİK verisi satış ayı için mevcut değilse (2-3 ay yayın gecikmesi) kullanılan en güncel ay. Satış ayı tam olarak mevcutsa `null`. |
| `actualBuyDate` | date \| null | Seçilen alış tarihi hafta sonu veya tatil ise kullanılan gerçek işlem günü. Tarih tam eşleşirse `null`. |
| `actualSellDate` | date \| null | Seçilen satış tarihi hafta sonu veya tatil ise kullanılan gerçek işlem günü. Tarih tam eşleşirse `null`. |

`priceHistory`: Alış-satış aralığından örneklenmiş en fazla 60 fiyat noktası. Grafik çizimi için kullanılır. İlk ve son nokta daima dahil edilir. Aralık kısa ise daha az nokta döner.

**Tarih düzeltme mantığı:** `actualBuyDate` / `actualSellDate` verildiğinde, alım/satım gerçekte o günde gerçekleşmiştir. Tercih sırası: seçilen tarihe ≤ olan en yakın işlem günü, bulunamazsa > olan ilk işlem günü (±7 gün penceresi).

> **Hata zarfı (RFC-7807 `application/problem+json`).** Tüm 4xx/5xx yanıtları
> `Microsoft.AspNetCore.Mvc.ProblemDetails` ile **`Content-Type: application/problem+json`**
> döner — istemcinin dallanması gereken **kararlı, lokalden bağımsız makine ayracı `code`
> extension alanıdır** (`type` URI'si değişse bile sabittir; tam liste için bkz. aşağıdaki
> **Hata Taksonomisi**). **Kaynak doğrusu:** `src/Saydin.Api/Exceptions/*ExceptionHandler.cs`
> + `ApiErrorCodes.cs`. ASP.NET `Extensions`'ı `[JsonExtensionData]` ile **üst seviyeye
> düzleştirir** (`code`, `limit`, `resetAt`, `nearestDates`, `feature`, `field` nested
> `"extensions"` altında DEĞİL, doğrudan kök objededir). İstemci (`DioErrorMapper`) hem düz
> hem nested okur.

### Response 404 (`price-not-found`)

```json
{
  "type": "https://saydin.app/errors/price-not-found",
  "title": "Fiyat bulunamadı",
  "status": 404,
  "detail": "2020-03-01 tarihinde USDTRY fiyatı bulunamadı.",
  "traceId": "00-…",
  "code": "price_not_found",
  "nearestDates": ["2020-03-02", "2020-02-28"]
}
```

> `asset-not-found` (varlık sembolü tanınmıyor) da 404 döner ama
> `type=https://saydin.app/errors/asset-not-found` ile ayrılır; istemci bunu
> `AssetNotFoundError`'a eşler.

### Response 429 (`daily-limit-exceeded`)

```json
{
  "type": "https://saydin.app/errors/daily-limit-exceeded",
  "title": "Günlük limit aşıldı",
  "status": 429,
  "detail": "Günlük hesaplama limitine ulaştınız.",
  "traceId": "00-…",
  "code": "daily_limit_exceeded",
  "limit": 20,
  "resetAt": "2026-05-30T00:00:00.0000000+00:00"
}
```

`resetAt` (kök seviyede, offset'li ISO-8601): limitin sıfırlanacağı UTC zaman
damgası. İstemci `DailyLimitError.resetAt` olarak saklar.

### Response 422 (`scenario-limit-exceeded`)

```json
{
  "type": "https://saydin.app/errors/scenario-limit-exceeded",
  "title": "Senaryo limiti aşıldı",
  "status": 422,
  "detail": "Ücretsiz planda en fazla 10 senaryo kaydedebilirsiniz.",
  "traceId": "00-…",
  "code": "scenario_limit_exceeded",
  "limit": 10
}
```

### Response 400 (`validation`)

```json
{
  "type": "https://saydin.app/errors/validation",
  "title": "Geçersiz istek",
  "status": 400,
  "detail": "buyDate, sellDate'den önce olmalıdır.",
  "traceId": "00-…",
  "code": "validation",
  "field": "buyDate"
}
```

---

## POST /what-if/compare

Birden fazla varlığı aynı dönem ve tutar için paralel hesaplayarak karlılığa göre sıralar. **1 hesaplama hakkı** tüketir.

**Auth gerektirir:** `X-Device-ID`

### Request

```json
{
  "assetSymbols": ["USDTRY", "BTC", "XAU_TRY_GRAM"],
  "buyDate": "2020-03-01",
  "sellDate": "2024-01-15",
  "amount": 10000,
  "amountType": "try"
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `assetSymbols` | string[] | ✓ | 2-5 arası sembol |
| `buyDate` | date (YYYY-MM-DD) | ✓ | Alım tarihi |
| `sellDate` | date (YYYY-MM-DD) | — | Satış tarihi. Boş bırakılırsa bugün |
| `amount` | number | ✓ | Tutar |
| `amountType` | enum | ✓ | `try` \| `units` \| `grams` |

### Response 200

```json
{
  "results": [
    {
      "rank": 1,
      "calculation": {
        "assetSymbol": "BTC",
        "assetDisplayName": "Bitcoin",
        "profitLossPercent": 1250.50,
        "finalValueTry": 135050.00,
        "..."  : "..."
      }
    },
    {
      "rank": 2,
      "calculation": {
        "assetSymbol": "USDTRY",
        "assetDisplayName": "Dolar/TL",
        "profitLossPercent": 370.10,
        "finalValueTry": 47010.00,
        "...": "..."
      }
    }
  ]
}
```

`results`: `profitLossPercent`'e göre azalan sırada. Her `calculation` alanı `/what-if/calculate` yanıtıyla özdeş yapıdadır.

---

## POST /what-if/dca

Periyodik yatırım (DCA — Dollar Cost Averaging) simülasyonu. "Her ay 1.000 TL dolar alsaydım bugün ne kadar olurdu?" sorusunu yanıtlar. **1 hesaplama hakkı** tüketir.

**Auth gerektirir:** `X-Device-ID`

### Request

```json
{
  "assetSymbol": "USDTRY",
  "startDate": "2023-01-01",
  "endDate": "2026-03-01",
  "periodicAmount": 1000,
  "period": "monthly",
  "amountType": "try",
  "includeInflation": true
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `assetSymbol` | string | ✓ | Asset sembolü |
| `startDate` | date (YYYY-MM-DD) | ✓ | İlk alım tarihi |
| `endDate` | date (YYYY-MM-DD) | — | Son alım tarihi. Boş bırakılırsa bugün |
| `periodicAmount` | number | ✓ | Her periyodda yatırılacak tutar |
| `period` | enum | ✓ | `weekly` \| `monthly` |
| `amountType` | enum | ✓ | `try` \| `units` \| `grams` |
| `includeInflation` | boolean | — | `true` ise reel getiri hesaplanır. Default: `false` |

### Response 200

```json
{
  "assetSymbol": "USDTRY",
  "assetDisplayName": "Dolar/TL",
  "startDate": "2023-01-01",
  "endDate": "2026-03-01",
  "period": "monthly",
  "periodicAmount": 1000,
  "totalPurchases": 39,
  "totalInvestedTry": 39000.00,
  "currentValueTry": 52340.50,
  "profitLossTry": 13340.50,
  "profitLossPercent": 34.21,
  "isProfit": true,
  "averageCostPerUnit": 26.84,
  "totalUnitsAcquired": 1452.76,
  "currentPrice": 36.02,
  "cumulativeInflationPercent": 112.30,
  "realProfitLossPercent": -36.72,
  "priceHistory": [
    { "date": "2023-01-01", "cost": 1000, "value": 1000 },
    { "date": "2023-02-01", "cost": 2000, "value": 2050 }
  ]
}
```

| Alan | Tip | Açıklama |
|------|-----|----------|
| `totalPurchases` | int | Toplam alım sayısı |
| `totalInvestedTry` | number | Toplam yatırılan TL |
| `currentValueTry` | number | Güncel portföy değeri |
| `profitLossTry` | number | Kar/zarar (TL) |
| `profitLossPercent` | number | Kar/zarar (%) |
| `averageCostPerUnit` | number | Ortalama birim maliyeti |
| `totalUnitsAcquired` | number | Toplam edinilen birim |
| `currentPrice` | number | Varlığın güncel fiyatı |
| `cumulativeInflationPercent` | number \| null | Kümülatif TÜFE enflasyonu (%) |
| `realProfitLossPercent` | number \| null | Reel getiri (%) |
| `priceHistory` | array | Birikimli maliyet vs değer grafiği için veri noktaları |

### Response 404 / 422 / 429

`/what-if/calculate` ile aynı hata yapısı.

---

## POST /what-if/reverse

Ters senaryo hesaplama. "Hedef tutara ulaşmak için ne kadar yatırmalıydım?" sorusunu yanıtlar. **1 hesaplama hakkı** tüketir.

**Auth gerektirir:** `X-Device-ID`

### Request

```json
{
  "assetSymbol": "USDTRY",
  "buyDate": "2020-03-01",
  "sellDate": "2024-01-15",
  "targetAmount": 100000,
  "targetAmountType": "try",
  "includeInflation": true
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `assetSymbol` | string | ✓ | Asset sembolü |
| `buyDate` | date (YYYY-MM-DD) | ✓ | Alım tarihi |
| `sellDate` | date (YYYY-MM-DD) | — | Satış tarihi. Boş bırakılırsa bugün |
| `targetAmount` | number | ✓ | Hedef tutar |
| `targetAmountType` | enum | ✓ | `try` \| `units` \| `grams` |
| `includeInflation` | boolean | — | `true` ise reel getiri hesaplanır. Default: `false` |

### Response 200

```json
{
  "assetSymbol": "USDTRY",
  "assetDisplayName": "Dolar/TL",
  "buyDate": "2020-03-01",
  "sellDate": "2024-01-15",
  "buyPrice": 6.42,
  "sellPrice": 30.18,
  "requiredInvestmentTry": 21272.36,
  "targetValueTry": 100000.00,
  "profitLossTry": 78727.64,
  "profitLossPercent": 370.10,
  "isProfit": true,
  "cumulativeInflationPercent": 312.50,
  "realProfitLossPercent": 13.98,
  "inflationDataAsOf": "2023-11-01",
  "actualBuyDate": null,
  "actualSellDate": "2024-01-12",
  "priceHistory": [
    { "date": "2020-03-01", "price": 6.42 },
    { "date": "2024-01-15", "price": 30.18 }
  ]
}
```

| Alan | Tip | Açıklama |
|------|-----|----------|
| `requiredInvestmentTry` | number | Hedefe ulaşmak için gereken başlangıç yatırımı (TL) |
| `targetValueTry` | number | Hedef tutarın birim granülasyonuyla (6 hane) **ileri-tutarlı** hesaplanmış değeri — `unitsAcquired × sellPrice` ile birebir uyuşur (alt-kuruş yuvarlama). Girilen ham hedeften <0.01 TL sapabilir. (F4-3) |
| `profitLossTry` | number | Kar/zarar (TL) |
| `profitLossPercent` | number | Kar/zarar (%) |
| `cumulativeInflationPercent` | number \| null | Kümülatif TÜFE enflasyonu (%) |
| `realProfitLossPercent` | number \| null | Reel getiri (%) |
| `priceHistory` | array | Grafik için fiyat noktaları (max 60) |

### Response 404 / 422 / 429

`/what-if/calculate` ile aynı hata yapısı.

---

## GET /assets

Desteklenen tüm asset'lerin listesi.

### Response 200

```json
{
  "assets": [
    {
      "symbol": "USDTRY",
      "displayName": "Dolar/TL",
      "category": "currency",
      "firstPriceDate": "1950-01-02",
      "lastPriceDate": "2026-03-14"
    },
    {
      "symbol": "BTC",
      "displayName": "Bitcoin",
      "category": "crypto",
      "firstPriceDate": "2014-01-01",
      "lastPriceDate": "2026-03-14"
    }
  ]
}
```

`firstPriceDate` / `lastPriceDate`: Asset için veritabanında mevcut en eski ve en yeni fiyat tarihleri. `null` olabilir (henüz veri yüklenmemişse). Flutter istemcisi bu tarihleri tarih seçici aralığını kısıtlamak için kullanır.

**Kategori değerleri:** `currency` | `precious_metal` | `stock` | `crypto`

---

## GET /assets/{symbol}/price/{date}

Belirli bir tarihte tek fiyat noktası.

### Path Parameters

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `symbol` | string | Asset sembolü |
| `date` | YYYY-MM-DD | Tarih |

### Response 200

```json
{
  "symbol": "USDTRY",
  "date": "2023-06-15",
  "close": 23.45,
  "open": 23.31,
  "high": 23.52,
  "low": 23.28
}
```

### Response 404

```json
{
  "type": "https://saydin.app/errors/price-not-found",
  "title": "Fiyat bulunamadı",
  "status": 404,
  "detail": "2023-06-15 tarihinde USDTRY fiyatı bulunamadı.",
  "traceId": "00-…",
  "code": "price_not_found",
  "nearestDates": ["2023-06-14", "2023-06-16"]
}
```

---

## GET /assets/{symbol}/price-range

Fiyat grafik verisi için aralıklı fiyat listesi.

### Query Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `from` | YYYY-MM-DD | ✓ | Başlangıç tarihi |
| `to` | YYYY-MM-DD | ✓ | Bitiş tarihi |
| `interval` | enum | — | `daily` \| `weekly` \| `monthly` (default: `daily`) |

### Response 200

```json
{
  "symbol": "USDTRY",
  "interval": "monthly",
  "points": [
    { "date": "2023-01-31", "close": 18.72 },
    { "date": "2023-02-28", "close": 18.91 },
    { "date": "2023-03-31", "close": 19.43 }
  ]
}
```

---

## POST /scenarios

Kullanıcının "ya alsaydım?" senaryosunu kaydeder.

**Auth gerektirir:** `X-Device-ID`

### Request

```json
{
  "assetSymbol": "USDTRY",
  "assetDisplayName": "Dolar/TL",
  "buyDate": "2020-03-01",
  "sellDate": null,
  "amount": 10000,
  "amountType": "try",
  "type": "what_if",
  "label": "2020 dolar alımlı ne olurdu",
  "extraData": null
}
```

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `assetSymbol` | string | ✓ | Asset sembolü (`what_if` ve `dca` tipleri için) |
| `assetDisplayName` | string | ✓ | Asset görünen adı |
| `buyDate` | date | ✓ | Alım / başlangıç tarihi |
| `sellDate` | date | — | Satış / bitiş tarihi |
| `amount` | number | ✓ | Tutar |
| `amountType` | enum | ✓ | `try` \| `units` \| `grams` |
| `type` | enum | ✓ | `what_if` \| `comparison` \| `portfolio` \| `dca` |
| `label` | string | — | Kullanıcının kendi notu |
| `extraData` | object | — | Tipe özgü ek veriler. DCA: `{ period, periodicAmount, includeInflation }`. Ters senaryo: `{ mode: 'reverse', includeInflation }` |

### Response 201

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assetSymbol": "USDTRY",
  "assetDisplayName": "Dolar/TL",
  "buyDate": "2020-03-01",
  "sellDate": null,
  "amount": 10000,
  "amountType": "try",
  "type": "what_if",
  "label": "2020 dolar alımlı ne olurdu",
  "extraData": null,
  "createdAt": "2026-03-15T10:00:00Z"
}
```

### Response 422 (Free tier limit — `scenario-limit-exceeded`)

```json
{
  "type": "https://saydin.app/errors/scenario-limit-exceeded",
  "title": "Senaryo limiti aşıldı",
  "status": 422,
  "detail": "Ücretsiz planda en fazla 10 senaryo kaydedebilirsiniz.",
  "traceId": "00-…",
  "code": "scenario_limit_exceeded",
  "limit": 10
}
```

> NOT: Senaryo limiti **422** döner (geçerli istek, domain kuralı ihlali) —
> günlük hesaplama limiti (`daily-limit-exceeded`) ise **429**. İkisi ayrı
> `type` URI'leriyle ayrılır.

---

## GET /scenarios

Kullanıcının kayıtlı senaryoları.

**Auth gerektirir:** `X-Device-ID`

### Response 200

```json
{
  "scenarios": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "assetSymbol": "USDTRY",
      "assetDisplayName": "Dolar/TL",
      "buyDate": "2020-03-01",
      "sellDate": null,
      "amount": 10000,
      "amountType": "try",
      "type": "what_if",
      "label": "2020 dolar alımlı ne olurdu",
      "extraData": null,
      "createdAt": "2026-03-15T10:00:00Z"
    }
  ]
}
```

---

## DELETE /scenarios/{id}

Kayıtlı bir senaryoyu siler.

**Auth gerektirir:** `X-Device-ID`

### Response 204

Boş body.

### Response 404

```json
{
  "type": "https://saydin.app/errors/scenario-not-found",
  "title": "Senaryo bulunamadı",
  "status": 404,
  "detail": "Senaryo bulunamadı.",
  "traceId": "00-…",
  "code": "scenario_not_found"
}
```

---

## GET /health

Altyapı health check.

### Response 200

```json
{
  "status": "healthy",
  "database": "ok",
  "cache": "ok",
  "lastIngestion": "2026-03-15T08:00:00Z"
}
```

---

## Lokalizasyon

API, `Accept-Language` header'ına göre yanıt dilini belirler. ASP.NET Core `RequestLocalizationMiddleware` kullanılır.

| Değer | Davranış |
|-------|----------|
| `tr`, `tr-TR` | Türkçe yanıt (varsayılan) |
| `en`, `en-US` | İngilizce yanıt |
| Header yok | Türkçe (varsayılan) |

Lokalize edilen alanlar:
- **`displayName`** — Asset isimleri (ör. `"Dolar/TL"` → `"Dollar/TRY"`)
- **`assetDisplayName`** — Hesaplama ve senaryo yanıtlarındaki asset isimleri
- **ProblemDetails `title`/`detail`** — Hata mesajları

`.resx` kaynak dosyaları: `Resources/ErrorMessages.resx` (Türkçe), `Resources/ErrorMessages.en.resx` (İngilizce).

Flutter istemcisi `LanguageInterceptor` ile her istekte `Accept-Language` header'ını kullanıcının dil tercihine göre gönderir.

---

## Hata Taksonomisi (RFC 7807)

> **Hata zarfı.** Tüm 4xx/5xx yanıtları **`Content-Type: application/problem+json`** ile RFC 7807
> `ProblemDetails` döner (EC-4). İstemcinin dallanma için kullanması gereken **kararlı, lokalden
> bağımsız makine ayracı `code` extension alanıdır** (EC-3) — `type` URI'si ileride değişse bile
> `code` sabittir. `title`/`detail` `Accept-Language`'e göre lokalizedir (ham anahtar değildir).
> ASP.NET `Extensions`'ı `[JsonExtensionData]` ile **kök objeye düzleştirir** (`code`, `limit`,
> `resetAt`, `nearestDates`, `feature`, `field` nested `"extensions"` altında DEĞİL, doğrudan
> köktedir). **Kaynak doğrusu:** `src/Saydin.Api/Exceptions/*ExceptionHandler.cs` +
> `src/Saydin.Api/Exceptions/ApiErrorCodes.cs`. (Önceki sürüm `type` URI'sini tek ayraç sayıyordu;
> EC-3 ile `code` eklendi, mantıksal `XXX_ERROR` sütunu kaldırıldı.)

| `code` | HTTP | `type` (URI slug) | Ek alanlar | Açıklama |
|--------|------|-------------------|-----------|----------|
| `validation` | 400 | `…/errors/validation` | `field?` | Request doğrulama hatası (domain `ValidationException`) |
| `missing_device_id` | 400 | `…/errors/missing-device-id` | — | `X-Device-ID` header yok/boş (RequireDeviceId filter) |
| `invalid_device_id` | 400 | `…/errors/invalid-device-id` | — | `X-Device-ID` biçimi geçersiz (≤128 char, `[A-Za-z0-9._-]`) |
| `feature_disabled` | 403 | `…/errors/feature-disabled` | `feature?` | Özellik plan/tier'da kapalı (paywall; `/v1/config`'te görünür, 404 değil) |
| `price_not_found` | 404 | `…/errors/price-not-found` | `nearestDates[]` | Belirtilen tarihte fiyat verisi yok |
| `asset_not_found` | 404 | `…/errors/asset-not-found` | — | Asset sembolü tanınmıyor |
| `scenario_not_found` | 404 | `…/errors/scenario-not-found` | — | Senaryo bulunamadı / bu cihaza ait değil |
| `scenario_limit_exceeded` | 422 | `…/errors/scenario-limit-exceeded` | `limit` | Free tier senaryo limiti (geçerli istek, domain kuralı ihlali) |
| `daily_limit_exceeded` | 429 | `…/errors/daily-limit-exceeded` | `limit`, `resetAt` | Günlük hesaplama/sorgu limiti |
| `rate_limited` | 429 | `…/errors/rate-limited` | (`Retry-After` header) | IP-bazlı altyapı throttle (config-gated, varsayılan kapalı) |
| `external_api` | 502 | `…/errors/external-api` | — | Dış finansal API geçici hatası (upstream kaynak adı gövdeye **sızdırılmaz**, EC-9) |
| `internal_error` | 500 | `…/errors/internal-error` | — | Beklenmeyen sunucu hatası (catch-all; teknik mesaj/stack gövdeye sızmaz) |

Tüm yanıtlar ayrıca `traceId` taşır (log korelasyonu). İstemci **`code`'a göre** map'lemeli;
`type` URI slug'ı `code` ile birebir eşleşir (kebab-case slug ↔ snake_case code).

### DeviceId 400 örneği (`missing-device-id`)

```json
{
  "type": "https://saydin.app/errors/missing-device-id",
  "title": "X-Device-ID gerekli",
  "status": 400,
  "detail": "Bu endpoint'e erişmek için X-Device-ID header'ı tek, boş olmayan bir değerle gönderilmelidir.",
  "traceId": "00-…",
  "code": "missing_device_id"
}
```

### `Share` özelliği — yalnızca istemci-tarafı gating (EC-7)

`Share` özelliği **sunucuda enforce EDİLMEZ** (free+premium için `Share=true`, kodda throw site'ı
yoktur). Server `share` için **hiçbir zaman 403/`feature-disabled` dönmez**; bu özelliğin gating'i
tamamen istemci tarafındadır. İstemci `share` için `feature-disabled` yanıtı **beklememelidir**.
(Karar: backend; ileride premium-only yapılırsa `FeatureDisabledException(featureKey:"share")`
eklenir ve bu not + taksonomi güncellenir.)
