# ADR-004: MVP'de Cihaz Kimliği (Device ID) Tabanlı Auth

**Durum:** Kabul Edildi
**Tarih:** 2026-03-15

---

## Bağlam

Kullanıcı deneyimi açısından kritik soru: Uygulama ilk açılışında kayıt / giriş ekranı gösterilmeli mi?

## Karar

**MVP'de e-posta/şifre kaydı zorunlu olmayacak. Cihaz UUID'si ile anonim kimlik kullanılacak.**

## Uygulama

```
Flutter: FlutterSecureStorage ile UUID oluşturulur ve cihaza kaydedilir.
HTTP Header: X-Device-ID: <uuid>
Backend: Bu header'dan users tablosunda kayıt bulunur veya oluşturulur.
```

## Gerekçe

Kayıt friction'ı dönüşüm oranını ciddi ölçüde düşürür. Saydın'ın değer önerisi anında ve kayıtsız sunulabilir:

1. Uygulama açılır
2. Kullanıcı hemen hesap yapar
3. Senaryo kaydeder (cihaz UUID'si ile ilişkilendirilir)

E-posta kaydı yalnızca premium ödeme aşamasında gereklidir.

## Riskleri

| Risk | Mitigation |
|------|------------|
| Cihaz değiştirilirse veri kaybolur | Phase 2: opsiyonel e-posta ile veri aktarımı |
| UUID tahmin edilebilir | `SecureRandom.uuid()` — tahmin edilemez |
| Senaryo limiti aşımı riski | Uygulama katmanında `users` tablosundan sayılır |

## Phase 2 Geçişi

`users.email` alanı NULL olarak başlar. Kullanıcı premium'a geçerken e-posta bağlar. Mevcut `device_id` bağlantısı korunur, veri kaybı olmaz.

## Sonuçlar

- Sıfır kayıt friction
- Anında değer
- Phase 2'de e-posta auth eklenmesi backward compatible
