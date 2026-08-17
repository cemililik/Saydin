# Saydın — Hata Sözleşmesi & İstemci Gösterimi Analiz Raporu

> Tarih: 2026-05-30 · Kapsam: `saydin-services` (backend) + `saydin-client` (Flutter)
> Tetikleyen olay: `POST /v1/what-if/calculate` → Serilog log'unda `StatusCode 500`, `FeatureDisabledException: Feature 'extended_history' disabled`
> Yöntem: çok-ajanlı kod okuma + çapraz/çürütücü doğrulama (5 araştırmacı + 1 denetçi + 3 ayraç ajanı)

---

## 1. SORUN ÖZETİ

Free plandaki kullanıcı, planının `PriceHistoryMonths` penceresinden daha eski bir **alış tarihiyle** "ya alsaydım?" hesaplaması yaptı. Backend bunu plan-kapısı (paywall) olarak `403 Forbidden` döndürmeli iken, istemci **jenerik "Sunucu hatası. Lütfen tekrar deneyin."** mesajını gösterdi.

İki ayrı kusur söz konusu. **Kritik nokta:** ikisi de **bire bir aynı** semptomu ("Sunucu hatası") üretir, bu yüzden eldeki kanıt (Serilog log'u + ekran metni) tek başına hangisinin gerçekleştiğini **ayırt edemez** (bkz. §2).

| # | Katman | Kusur | Durum |
|---|--------|-------|-------|
| **B** | Client (kod) | `feature-disabled` type'ı ve `403` status'ü için varyant yok → mapper bunları `ServerError`'a düşürür | **KESİN** — koddan doğrulandı; tek başına semptomu açıklamaya yeter |
| **A** | Backend (deploy) | İstek client'a gerçekten `500` (paywall yerine) dönmüş olabilir — büyük olasılıkla **deploy skew** | **OLASI** — kanıtla tutarlı ama teyit edilmedi (wire status gerekli) |

> **En önemli sonuç:** Kusur B **tek başına** kullanıcının gördüğü "Sunucu hatası"nı açıklar. Backend `403` döndürse **bile** istemci bugünkü haliyle yine "Sunucu hatası" gösterir — çünkü mapper `403`'ü de `ServerError`'a eşler. Dolayısıyla:
> - **Client düzeltmesi mutlaka gerekli** (her iki senaryoda da).
> - **Backend gerçekten 500 mü dönüyor, yoksa 403 mü?** — bunu ancak **gerçek wire status'ünü** (ağ proxy'si veya client-side `e.response?.statusCode` log'u) yakalayarak öğrenebiliriz.

---

## 2. KÖK NEDEN (doğrulanmış)

İlk hipotez — *"FeatureDisabledExceptionHandler kayıtlı değil / yanlış sırada"* — **çürütüldü**. Kaynak kodda her şey doğru:

- `FeatureDisabledExceptionHandler` mevcut, `403 + problem+json` üretiyor, `feature` extension'ı ekliyor — `FeatureDisabledExceptionHandler.cs:25,37-44`
- Kayıt sırası doğru: `FeatureDisabledExceptionHandler` (`Program.cs:119`) → `GlobalExceptionHandler` (`Program.cs:126`); zincir ilk eşleşmede durur
- `app.UseExceptionHandler()` **koşulsuz** kayıtlı (`Program.cs:385`); `UseDeveloperExceptionPage` **hiç yok** (tüm dosya tarandı)
- Endpoint `ProducesProblem(403)` ilan ediyor — `WhatIfEndpoints.cs:22-30`

**Yani mevcut kaynak koddan derlenen bir imaj, bu istisnayı her ortamda `403`'e çevirir.** O zaman log neden `500` gösteriyor? — İki bağımsız sebep var ve **ikisi de aynı anda doğru olabilir**.

### 2a. Serilog log'undaki `500`, client'a `500` gittiğini KANITLAMAZ (log artefaktı)

```
Program.cs:385  app.UseExceptionHandler()        ← en DIŞ (ilk kayıt = en dış sarmalayıcı)
Program.cs:386  app.UseSerilogRequestLogging()   ← daha iç
Program.cs:391  app.UseMiddleware<ActivityLogMiddleware>()  ← en iç
```

ASP.NET Core'da ilk kaydedilen middleware **en dıştadır**. İçeride fırlayan istisna dışarı doğru kabarır: `endpoint → ActivityLog → Serilog → UseExceptionHandler`. Serilog'un `RequestLoggingMiddleware`'i istisnayı **`UseExceptionHandler` onu `403`'e çevirmeden ÖNCE** görür; Serilog istisna durumunda status'ü **kod gereği `500`** olarak loglayıp istisnayı tekrar fırlatır, sonra dış `UseExceptionHandler` yakalayıp client'a `403` yazar.

> ⚠️ **Sonuç:** Mevcut (doğru) kodla bile, `403` dönen bir istek için Serilog'da **`StatusCode 500` + tam stack trace** bir log satırı görürsün. **Senin paylaştığın log tam da bu görünümde** — yani bu log, client'ın `500` aldığının kanıtı **değil**.

### 2b. İstemci metni de `403` ile `500`'ü AYIRT ETMEZ (düzeltme)

Mapper'ın status fallback'i şöyle (`dio_error_mapper.dart:76-80`):
```dart
if (status == 404) return const PriceNotFoundError();
if (status == 429) return DailyLimitError(resetAt: _resetAt(data));
return ServerError(statusCode: status);   // ← 403, 401, 400, 409 ve TÜM 5xx buraya düşer
```

`404`/`429` dışındaki **her şey** — `403` dahil — `ServerError`'a düşer. `ServerError` → `errorServer` = **"Sunucu hatası. Lütfen tekrar deneyin."** (`what_if_page.dart:120`). `UnknownError` ise yalnızca **ağ-seviyesi** `DioExceptionType.unknown` dalından gelir (`dio_error_mapper.dart:48`), status fallback'inden **asla**.

> ⚠️ **Demek ki bir `403`-feature-disabled de, bir gerçek `500` de aynı "Sunucu hatası" metnini üretir.** Ekran metni hangi status'ün geldiğini söylemez. *(Önceki taslakta "metin ≥500 olduğunu kanıtlıyor" demiştim — bu yanlıştı; `403` da aynı `ServerError`'a düşüyor.)*

