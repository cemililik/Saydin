# ADR-014: Paylaşılan Asset Domain'i ve Asset Widget'larının `core`/`shared` Modülüne Çıkarılması

**Durum:** Kabul Edildi (uygulaması ertelendi — ayrı PR)
**Tarih:** 2026-05-29
**İlgili:** İstemci master review F-08-12; ACTION-PLAN Faz 5

---

## Bağlam

`Asset` entity'si, `GetAssets` use case'i ve asset seçim/giriş widget'ları
(`AssetSelector`, `DateInput`, `AmountInput`, `ShareCardWidget`) tarihsel
nedenlerle `features/what_if/` altında yaşıyor. Ancak bunlar **tüm feature'lar**
tarafından kullanılıyor:

- `Asset` entity'sini import edenler: what_if, comparison, dca, portfolio,
  scenarios ve `core/utils/date_range_utils.dart` (≈14 dosya).
- Asset widget'larını (`AssetSelector`/`DateInput`/`AmountInput`) import edenler:
  comparison, dca, portfolio (+ what_if).

Bu, Clean Architecture açısından bir **cross-feature coupling**'dir: feature'lar
birbirinin presentation ve domain katmanına doğrudan bağımlı. Üstelik
`core/utils/date_range_utils.dart` (core katmanı) `features/what_if`'i import
ederek bir **katman ihlali** yaratıyor (core → feature).

Master review F-08-12 bu kuplajı işaretledi ve paylaşılan parçaların ortak bir
konuma taşınmasını önerdi.

## Karar

`Asset` domain'i ve gerçekten paylaşılan asset widget'ları ortak bir modüle
taşınacaktır:

- `Asset` entity + `AssetsRepository` (abstract) + `GetAssets` use case →
  `lib/core/domain/assets/` (ya da bağımsız bir `lib/shared/assets/` feature'ı).
- `AssetSelector`, `DateInput` (ve gerçekten ortak olan diğer widget'lar) →
  `lib/core/widgets/`.
- `WhatIfRepository`'deki `getAssets()` ayrı bir `AssetsRepository`'ye bölünecek;
  böylece asset listesi çekme What-If hesaplama repository'sinden ayrışacak.
- Tüm feature'lar asset'i bu ortak modülden import edecek; feature'lar arası
  doğrudan bağ kalmayacak. `core/utils/date_range_utils.dart` katman ihlali de
  böylece kapanacak.

## Gerekçe

`Asset` uygulamanın geneline ait bir **çekirdek domain kavramıdır** (her ekran
asset üzerinden çalışır), bir What-If detayı değil. Ortak modüle çıkarmak:

- Feature'ları birbirinden bağımsız kılar (CLAUDE.md "feature-first" sözleşmesi).
- `core → feature` ihlalini ortadan kaldırır.
- Gelecekteki feature'ların (örn. trend/popüler, döviz çevirici) asset'i What-If'e
  bağlanmadan kullanmasını sağlar.

## Neden Faz 5'te Uygulanmadı (Erteleme)

Bu, app-genelinde ~19+ dosyalık import değişikliği **ve** `WhatIfRepository`'nin
asset-fetch sorumluluğunun ayrılmasını (repository split) gerektirir. Faz 5
zaten 16 ayrı mimari düzeltme içeriyordu; bu büyük mekanik taşımayı aynı PR'a
katmak:

- İnce hata (kaçırılan import, test fixture yolu) riskini büyütür,
- Review yükünü ve diff boyutunu ciddi artırır,

ki bu, "ilk seferde doğru, az fix turu" hedefiyle çelişir. Bu yüzden **kendi
odaklı PR'ına** ertelendi. Derleyici (`flutter analyze --fatal-infos`) ve test
suite taşımayı mekanik olarak doğrulayacağından, izole bir PR'da düşük riskle
yapılabilir.

## Sonuçlar

**Olumlu:**
- Faz 5 ile portföy (F-09-19) ve senaryolar (F-11-07) zaten What-If'ten koparıldı;
  bu ADR kalan en derin kuplajı (paylaşılan `Asset`) hedefler.
- İzole PR → net review, kolay geri alma.

**Olumsuz / dikkat:**
- Erteleme süresince `core/utils/date_range_utils.dart` katman ihlali açık kalır.
- Taşıma sırasında `AmountInput` gibi feature-spesifik mantık içeren widget'lar
  ayrıştırılmalı (her widget gerçekten "ortak" mı değerlendirilmeli).

## Uygulama Notları (sonraki PR için)

1. Önce `grep -rn "features/what_if" lib/features lib/core` ile tüm importerları
   çıkar.
2. `AssetsRepository` interface'i oluştur; `WhatIfRepositoryImpl.getAssets`'i
   ayrı `AssetsRepositoryImpl`'e taşı (ya da `WhatIfRepositoryImpl` ikisini de
   implement etsin — geçiş kolaylığı için).
3. `Asset` + `GetAssets`'i ortak modüle taşı, importları güncelle.
4. Ortak widget'ları `core/widgets/`'e taşı; feature-spesifik olanları yerinde
   bırak.
5. DI yollarını güncelle; `flutter analyze --fatal-infos && flutter test`.
6. `core/utils/date_range_utils.dart` importunu ortak modüle çevir.
