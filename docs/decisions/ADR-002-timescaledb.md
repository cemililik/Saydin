# ADR-002: TimescaleDB Kullanımı

**Durum:** Kabul Edildi
**Tarih:** 2026-03-15

---

## Bağlam

Saydın, zaman serisi fiyat verisi depolar. `price_points` tablosu:
- Yaklaşık 10 asset × 365 gün × 10 yıl = ~36.500 satır başlangıç
- BIST genişledikçe ~500 asset × 10 yıl = ~1.825.000 satır
- Tipik sorgu: "Bu asset'in şu tarih aralığındaki fiyatları"

## Karar

**PostgreSQL + TimescaleDB extension kullanılacak.**

## Gerekçe

TimescaleDB:
- PostgreSQL'in bir uzantısıdır; ayrı bir veritabanı sistemi değildir
- Aynı SQL sözdizimi — sıfır öğrenme maliyeti
- `create_hypertable()` çağrısı ile otomatik zaman bazlı partisyonlama
- Zaman aralığı sorgularında ~10x performans artışı
- Docker: `timescale/timescaledb:latest-pg16` resmi image
- Açık kaynak, ücretsiz (ücretli Timescale Cloud ayrıdır)

## Alternatifler

| Seçenek | Neden Reddedildi |
|---------|-----------------|
| Plain PostgreSQL | Büyük veri setlerinde range query yavaşlar |
| InfluxDB | Farklı sorgu dili (Flux), PostgreSQL ekosisteminden kopuş |
| ClickHouse | Aşırı karmaşık, bu ölçek için gereksiz |

## Uygulama

```sql
-- 2 satır — kurulum bu kadar:
CREATE EXTENSION IF NOT EXISTS timescaledb;
SELECT create_hypertable('price_points', 'price_date',
    chunk_time_interval => INTERVAL '1 month');
```

## Sonuçlar

- Operasyonel maliyet: sıfır ek (PostgreSQL ile aynı)
- Mevcut Npgsql/.NET adaptörleri değişmeden çalışır
- Gelecekte Timescale Cloud'a geçiş mümkün