### 2c. İki aday kök neden — wire status olmadan ayırt edilemez

Tüm kanıtlarla (Serilog `500` + ekranda "Sunucu hatası") **iki senaryo da** tutarlı:

**Senaryo 1 — Backend gerçekten `403` dönüyor, kusur sadece client'ta (Kusur B):**
Mevcut imaj çalışıyor; handler `403 + /errors/feature-disabled` üretiyor; client `403`'ü `ServerError`'a eşleyip "Sunucu hatası" gösteriyor. Serilog `500` ise §2a'daki artefakt. **Bu senaryoda backend'de hiçbir bug yok** — tek sorun client.

**Senaryo 2 — Backend gerçekten `500` dönüyor (deploy skew):**
- `FeatureDisabledExceptionHandler` ve `AddExceptionHandler<>` kaydı **ilk olarak 2026-05-27, commit `6b2243c`'de** eklenmiş. HEAD = `51124aa` (2026-05-30). **Release tag yok.**
- `Dockerfile:43` → `ENV ASPNETCORE_ENVIRONMENT=Production` (imaja gömülü); olay `MachineName`'i bir konteyner hash'i.
- `6b2243c`'den **önceki** bir commit'ten build edilmiş çalışan bir imajda handler **yoktur** → istisna eski/çatı-default 500'e düşer → gövde `/errors/internal-error` olur. Bu senaryoda client doğru davranıp `ServerError` gösterir; **kusur backend deploy'unda**.

Daha düşük olasılıklı 3. mekanizma: istisna `UseExceptionHandler`'a ulaşmadan **sarmalanmış** (ör. `TargetInvocationException`) olabilir; handler'ın `is not FeatureDisabledException` kontrolü kaçırır → 500. (Mevcut imajda bile gerçek 500 üretebilir.)

**Nasıl ayırt edilir (tek adım):** Olayı tekrarlayıp **gerçek HTTP yanıtını** yakala — ağ proxy'si (Charles/mitmproxy) **veya** client'ta geçici bir `debugPrint(e.response?.statusCode)` + gövdedeki `type`. `403` + `type:.../feature-disabled` görürsen → **Senaryo 1** (sadece client). `500` + `type:.../internal-error` görürsen → **Senaryo 2** (backend redeploy gerekli).

