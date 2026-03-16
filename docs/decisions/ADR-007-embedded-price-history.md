# ADR-007: Fiyat Geçmişinin Hesaplama Yanıtına Gömülmesi

**Durum:** Kabul Edildi
**Tarih:** 2026-03-16

---

## Bağlam

Sonuç ekranında zaman serisi grafiği göstermek için alış-satış tarihleri arasındaki fiyat noktalarına ihtiyaç duyulmaktadır. Bu verinin istemciye nasıl iletileceğine dair iki yaklaşım değerlendirildi:

**Yaklaşım A — Ayrı API çağrısı:**
```
POST /what-if/calculate  →  { result }
GET  /assets/{symbol}/price-range?from=buyDate&to=sellDate  →  { pricePoints }
```
İstemci iki ayrı istek atar. Grafik, ikinci istek tamamlandıktan sonra çizilir.

**Yaklaşım B — Hesaplama yanıtına gömme:**
```
POST /what-if/calculate  →  { result, priceHistory: [...] }
```
Hesaplama yanıtı hem finansal sonucu hem de grafiği çizmek için yeterli veriyi içerir.

---

## Karar

**Yaklaşım B (gömülü `priceHistory`) benimsendi.**

`WhatIfResponse`'a `IReadOnlyList<PriceHistoryPoint> PriceHistory` alanı eklendi. Backend, tam fiyat serisinden eşit aralıklı örnekleme yaparak en fazla 60 nokta döner; ilk ve son nokta (alış/satış fiyatları) her zaman dahil edilir.

Cache anahtarı versiyonlandı: `whatif:v2:...` — eski `whatif:...` anahtarları farklı prefix sayesinde manuel flush gerekmeden geçersiz hale geldi.

---

## Gerekçe

### Ekstra Network Round-Trip Yok

Grafik verisi her hesaplamada zaten gerekli. Ayrı bir istek yapmak:
- Kullanıcı grafiği görmeden önce ek bekleme süresi ekler
- Loading state yönetimini karmaşıklaştırır (sonuç geldi ama grafik yükleniyor)
- Hataya ikinci bir yüzey açar

### Veri Zaten Mevcut

Hesaplama için backend `price_points` tablosunu zaten sorgulamaktadır. Aynı sorgu sonucundan örnekleme yapmak marjinal maliyet ekler.

### 60 Nokta Sınırı

Bir mobil grafik için 60 nokta yeterli görsel çözünürlük sağlar. Tam günlük seri binlerce satır olabilir (10 yıl = ~3650 gün). Örnekleme:
- Yanıt boyutunu sabit ve küçük tutar
- İstemci tarafı render performansını artırır
- Cache verimliliğini korur (büyük payload = daha az cache hit)

### Ayrı Endpoint Hangi Durumda Tercih Edilir?

Kullanıcı grafiği sonradan interaktif olarak uzatmak isterse (örn: alış öncesi 3 ay göster) ayrı `price-range` endpoint'i kullanılır. Bu endpoint zaten mevcut ve bu amaca hizmet eder.

---

## Sonuçlar

- Grafik için ekstra network isteği yok
- Sonuç ekranı tek yanıtta eksiksiz render olur
- Cache key versiyonlama kalıbı kuruldu (gelecekteki breaking change'lerde aynı yöntem)
- Backend `SamplePriceHistory` yardımcı metodu eklendi (max 60 nokta, ilk/son dahil)

## İlgili Dosyalar

- `src/Saydin.Services/src/Saydin.Api/Models/Responses/WhatIfResponse.cs`
- `src/Saydin.Services/src/Saydin.Api/Services/WhatIfCalculator.cs`
- `src/Saydin.Client/lib/features/what_if/domain/entities/what_if_result.dart`
- `src/Saydin.Client/lib/features/what_if/data/models/what_if_response_model.dart`
- `src/Saydin.Client/lib/features/what_if/presentation/widgets/result_chart.dart`
