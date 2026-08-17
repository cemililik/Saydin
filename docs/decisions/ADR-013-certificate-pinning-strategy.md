# ADR-013: Certificate Pinning — Opt-in Leaf-Cert Hash Stratejisi

**Tarih:** 2026-05-28
**Durum:** Kabul Edildi (kısmen aktif — production aktivasyonu beklemede)

## Bağlam

Master Review F-05-03 ve F-14-05 bulguları: Saydın istemci HTTPS üzerinden
backend ile konuşur ama TLS yalnızca sistem trust store ile doğrulanır.
MITM saldırgan bir corporate proxy / captive portal sertifikası ile
araya girebilir (kullanıcı kabul ettiğinde). Finansal "ya alsaydım"
verilerinde bu risk kabul edilemez (KVKK Madde 12).

Klasik iki çözüm:

1. **Leaf certificate pin (SHA-256 DER hash)**: Pinli host'un mevcut TLS
   sertifikasının DER bytes'ının SHA-256 hash'i. Cert yenilenince hash
   değişir → app güncellenmeden bozulur.
2. **SPKI pin (Subject Public Key Info hash)**: Sertifikanın public key
   alanının SHA-256 hash'i. Cert yenilenirken aynı public key tutulursa
   SPKI hash değişmez → cert rotation tolere edilir.

## Karar

**Leaf certificate hash pinleme** uygulandı (`lib/core/network/
certificate_pinning.dart`). Gerekçe:

1. **Implementation maliyeti düşük**: Dio'nun `IOHttpClientAdapter.
   validateCertificate` callback'i DER bytes'ı doğrudan verir. SPKI
   pinleme için ASN.1 parsing gerekir (pointycastle veya benzer paket).
2. **Backup pin zorunlu (en az 2 hash)**: Cert rotation sürecinde
   primary cert hash'i geçersiz hale gelmeden önce backup hash app
   sürümünde bulundurulur — rotation app güncellemeden bozulmaz.
3. **Production'da hâlâ aktive edilmedi**: `--dart-define=PINNED_CERT_SHA256`
   release workflow'unda geçirilmiyor. Altyapı hazır, production
   sertifika hash'i kararlaştığında release.yml'e eklenecek.
4. **Opt-in**: Pin yoksa `CertificatePinning.apply()` no-op; dev ngrok
   ortamı bozulmaz, test cycle hızlı.

## Trade-off — SPKI yerine leaf hash

SPKI pinleme daha sağlam olsa da:
- Saydın production backend AWS / Cloudflare CDN üzerinde değil; cert
  rotation hızı düşük (Let's Encrypt değil, manuel CA).
- App store'da new build yayınlamak ortalama 7 gün sürer; backup pin'le
  birlikte 90 günlük rotation döngüsü ile barışıktır.
- SPKI'ye geçiş ileride şart olursa `validateCertificate` callback'i
  ASN.1 parsing'e genişletilir (kontrat değişmez).

## Aktivasyon Adımları (Production'a alınacağı zaman)

1. Production sertifikanın DER bytes'ından SHA-256 üret:
   ```bash
   openssl x509 -in saydin-prod.pem -outform DER \
     | openssl dgst -sha256
   ```
2. **Backup pin**: Next rotation cert (veya farklı CA chain) hash'ini
   yedek olarak ekle. Toplam 2 hash zorunlu.
3. GitHub Secrets `PINNED_CERT_SHA256` (production environment):
   ```
   hex1,hex2
   ```
4. `release.yml` Android AAB ve iOS IPA build adımlarına:
   ```yaml
   --dart-define=PINNED_CERT_SHA256=${{ secrets.PINNED_CERT_SHA256 }}
   ```
5. Staging environment için ayrı secret tanımla (staging cert farklı
   olabilir).

## Pin Rotasyon Döngüsü

| Adım | Aksiyon | Risk |
|------|---------|------|
| T-90 gün | Yeni cert hazır → backup pin olarak ekle | Düşük (eski pin hâlâ valid) |
| T-0 | Production cert'i swap, eski hash'i primary'den çıkar | Orta (backup pin devreye girer) |
| T+30 | App store new build (yeni primary + new backup) | Düşük |

## İzleme / Bakım

- **Pin mismatch metrigi**: `validateCertificate` false döndüğünde
  Sentry breadcrumb ekle (ileride, F-14-XX kapsamında); ani spike
  cert rotation gecikmesini gösterir.
- **Cert expiry alarmı**: Production cert son 30 gününe girdiğinde
  Slack notify (backend tarafı sorumluluğu).

## Referanslar

- OWASP Mobile Top 10 — M3: Insecure Communication
- RFC 7469 (HTTP Public Key Pinning — deprecated but pattern reference)
- [lib/core/network/certificate_pinning.dart](../../saydin-client/lib/core/network/certificate_pinning.dart)
- [docs/architecture.md — Ağ Katmanı](../../saydin-client/docs/architecture.md#ağ-katmanı)

## Reddedilen Alternatifler

- **dio_certificate_pinning paketi**: Aktif maintain edilmiyor (son commit 2024).
- **Public key pinning (HPKP-style)**: HPKP zaten deprecate, web standardı
  artık CT (Certificate Transparency) — mobile için uygulanabilir değil.
- **No pinning + Network Security Config only**: Manifest-level config
  cleartext'i kapatır ama MITM cert kabul ettirildiğinde devre dışı kalır.
  Code-level pin gerekli.