> **Doğrulama boşluğu (her iki senaryoda da geçerli):** Backend'de bu **tam rotanın** (`POST /v1/what-if/calculate`, pencere-dışı `BuyDate`) `403` döndürdüğünü kanıtlayan **uçtan-uca test YOK**. `extended_history → 403` yalnızca **DCA** ve `comparison → 403` yalnızca **comparison** endpoint'lerinde E2E test edilmiş (`DcaEndpointTests.cs`, `ComparisonEndpointTests.cs`); what-if/calculate için sadece "calculator istisna *fırlatıyor mu*" diye **in-process unit test** var (`WhatIfCalculatorTests.cs`). Unit test yeşil kalırken HTTP sınırı `500` dönebilir — CI bunu hiç yakalamaz. Bu boşluk, Senaryo 2'yi sessizce mümkün kılar.

---

## 3. BACKEND HATA SÖZLEŞMESİ (tam tablo)

Her hata gövdesi: `System.Text.Json` ile serialize edilmiş `ProblemDetails` (**camelCase**) — `{ type, title, status, detail, extensions{ traceId, ... } }`. Başlık/detay **server-side lokalize** (`Accept-Language` → tr/en; resx'ler 62 key, senkron). **Tüm yanıtlarda `traceId` var.**

| # | Exception | HTTP | `type` slug (kararlı anahtar) | Ek alanlar (extension) |
|---|-----------|------|------------------------------|------------------------|
| 1 | ValidationException | **400** | `/errors/validation` | `field` |
| 2 | **FeatureDisabledException** | **403** | `/errors/feature-disabled` | **`feature`** (= `inflation`\|`comparison`\|`extended_history`\|`dca`) |
| 3 | AssetNotFoundException | 404 | `/errors/asset-not-found` | — |
| 4 | PriceNotFoundException | 404 | `/errors/price-not-found` | `nearestDates[]` |
| 5 | ScenarioNotFoundException | 404 | `/errors/scenario-not-found` | — |
| 6 | ScenarioLimitExceededException | **422** | `/errors/scenario-limit-exceeded` | `limit` |
| 7 | DailyLimitExceededException | 429 | `/errors/daily-limit-exceeded` | `limit`, `resetAt` (ISO-8601) |
| 8 | ExternalApiException | 502 | `/errors/external-api` | `source` |
| 9 | RateLimiter (varsayılan KAPALI) | 429 | `/errors/rate-limited` | `Retry-After` header |
| 10 | **GlobalExceptionHandler (catch-all)** | **500** | `/errors/internal-error` | sadece `traceId` |

### Güvenlik bulguları (önemli, olumlu)

- ✅ **Stack trace / teknik `Message` client'a SIZMIYOR.** `GlobalExceptionHandler` (`:21-25`) tam istisnayı **yalnızca log'a** yazar; gövdeye statik lokalize `UnexpectedError` / `ServerError` koyar (`:29-36`). Senin paylaştığın o uzun stack trace'li JSON **sunucu log kaydı**; client'a giden gövde değil. ✔
- ⚠️ İki nokta ("teknik string sızıntısı" sınırında):
  - `ValidationException` ve `FeatureDisabledException` `detail = ex.Detail` ile **servis katmanının verdiği string'i** geçirir. Bunlar lokalize ("Bu özellik mevcut planınızda kullanılamıyor.") ama gövdeye gidiyor — kabul edilebilir, sadece bilinçli olun.
  - `ExternalApiException` → `source` extension'ında **iç upstream kimliği** (`ex.ApiSource`) client'a gidiyor — bir `5xx`'te tek jenerik-olmayan alan. Hassas değilse sorun yok, ama kaldırılması düşünülebilir.

### Sözleşmedeki iki zayıflık

1. **Makine-okunur `code` alanı YOK.** Tek kararlı ayraç `type` URI slug'ı. `title`/`detail` lokalize → **anahtar olarak kullanılamaz**. İstemci `type`'a göre dallanmalı.
2. **Content-Type tutarsız.** 9 handler `WriteAsJsonAsync` ile `application/json` döndürüyor; sadece RateLimiter `application/problem+json` koyuyor. → **İstemci `problem+json` media-type'ına bel bağlamamalı**, her `application/json` 4xx/5xx gövdesini `ProblemDetails` gibi parse etmeli (zaten öyle yapıyor).

---

## 4. CLIENT DURUMU

### Mevcut akış
`AppError` (sealed, 9 varyant) → her sayfada **kopyalanmış** exhaustive `switch` → `context.l10n.<key>` → **kırmızı SnackBar** (aksiyon butonu YOK). Tek "tekrar dene" yolu Hesapla'ya yeniden basmak.

### Neden jenerik mesaj görünüyor (iki katmanlı boşluk)
- Mapper `type` slug'ına göre yalnızca 4 tipi tanıyor: `price-not-found`, `asset-not-found`, `scenario-limit-exceeded`, `daily-limit-exceeded` (`dio_error_mapper.dart` type-switch, satır 62-74). **`feature-disabled` bilinçli olarak ele alınmıyor** — koddaki yorum bunu *"feature-disabled paywall'ı Faz 4."* diye erteliyor.
- `app_error.dart`'ta **`FeatureDisabledError` / `Forbidden` / paywall varyantı YOK** (9 varyantın hiçbiri).
- Sonuç (§2b ile aynı): mapper'ın status fallback'i `404`/`429` dışındaki **her şeyi** `ServerError(statusCode: status)`'a düşürür. Yani **`403` de gelse, `500` de gelse** → `ServerError` → `errorServer` ("Sunucu hatası"). İkisi de yanlış UX (paywall değil), ve ikisi de **aynı** metni verdiği için ekrandan ayırt edilemez. *(`UnknownError → errorGeneric` yalnızca ağ-seviyesi `DioExceptionType.unknown` dalından gelir, status fallback'inden değil.)*

