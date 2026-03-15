# ADR-005: Backend Servisleri Tek Repoda Tutmak (Monorepo)

**Durum:** Kabul Edildi
**Tarih:** 2026-03-15

---

## Bağlam

`Saydin.Api` ve `Saydin.PriceIngestion` servisleri `Saydin.Shared` kütüphanesini paylaşır. Bu yapı tek repoda mı yoksa ayrı repolarda mı tutulmalı?

## Karar

**MVP'de tüm backend servisleri `saydin-services` tek repo altında tutulacak.**

## Gerekçe

Ayrı repolar şu sorunları yaratır:
- `Saydin.Shared` bir NuGet paketi olarak publish edilmeli → versiyonlama karmaşıklığı
- Entity değiştiğinde iki ayrı PR gerekir
- CI/CD her iki repo için ayrı konfigürasyon

Monorepo avantajları:
- `Saydin.Shared` doğrudan `<ProjectReference>` ile referans alınır
- Tek CI pipeline
- Atomik commit (entity + consumer aynı anda değişir)

## Polirepo'ya Geçiş Koşulları

Şu durumlardan biri gerçekleştiğinde servisleri ayrıştırmak değerlendirilir:
- Farklı ekipler ayrı servisler üzerinde çalışmaya başlarsa
- Deploy cadence'leri ayrışırsa (Api her gün, Ingestion haftada bir deploy)
- `Saydin.Shared`'in harici müşterileri oluşursa

## Sonuçlar

- Geliştirici deneyimi basit
- Paylaşılan kod versiyonlama gerektirmez
- Gelecekte ayrıştırma mümkün (backward compatible)
