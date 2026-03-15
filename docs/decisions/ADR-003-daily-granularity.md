# ADR-003: Günlük Fiyat Granülaritesi

**Durum:** Kabul Edildi
**Tarih:** 2026-03-15

---

## Bağlam

Finansal veri API'leri genellikle şu granülariyelerde veri sunar:
- Tick (her işlem)
- Dakikalık (1m, 5m, 15m)
- Saatlik
- Günlük (OHLCV)

Saydın'ın temel kullanım senaryosu: "2020 başında alsaydım ne olurdu?"

## Karar

**MVP'de günlük (daily) granülarite kullanılacak.**

## Gerekçe

| Kriter | Günlük | Saatlik | Dakikalık |
|--------|--------|---------|-----------|
| "Ne olurdu" sorusunu yanıtlıyor mu? | ✓ | ✓ | ✓ |
| API maliyeti (free tier) | 0 | Yüksek | Çok yüksek |
| Depolama (10 asset, 10 yıl) | ~36.500 satır | ~876.000 satır | ~52M satır |
| Backfill süresi | Dakikalar | Saatler | Günler |

Uzun vadeli "ya alsaydım?" senaryoları için gün içi hassasiyet anlamsızdır. "2020 Mart'ında dolar alsaydım" sorusu kapanış fiyatıyla eksiksiz yanıtlanır.

## Günlük Granülariteye Geçiş

Premium kullanıcılar için kısa vadeli işlem analizi gerektiğinde (örn: "sabah 10'da alsaydım öğlen 12'de satsaydım"):
- Twelve Data ve CoinGecko saatlik veriyi freemium sunar
- Ayrı bir `intraday_price_points` tablosu eklenir
- Mevcut şema değişmez

## Sonuçlar

- Free tier API limitleri içinde kalınır
- Tarihi backfill hızlı tamamlanır
- Depolama maliyeti minimum
