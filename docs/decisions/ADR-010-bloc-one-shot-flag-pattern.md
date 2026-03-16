# ADR-010: BLoC'ta One-Shot Flag ile Tek Seferlik UI Bildirimleri

**Durum:** Kabul Edildi
**Tarih:** 2026-03-16

---

## Bağlam

BLoC state makinesinde bazen bir şeyin "olduğunu" widget'a tek seferlik bildirmek gerekir — snackbar göstermek gibi. Bu, klasik BLoC kullanımında çözülmesi gereken bir UX sorunudur.

Somut örnek: Kullanıcı bir asset seçtiğinde daha önce seçtiği tarihler yeni asset'in veri aralığı dışındaysa tarihler otomatik sıkıştırılır. Bu durumda kullanıcıya "tarih ayarlandı" snackbar'ı gösterilmelidir. Ancak snackbar **yalnızca bir kez** gösterilmelidir — state değişikliğinin ardından her rebuild'de değil.

Değerlendirilen yaklaşımlar:

**Yaklaşım A — Ayrı event stream / sink:**
BLoC'tan widget'a bir Stream<UIEvent> veya EventSink açılır.
- BLoC ile widget arasında ekstra kanal gerektirir
- get_it ile DI'da komplikasyon
- "BLoC sadece state emit eder" prensibini kırar

**Yaklaşım B — State'e nullable mesaj alanı:**
```dart
class WhatIfFormInput {
  final String? snackbarMessage; // null ise gösterme
}
```
Widget `snackbarMessage != null` iken snackbar gösterir, sonra `null`'a sıfırlamak için event atar. Sıfırlama event'i ekstra BLoC turu demektir.

**Yaklaşım C — One-shot bool flag:**
```dart
class WhatIfFormInput {
  final bool dateAdjusted; // varsayılan: false
}
// copyWith her zaman dateAdjusted: false döner (parametre default değeri)
```
Widget `listenWhen: (!prev.dateAdjusted && curr.dateAdjusted)` ile sadece `false→true` geçişini yakalar. BLoC bir sonraki form güncellemesinde flag'i otomatik olarak `false`'a döndürür.

---

## Karar

**Yaklaşım C (one-shot bool flag) benimsendi.**

### Uygulama

```dart
// State:
class WhatIfFormInput extends Equatable {
  final bool dateAdjusted; // varsayılan false

  WhatIfFormInput copyWith({
    // ...
    bool dateAdjusted = false,  // ← her copyWith çağrısı sıfırlar
  }) { ... }
}

// BLoC:
_emitWithUpdatedForm(emit, _formInput.copyWith(
  // ...
  dateAdjusted: dateAdjusted,  // true olarak set edilir
));
// Bir sonraki herhangi bir form değişikliğinde copyWith default'u false'a döner

// Widget:
BlocConsumer(
  listenWhen: (prev, curr) =>
    !prev.formInput.dateAdjusted && curr.formInput.dateAdjusted,  // sadece false→true
  listener: (ctx, state) {
    ScaffoldMessenger.of(ctx).showSnackBar(...);
  },
)
```

---

## Gerekçe

### BLoC State Semantiğini Korur

BLoC yalnızca state emit eder — ekstra kanal veya callback yok. Widget-BLoC iletişimi tek yönlü kalır: event gönder, state al.

### Otomatik Sıfırlama

`copyWith` metodunun `dateAdjusted` parametresinin varsayılan değeri `false`'dır. Bu sayede:
- BLoC'un "sonra false'a çevir" event'i göndermesi gerekmez
- Flag, bir sonraki herhangi bir form değişikliğinde otomatik sıfırlanır
- Ekstra BLoC round-trip yok

### `listenWhen` ile Kesin Tetikleme

`!prev.dateAdjusted && curr.dateAdjusted` → yalnızca `false→true` geçişi tetikler. `true→true` geçişi tetiklemez (aynı state tekrar emit edilse bile). Bu, snackbar'ın tam bir kez gösterilmesini garanti eder.

### Ne Zaman Bu Kalıp Uygulanmamalı?

- Flag'in "durumu" temsil ettiği durumlar (örn: kullanıcı onayı bekleniyor) — bunlar için ayrı state tipi daha uygun
- Birden fazla widget'ın aynı bildirimi dinlemesi gerekiyorsa — stream yaklaşımı tercih edilebilir
- Kalıcı UI değişikliği gerektiren durumlar (modal açma vb.) — Navigator çağrısı için router pattern

---

## Sonuçlar

- Tek seferlik UI bildirimi ekstra event/stream olmadan çözülür
- Kalıp tekrarlanabilir: aynı yöntem diğer "bir kez bildir" senaryolarına uygulanabilir
- `copyWith` default değeri ile flag yönetimi otomatik — unutmak zor

## İlgili Dosyalar

- `src/Saydin.Client/lib/features/what_if/presentation/bloc/what_if_state.dart`
- `src/Saydin.Client/lib/features/what_if/presentation/bloc/what_if_bloc.dart`
- `src/Saydin.Client/lib/features/what_if/presentation/pages/what_if_page.dart`
