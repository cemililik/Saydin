# Saydın API Sözleşmesi

**Base URL:** `https://api.saydin.app/v1`
**Format:** JSON
**Auth (MVP):** `X-Device-ID: <uuid>` header
**Auth (Phase 2):** `Authorization: Bearer <jwt>`

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
  "isProfit": true
}
```

### Response 404

```json
{
  "error": "PRICE_NOT_FOUND",
  "message": "2020-03-01 tarihinde USDTRY fiyatı bulunamadı.",
  "nearestAvailableDates": ["2020-03-02", "2020-02-28"]
}
```

### Response 422

```json
{
  "error": "VALIDATION_ERROR",
  "message": "buyDate, sellDate'den önce olmalıdır.",
  "field": "buyDate"
}
```

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
      "dataAvailableFrom": "1950-01-02",
      "dataAvailableTo": "2026-03-14",
      "isActive": true
    },
    {
      "symbol": "BTC",
      "displayName": "Bitcoin",
      "category": "crypto",
      "dataAvailableFrom": "2014-01-01",
      "dataAvailableTo": "2026-03-14",
      "isActive": true
    }
  ]
}
```

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
  "error": "PRICE_NOT_FOUND",
  "message": "2023-06-15 tarihinde USDTRY fiyatı bulunamadı.",
  "nearestAvailableDates": ["2023-06-14", "2023-06-16"]
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
  "buyDate": "2020-03-01",
  "sellDate": null,
  "amount": 10000,
  "amountType": "try",
  "label": "2020 dolar alımlı ne olurdu"
}
```

### Response 201

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assetSymbol": "USDTRY",
  "buyDate": "2020-03-01",
  "sellDate": null,
  "amount": 10000,
  "amountType": "try",
  "label": "2020 dolar alımlı ne olurdu",
  "createdAt": "2026-03-15T10:00:00Z"
}
```

### Response 429 (Free tier limit)

```json
{
  "error": "SCENARIO_LIMIT_REACHED",
  "message": "Ücretsiz hesapta en fazla 5 senaryo kaydedilebilir.",
  "currentCount": 5,
  "limit": 5
}
```

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
      "label": "2020 dolar alımlı ne olurdu",
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
  "error": "SCENARIO_NOT_FOUND",
  "message": "Senaryo bulunamadı."
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

## Hata Kodları

| Kod | HTTP Status | Açıklama |
|-----|-------------|----------|
| `PRICE_NOT_FOUND` | 404 | Belirtilen tarihte fiyat verisi yok |
| `ASSET_NOT_FOUND` | 404 | Asset sembolü tanınmıyor |
| `SCENARIO_NOT_FOUND` | 404 | Senaryo bulunamadı |
| `VALIDATION_ERROR` | 422 | Request doğrulama hatası |
| `SCENARIO_LIMIT_REACHED` | 429 | Free tier senaryo limiti aşıldı |
| `RATE_LIMIT_EXCEEDED` | 429 | Günlük hesaplama limiti aşıldı |
| `INTERNAL_ERROR` | 500 | Sunucu hatası |