### Olumlu: istemci kullanıcının tier'ını ZATEN biliyor
`lib/features/config/` → `SubscriptionTier {free, premium}`, `AppConfig.isPremium`, `AppConfigCubit`, `context.appConfig`. Backend `/config`'ten geliyor (fail-closed → free). Zaten gating'de kullanılıyor (`portfolio_page.dart:257`, `scenarios_page.dart` API'ye `plan` gönderiyor). `AppFeatureFlags` per-feature bayrakları taşıyor (`what_if_page.dart:199-228`). → İstemci `extended_history` çağrısını **proaktif** engelleyebilir.

---

## 5. ÖNERİLEN ÇÖZÜM

### 5A. BACKEND (öncelik sırasıyla)

1. **[ACİL] Production imajını yeniden deploy et.** `6b2243c` (handler eklendi) sonrası HEAD'den temiz build. Bu büyük olasılıkla `500 → 403`'ü tek başına çözer.
2. **[ZORUNLU] Uçtan-uca regresyon testi ekle** (`WebApplicationFactory`): Free tier + pencere-dışı `BuyDate` ile `POST /v1/what-if/calculate` → assert `403` + `type` endsWith `/errors/feature-disabled` + `feature == "extended_history"` + lokalize `detail`. `inflation`/`comparison`/`dca` için paralel case'ler + `GlobalExceptionHandler` 500'ün stack sızdırmadığını doğrulayan bir case. *(Bu test olsaydı olay hiç çıkmazdı.)*
3. **[ÖNERİ] Her handler'a kararlı düz `code` extension ekle** (`feature_disabled`, `daily_limit_exceeded`, …). `type` URI'si değişse bile istemci kırılmaz; locale/media-type bağımsız tek ayraç olur.
4. **[ÖNERİ] Content-Type'ı `application/problem+json`'a taşı** (9 handler / `IProblemDetailsService`) — zaten review bulgusu `EXC-LOW-01`.
5. **[İNCELE] Middleware sırası:** `UseSerilogRequestLogging`'i `UseExceptionHandler`'dan **dışa** almak, log'da artık çevrilmiş status'ü (403) göstertir ve yanıltıcı 500 log'larını engeller. (Davranışı değiştirmez, sadece log doğruluğu.) `ActivityLogMiddleware`'in sarmalama yapıp yapmadığını da teyit edin.

### 5B. CLIENT (backend 403 dönse de gerekli)

1. **Yeni varyant:** `app_error.dart`'a `FeatureDisabledError(String? featureKey)` ekle (`AssetNotFoundError` deseni gibi; `featureKey`'i `props`'a koy).
2. **Mapper:** `dio_error_mapper.dart` `type` slug switch'ine (satır 62-74 civarı) `case 'feature-disabled': return FeatureDisabledError(featureKey: _stringExtension(data, 'feature'));` ekle. (`feature` string'i için mevcut flat+nested `_intExtension` desenine eş bir `_stringExtension` helper'ı ekle.) Koddaki "feature-disabled paywall'ı Faz 4." yorumunu kaldır.
3. **[Dayanıklılık] `403` status fallback'i:** `map()` içindeki inline status fallback'ine (satır 76-80, `return ServerError(statusCode: status)` öncesi) `if (status == 403) return const FeatureDisabledError();` ekle — gövdede `type` yoksa bile paywall yakalanır. *(Şu an `403`, `404`/`429` dışındaki her şey gibi `ServerError`'a düşüyor — bkz. §2b.)*
4. **l10n:** `errorFeatureDisabled` (+ ileride upgrade CTA etiketi) **hem** `app_tr.arb` **hem** `app_en.arb`'a ekle (CLAUDE.md tek-dil yasağı). Öneri: TR "Bu özellik mevcut planınızda kullanılamıyor." / EN "This feature isn't available on your current plan." (backend `detail`'ı ile uyumlu, ama backend string'ini ekrana **birebir basma** — kendi key'ini kullan).
5. **Exhaustive switch'ler:** `exhaustive_cases` analyzer kuralı, yeni varyantı **5 sayfanın** (`what_if`, `comparison`, `dca`, `portfolio`, `scenarios`) hepsinde ele almaya **derleme zamanında zorlar** — hiçbiri atlanmaz.
6. **UX (ayrı karar):** SnackBar CTA taşıyamıyor. Öneriler: (a) `SnackBarAction` ile "Premium'a Geç", veya (b) `comparison_page.dart:209-225` "inline hata + buton" desenini yeniden kullanan paywall kartı, veya (c) bottom-sheet. *Not: repo'da henüz in-app-purchase akışı yok — "Upgrade" hedefi tanımsız (açık soru).*
7. **[ÖNERİ] Proaktif gating:** Free kullanıcılar için pencere-dışı tarihte `extended_history` çağrısını `config.isPremium` ile **önceden** engelleyip round-trip'i atla (`portfolio_page.dart:257` zaten benzerini yapıyor). Reaktif 403 yakalaması ise emniyet ağı olarak kalır.

> **Stale referans uyarısı:** CLAUDE.md ve hafıza `lib/core/network/dio_error_mapper.dart` diyor; gerçek dosya **`lib/core/error/dio_error_mapper.dart`**. Tek mapper bu.

---

## 6. GENEL PRENSİP (tekrar etmesin diye)

1. **Makine-okunur taksonomi BE↔Client arası paylaşılmalı.** Kararlı `code` (veya `type` slug) — asla lokalize `title`/`detail` üzerinden dallanma.
2. **`4xx` = küratörlü mesaj, `5xx` = jenerik + Sentry.** İstemci yalnızca **beyaz-listedeki** kodları özel mesaja çevirir; bilinmeyen → jenerik. Sunucu `detail`'ı **asla birebir** ekrana basılmaz.
3. **Sunucu hiçbir zaman stack/teknik Message'ı gövdeye koymaz** (şu an doğru — koruyun).
4. **Her domain hata rotası için HTTP-sınırı testi.** "Throw oluyor mu" unit testi yetmez; "rota doğru status+gövde dönüyor mu" entegrasyon testi şart.
5. **Tag-driven release + deploy doğrulaması.** Bu olay bir deploy-skew. Release tag disiplini (CLAUDE.md zaten dayatıyor) + deploy sonrası smoke testi bunu yakalar.

---

## 7. RİSKLER & AÇIK SORULAR

- **`Plans:Free` gerçek değerleri** `appsettings.json`'da (kaynak C# default'ları permissif: `PriceHistoryMonths=12`). Hangi değerin `extended_history` kapısını tetiklediği teyit edilmeli.
- **`FeatureOptions.Share`** default `true` ama **throw site'ı yok** — share gating nerede? İstemci `403` beklemeli mi?
- **`422` (ScenarioLimit) ve iki ayrı `429`** (daily-limit vs rate-limited) ve **üç ayrı `404`**: istemci bunları `type` slug'ına göre ayırmalı, status'e göre değil (aksi halde `resetAt`/`nearestDates`/per-feature upsell kaybolur). İstemcide `422` için ayrı varyant yok — ele alınmalı.
- **DeviceId guard hataları** (`DeviceIdRequired`/`DeviceIdInvalid`, `RequireDeviceId()` filtresi) hangi status/type üretiyor? Ayrı handler dosyası görülmedi.
- **UX hedefi:** "Premium'a Geç" butonu nereye gider? In-app-purchase / abonelik akışı henüz yok.
- **Deploy doğrulaması:** Çalışan imajın gerçekten HEAD'i çalıştırdığı testlerle kanıtlanamaz — manuel smoke test gerekir.
