# ADR-009: Duplicate Senaryo Tespitinin İstemci Tarafında Yapılması

**Durum:** Kabul Edildi
**Tarih:** 2026-03-16

---

## Bağlam

Kullanıcı aynı parametrelerle (sembol + alış tarihi + satış tarihi + tutar + tutar tipi) bir senaryoyu birden fazla kez kaydetmeye çalıştığında engellenmeli ve bilgilendirilmelidir.

Bu kontrolün nerede yapılacağına dair iki yaklaşım değerlendirildi:

**Yaklaşım A — Sunucu tarafı:**
- `POST /scenarios` isteği gönderilir
- Sunucu aynı `device_id` + parametreler kombinasyonunu kontrol eder
- `409 Conflict` döner
- İstemci `409`'u `DuplicateScenarioError`'a map'ler ve snackbar gösterir

**Yaklaşım B — İstemci tarafı (BLoC):**
- `ScenariosBloc._onSaveRequested` API'ye gitmeden önce `state.scenarios` listesini tarar
- Duplicate bulunursa `ScenariosDuplicate` state emit edilir, API çağrısı yapılmaz
- Duplicate yoksa normal kaydetme akışı devam eder

---

## Karar

**Yaklaşım B (istemci tarafı BLoC kontrolü) benimsendi.**

`ScenariosBloc._onSaveRequested` içinde kaydetmeden önce:

```dart
final isDuplicate = current.any(
  (s) =>
      s.assetSymbol == event.assetSymbol &&
      s.buyDate == event.buyDate &&
      s.sellDate == event.sellDate &&
      s.amount == event.amount &&
      s.amountType == event.amountType,
);
if (isDuplicate) {
  emit(ScenariosDuplicate(current));
  return;
}
```

---

## Gerekçe

### Gereksiz Network İsteği Yok

İstemci zaten `state.scenarios` listesini bellekte tutar. Bu listeye karşı yapılan kontrol anlıktır ve kullanıcı fark etmez. Sunucuya gidip `409` almak için bekleme süresi eklemek UX'i kötüleştirir.

### Senaryo Listesi Zaten İstemcide

Uygulama açılışında senaryolar yüklenir ve BLoC state'inde tutulur. Duplicate kontrolü için ek veri gerekmez — listeye `any()` uygulamak O(n) işlemdir ve n küçüktür (ücretsiz planda max 5).

### Sunucu Tarafının Avantajı Olmadığı Durum

Sunucu tarafı duplicate kontrolü şu durumlarda anlamlıdır:
- Çok cihazlı kullanım (A cihazından kaydet, B cihazından tekrar kaydetmeye çalış)
- İstemcinin stale state tuttuğu durumlar

MVP'de tek cihaz kullanımı söz konusu olduğundan ve `ScenariosBloc` her `ScenariosRequested` ile güncel listeyi yükleyeceğinden bu riskler sınırlıdır.

### Sunucu Tarafı Kontrolü Eklenmeli mi?

Gelecekte premium kullanıcıların birden fazla cihazdan aynı hesaba erişmesi durumunda sunucu tarafı `UNIQUE` kısıtı veya `409` kontrolü eklenebilir. İstemci tarafı kontrol performans optimizasyonu olarak kalır; sunucu "truth kaynağı" olur. Bu değişiklik mevcut mimariyle uyumludur.

---

## Sonuçlar

- Duplicate kaydette network isteği yapılmaz → anlık geri bildirim
- `ScenariosDuplicate` state, mevcut `ScenariosFailure` ile karışmaz — farklı snackbar rengi/mesajı uygulanabilir
- Sunucu tarafı güçlendirmesi gerektiğinde `DuplicateScenarioError` AppError tipi eklenerek istemci uyarlanabilir

## İlgili Dosyalar

- `src/Saydin.Client/lib/features/scenarios/presentation/bloc/scenarios_bloc.dart`
- `src/Saydin.Client/lib/features/scenarios/presentation/bloc/scenarios_state.dart`
- `src/Saydin.Client/lib/features/what_if/presentation/pages/what_if_page.dart`
