# ADR-011: Merkezi Plan Konfigürasyonu

**Tarih:** 2026-03-17
**Durum:** Kabul Edildi

## Bağlam

Uygulama freemium modeliyle çalışıyor. Hangi özelliklerin ücretsiz, hangilerinin premium olduğuna henüz karar verilmemiş — kullanım verisi toplandıkça bu kararlar şekillenecek. Erken aşamada katı bir paywall kullanıcı kaybına yol açabilir.

## Karar

Plan limitleri ve özellik bayrakları `appsettings.json`'da `Plans` bölümünde merkezi olarak tutulur. `GET /v1/config` endpoint'i kullanıcının tier'ına göre bu konfigürasyonu Flutter'a servis eder.

## Gerekçe

- **Esneklik:** Hangi özelliğin premium olduğunu değiştirmek için uygulama güncellemesi gerekmez, backend deploy yeterlidir.
- **Basitlik:** Tek bir `appsettings.json` değişikliği tüm sistemi etkiler.
- **Güvenli varsayılan:** Flutter, `GET /v1/config` başarısız olursa `defaultConfig` ile çalışmaya devam eder — ağ hatası uygulamayı bloke etmez.
- **Ortam farklılığı:** `development`, `staging`, `production` ortamlarında farklı plan konfigürasyonları kullanılabilir (environment variable override ile).

## Alternatifler Değerlendirilen

| Alternatif | Neden Reddedildi |
|---|---|
| Limitleri hardcode etmek | Her değişiklik için uygulama güncellemesi gerekir |
| Feature flag servisi (LaunchDarkly vb.) | Erken aşama için fazla karmaşık ve maliyetli |
| Veritabanında plan tablosu | Basit limit değişikliği için fazla overhead |

## Sonuçlar

- Tüm limit ve özellik kontrolleri `PlanOptions.GetTierOptions(user?.Tier)` üzerinden yapılır
- `0` değeri sınırsız anlamına gelir (`DailyCalculationLimit`, `MaxSavedScenarios`, `PriceHistoryMonths`)
- Yeni özellik eklendiğinde `FeatureOptions` sınıfına alan eklenir ve her iki tier için `appsettings.json` güncellenir
