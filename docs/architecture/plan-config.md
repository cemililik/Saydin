# Plan Konfigürasyon Mimarisi

## Amaç

Kullanıcı planlarına (Free / Premium) ait limit ve özellik bayraklarını merkezi bir yerden yönetmek. Herhangi bir özelliği ücretsiz ya da premium yapmak için kod değişikliği veya yeni uygulama sürümü gerekmez; yalnızca backend konfigürasyonu güncellenir.

---

## Backend

### `PlanOptions` (`appsettings.json → Plans`)

```json
{
  "Plans": {
    "Free": {
      "DailyCalculationLimit": 20,
      "MaxSavedScenarios": 10,
      "Features": {
        "Comparison": true,
        "InflationAdjustment": true,
        "Share": true,
        "PriceHistoryMonths": 12
      }
    },
    "Premium": {
      "DailyCalculationLimit": 0,
      "MaxSavedScenarios": 0,
      "Features": {
        "Comparison": true,
        "InflationAdjustment": true,
        "Share": true,
        "PriceHistoryMonths": 0
      }
    }
  }
}
```

**Semantik:**
- `DailyCalculationLimit = 0` → günlük hesaplama sınırı yok
- `MaxSavedScenarios = 0` → senaryo kaydetme sınırı yok
- `PriceHistoryMonths = 0` → tüm tarihsel veriye erişim var

### Sınır Uygulama

| Sınır | Uygulayan Sınıf |
|---|---|
| Günlük hesaplama limiti | `WhatIfCalculator.CheckDailyLimitAsync` |
| Senaryo kaydetme limiti | `SavedScenarioService.SaveScenarioAsync` |

Her iki sınıf da `IOptions<PlanOptions>` alır ve `options.Value.GetTierOptions(user?.Tier)` ile kullanıcı tier'ına göre doğru limiti okur. Bilinmeyen tier → Free davranışı.

### `GET /v1/config` Endpoint'i

Kullanıcının `X-Device-ID`'sine göre tier'ını belirler, ilgili plan konfigürasyonunu döner.

**Response:**
```json
{
  "tier": "free",
  "dailyCalculationLimit": 20,
  "maxSavedScenarios": 10,
  "features": {
    "comparison": true,
    "inflationAdjustment": true,
    "share": true,
    "priceHistoryMonths": 12
  }
}
```

---

## Flutter

### `AppConfigCubit`

Uygulama başlangıcında `load()` çağrılır. Hata durumunda `AppConfig.defaultConfig` ile çalışmaya devam eder — ağ hatası uygulamayı bloke etmez.

```dart
BlocProvider(
  create: (_) => sl<AppConfigCubit>()..load(),
)
```

### Özellik Erişimi

Herhangi bir widget'tan:
```dart
// Tek seferlik okuma
final config = context.read<AppConfigCubit>().state;
if (config.features.inflationAdjustment) { ... }

// Extension ile
if (context.appConfig.features.share) { ... }
```

### `PriceHistoryMonths` — Tarih Kısıtı

`priceHistoryMonths > 0` iken kullanıcı, seçilen varlığın son N ayından daha eski bir tarih seçemez.

Hesaplama `core/utils/date_range_utils.dart` içinde merkezileştirilmiştir:

```dart
// Tek varlık — Ya Alsaydım ekranı
final range = assetDateRange(
  assetFirstDate: selectedAsset?.firstDate,
  assetLastDate:  selectedAsset?.lastDate,
  priceHistoryMonths: config.features.priceHistoryMonths,
);

// Çoklu varlık — Karşılaştırma ekranı
// Önce seçili varlıkların tarih aralıkları kesiştirilir,
// ardından priceHistoryMonths uygulanır.
final range = comparisonDateRange(
  assets: state.assets,
  selectedSymbols: state.selectedSymbols,
  priceHistoryMonths: config.features.priceHistoryMonths,
);
```

`DateInput` widget'ına dönen `firstDate` / `lastDate` değerleri doğrudan tarih seçicide gösterilir.

---

## Yeni Özellik Premium'a Alma

1. `appsettings.json`'da ilgili `Features` alanını `Free` planında `false` yap.
2. Flutter'da ilgili widget'ı `context.appConfig.features.<özellikAdı>` ile gate et.
3. Uygulama güncellemesi **gerekmez** — backend deploy yeterlidir.

```json
// Örnek: InflationAdjustment'ı premium'a alma
"Free": {
  "Features": {
    "InflationAdjustment": false   // ← sadece bu değişir
  }
}
```

---

## Dosya Konumları

| Katman | Dosya |
|---|---|
| Backend options | `src/Saydin.Api/Options/PlanOptions.cs` |
| Backend endpoint | `src/Saydin.Api/Endpoints/AppConfigEndpoints.cs` |
| Backend DTO | `src/Saydin.Api/Models/Responses/AppConfigResponse.cs` |
| Flutter entity | `lib/features/config/domain/entities/app_config.dart` |
| Flutter repository | `lib/features/config/domain/repositories/app_config_repository.dart` |
| Flutter cubit | `lib/features/config/presentation/cubit/app_config_cubit.dart` |
| Tarih kısıt utils | `lib/core/utils/date_range_utils.dart` |
| Context extension | `lib/core/l10n/config_extensions.dart` |
