# ADR-006: Flutter İstemcisinde Hata Yönetimi Mimarisi

**Durum:** Kabul Edildi
**Tarih:** 2026-03-16

---

## Bağlam

Flutter istemcisinde iki farklı hata yönetimi yaklaşımı değerlendirildi:

**Yaklaşım A — BLoC string taşır:**
```dart
// BLoC hata mesajını Türkçe string olarak emit eder
emit(WhatIfFailure(message: 'Bu tarih için fiyat bilgisi bulunamadı.'));

// Widget mesajı doğrudan gösterir
Text(state.message)
```

**Yaklaşım B — BLoC AppError taşır:**
```dart
// BLoC yalnızca domain tipi taşır
emit(WhatIfFailure(error: PriceNotFoundError()));

// Widget l10n üzerinden metni çözer
Text(switch (state.error) {
  PriceNotFoundError() => l10n.errorPriceNotFound,
  ...
})
```

---

## Karar

**Yaklaşım B (AppError taşıma) benimsendi.**

`AppError` sealed class hiyerarşisi: `PriceNotFoundError`, `DailyLimitError`, `NoInternetError`, `ServerError`, `UnknownError`.

---

## Gerekçe

### BLoC UI Metnini Bilmemelidir

BLoC'un sorumluluğu iş akışını yönetmektir, UI metnini üretmek değil. Yaklaşım A bu sorumluluğu karıştırır:

- BLoC Türkçe string üretmeye başlarsa `BuildContext` bağımlılığı (veya l10n instance geçişi) kaçınılmaz olur
- BLoC testi UI metnine bağımlı hale gelir — hata mesajı değiştiğinde BLoC testleri kırılır
- Gelecekte çoklu dil desteği eklendiğinde BLoC'lar değişmek zorunda kalır

### AppError Sealed Class Avantajları

```dart
// Dart exhaustive switch — yeni hata tipi eklenirse derleme hatası
String _errorMessage(AppError error, AppLocalizations l10n) =>
    switch (error) {
      PriceNotFoundError() => l10n.errorPriceNotFound,
      DailyLimitError()    => l10n.errorDailyLimit,
      NoInternetError()    => l10n.errorNoInternet,
      ServerError()        => l10n.errorServer,
      UnknownError()       => l10n.errorGeneric,
    };
```

`sealed` keyword'ü tüm alt tiplerin aynı dosyada tanımlanmasını zorunlu kılar. Bu, `switch` ifadesini derleyici seviyesinde **exhaustive** yapar: yeni bir `AppError` alt tipi eklendiğinde widget'ları güncellemek unutulursa **derleme hatası** alınır, çalışma zamanı hatası değil.

### Sentry Seçici Raporlama

`AppError` tipleri bilindiğinde hangi hataların Sentry'ye gönderileceğine kolayca karar verilebilir:

```dart
// Yalnızca beklenmedik hatalar raporlanır
if (error is UnknownError || error is ServerError) {
  await _reporter.report(e, st, context: ctx);
}
// PriceNotFoundError, DailyLimitError, NoInternetError → beklenen akış, raporlanmaz
```

Eğer BLoC string taşısaydı, hangi string'in "beklenmedik" olduğunu programatik olarak ayırt etmek mümkün olmazdı.

---

## Sonuçlar

- BLoC testleri Türkçe string'e bağımlı değil → daha dayanıklı
- Widget katmanı l10n üzerinden hata metni çözer → çoklu dil hazır
- Yeni hata tipi eklendiğinde derleyici widget güncellemesini zorlar → tip güvencesi
- Sentry raporlaması hata tipine göre kolayca seçici yapılabilir

## İlgili Dosyalar

- `lib/core/error/app_error.dart`
- `lib/core/error/dio_error_mapper.dart`
- `lib/core/error/error_reporter.dart`
- `lib/features/what_if/presentation/bloc/what_if_state.dart`
- `lib/features/what_if/presentation/pages/what_if_page.dart`
