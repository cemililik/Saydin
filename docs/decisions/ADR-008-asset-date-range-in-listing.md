# ADR-008: Asset Tarih Aralığının Listing Endpoint'ine Eklenmesi

**Durum:** Kabul Edildi
**Tarih:** 2026-03-16

---

## Bağlam

Tarih seçicileri kullanıcıya veri bulunmayan tarihleri seçtirmemelidir. Bunun için her asset'in veritabanındaki en eski (`firstPriceDate`) ve en yeni (`lastPriceDate`) fiyat tarihlerinin istemciye iletilmesi gerekir.

Üç yaklaşım değerlendirildi:

**Yaklaşım A — Her asset için ayrı istek:**
```
GET /assets
GET /assets/USDTRY/price-range?... (en eski tarihi bulmak için)
GET /assets/BTC/price-range?...
...
```
N asset için N+1 istek.

**Yaklaşım B — Ayrı bir endpoint:**
```
GET /assets
GET /assets/date-ranges    →  { symbol → { firstDate, lastDate } }
```
İki ayrı istek; istemci bunları eşleştirmek zorunda.

**Yaklaşım C — Listing yanıtına gömme:**
```
GET /assets  →  [{ symbol, displayName, category, firstPriceDate, lastPriceDate }]
```
Tek istekle hem asset listesi hem tarih aralıkları gelir.

---

## Karar

**Yaklaşım C (zenginleştirilmiş listing) benimsendi.**

`AssetResponse` DTO'su `FirstPriceDate: DateOnly?` ve `LastPriceDate: DateOnly?` alanlarıyla oluşturuldu. Backend, `PriceRepository.GetAllActiveAssetsWithDateRangesAsync` metodunda EF Core navigation property üzerinden tek sorguda `Min/Max` hesaplar:

```csharp
.Select(a => new {
    Asset = a,
    FirstDate = a.PricePoints.Min(pp => (DateOnly?)pp.PriceDate),
    LastDate  = a.PricePoints.Max(pp => (DateOnly?)pp.PriceDate),
})
```

Cache stratejisi: `assets:info:{sig}` anahtarı (1 saat TTL) — fiyat verileri geldikçe tarih aralıkları değişebileceğinden `assets:list` (6 saat) ile ayrı tutuldu.

---

## Gerekçe

### Ekstra Round-Trip Yok

Asset listesi uygulamanın açılışında bir kez alınır. Tarih aralıklarını ayrı istemek bu single-load avantajını ortadan kaldırır.

### Tek Sorgu ile Verimli

`PricePoints.Min/Max` EF Core tarafından tek bir SQL sorgusuna derlenir:
```sql
SELECT a.*,
  MIN(pp.price_date) as first_date,
  MAX(pp.price_date) as last_date
FROM assets a
LEFT JOIN price_points pp ON pp.asset_id = a.id
WHERE a.is_active = true
GROUP BY a.id
```
N+1 sorgu yerine tek sorgu.

### `null` Durumunun Temiz Yönetimi

`DateOnly?` ile temsil edilir. Henüz veri yüklenmemiş asset'lerde `null` döner; istemci bu durumda tarih sınırlaması uygulamaz.

### Neden `assets:info` İçin Ayrı Cache Anahtarı?

`assets:list` (temel liste) genellikle asset eklenmeden değişmez → 6 saat TTL yeterli.
`assets:info` (tarih dahil) ise `PriceIngestion` servisinin her çalışmasıyla değişebilir → 1 saat TTL daha doğru.
İki farklı anahtar sayesinde temel liste uzun süre önbellekte kalırken tarih bilgisi daha sık yenilenir.

---

## Sonuçlar

- Asset listesi için tek HTTP isteği yeterli
- Tarih seçici uygulama açılışından itibaren doğru aralıkla çalışır
- `null` firstDate/lastDate → kısıtlama yok (graceful fallback)
- Backend'e yeni bir endpoint eklenmedi

## İlgili Dosyalar

- `src/Saydin.Services/src/Saydin.Api/Models/Responses/AssetResponse.cs`
- `src/Saydin.Services/src/Saydin.Api/Repositories/IPriceRepository.cs`
- `src/Saydin.Services/src/Saydin.Api/Repositories/PriceRepository.cs`
- `src/Saydin.Services/src/Saydin.Api/Services/IAssetService.cs`
- `src/Saydin.Services/src/Saydin.Api/Services/AssetService.cs`
- `src/Saydin.Client/lib/features/what_if/domain/entities/asset.dart`
- `src/Saydin.Client/lib/features/what_if/data/models/asset_model.dart`
