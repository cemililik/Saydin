# ADR-001: MVP'de Kafka Kullanılmaması

**Durum:** Kabul Edildi
**Tarih:** 2026-03-15

---

## Bağlam

Saydın'ın veri akışı:
1. `PriceIngestion` servisi günlük olarak dış finansal API'lerden fiyat çeker
2. `Api` servisi bu fiyatları okuyarak hesaplama yapar

Bu yapıda Kafka, mesaj kuyruğu olarak değerlendirilebilirdi.

## Karar

**Kafka MVP'de kullanılmayacak.**

## Gerekçe

| Kafka ile | Kafka olmadan |
|-----------|---------------|
| ZooKeeper/KRaft kurulumu | Docker Compose'da sadece PostgreSQL + Redis |
| Consumer group yönetimi | Zamanlanmış background worker (.NET `IHostedService`) |
| Schema registry | Yok |
| Monitoring (Kafdrop/AKHQ) | Yok |

MVP için:
- **1 producer** (PriceIngestion)
- **0 consumer** (Api doğrudan veritabanından okur)

1 producer'lı sistemde mesaj kuyruğu katmanı gereksizdir. Aynı sonuç PostgreSQL tablosu ile elde edilir.

## Kafka Ne Zaman Eklenir?

`Saydin.Notification` servisi hayata geçtiğinde:
- "USD/TRY 35 TL geçti, bildirim gönder" gibi fiyat event'leri
- Birden fazla subscriber (notification, portfolio recalculation)

Bu ihtiyaç ortaya çıktığında Kafka veya Azure Service Bus değerlendirilecek, bir ADR ile belgelenecektir.

## Sonuçlar

- Operasyonel karmaşıklık düşük
- Geliştirici deneyimi basit
- Gelecekte eklenmesi mümkün (backward compatible)
