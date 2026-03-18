# Fikir: Varlık Başına Ayrı Tarih — Portföy Builder B Seçeneği

## Bağlam

Portföy builder ilk versiyonunda tüm varlıklar için aynı tarih aralığı kullanılıyor
("2020-01-01'de 10.000 TL'yi şu 3 varlığa bölseydim ne olurdu?").

Bu seçenek ise her varlığın kendi alış ve satış tarihine sahip olmasını sağlar.

## Kullanım Senaryosu

> "2018'de aldığım altın, 2020'de aldığım dolar, 2021'de aldığım BTC — bugün
> hepsi toplam ne eder?"

Gerçek yatırımcıların davranışını yansıtır: farklı varlıklar farklı zamanlarda alınır.

## Tasarım Kararları Gerektiren Sorular

- **Satış tarihi:** Her varlık için ayrı satış tarihi mi, yoksa hepsi için tek "bugün" mi?
- **Karşılaştırma:** Farklı dönemler nedeniyle toplam getiri yüzdesi yanıltıcı olabilir
  (5 yıl altında 3x kazanç ile 2 yıl altında 3x kazanç aynı % görünür).
- **UI karmaşıklığı:** Her satırda tarih çifti → form çok kalabalık.

## Olası Çözüm

- Her varlık için alış tarihi zorunlu, satış tarihi opsiyonel (boşsa bugün).
- Sonuç ekranında "net bugünkü değer" göster; getiri yüzdesi yerine TL kazanç/zarar
  ön plana çıkar (dönem farkı nedeniyle % karşılaştırması yanıltıcı olur).
- Alternatif: "yıllık bileşik getiri (CAGR)" hesapla — farklı dönemleri normalize eder.

## Neden Ertelendi

Portföy builder A seçeneği (aynı tarih) önce tamamlandı çünkü:
- "Ya alsaydım?" sorusunun portföy versiyonu için daha tutarlı bir çerçeve sunuyor.
- UI daha sade: tarih seçici bir kez, varlık listesi temiz.
- Mevcut saved_scenarios ekranı zaten farklı tarihlerdeki tekil hesapları saklıyor.

## Bağlantılı Bileşenler

- `lib/features/portfolio/` — mevcut portföy feature
- `POST /v1/what-if/calculate` — her varlık için ayrı istek atılacak
- CAGR hesabı için yeni bir formül gerekebilir (backend veya client-side)
