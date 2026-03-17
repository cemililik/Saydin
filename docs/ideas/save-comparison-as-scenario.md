# Fikir: Karşılaştırmaları Senaryo Olarak Kaydetme

## Özet

Kullanıcıların "Ya Alsaydım?" hesaplamalarını kaydedebildiği gibi, varlık karşılaştırma sonuçlarını da senaryo olarak kaydedebilmesi.

## Motivasyon

- Karşılaştırma kurulumu zahmetli (2-5 varlık + tarih + tutar) — kullanıcı bunu kaydedip tekrar görmek isteyebilir.
- "2020'de hangisi daha kazandırdı?" gibi referans noktaları oluşturulabilir.
- Mevcut senaryo kaydetme alışkanlığıyla tutarlı bir deneyim sunar.

## Tasarım Kararları

### Backend

`saved_scenarios` tablosuna iki alan eklenir:

```sql
ALTER TABLE saved_scenarios
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'what_if',
  -- 'what_if' | 'compare'
  ADD COLUMN extra_data JSONB;
  -- Karşılaştırma için: { "symbols": [...], "results": [...] }
```

- Tek tablo, iki tip — yeni tablo açmaya gerek yok.
- `asset_symbol` ve `amount` alanları `what_if` tipi için dolu kalır; `compare` tipinde `extra_data` içinde tüm veri tutulur.
- Mevcut endpoint'ler kırılmaz; yeni `type` alanı default değerle geriye uyumlu.

### Flutter — Senaryo Kartı Ayrımı

Her kart sol üstte küçük bir badge ile tip belirtilir:

| Tip | Badge | Leading Icon |
|---|---|---|
| Hesaplama | `Hesaplama` (nötr renk) | `Icons.calculate` |
| Karşılaştırma | `Karşılaştırma` (vurgu renk) | `Icons.compare_arrows` |

Karşılaştırma kartı özet olarak şunu gösterir:
- Kazanan varlık (🥇 simgesiyle)
- Karşılaştırılan varlık sayısı ("3 varlık")
- Tarih aralığı ve getiri yüzdesi

Örnek görünüm:
```
[compare_arrows]  [Karşılaştırma badge]
🥇 Altın          01.01.2020 → 01.01.2023
3 varlık          +%312.4
```

### Flutter — Domain Değişiklikleri

- `SavedScenario` entity'sine `type` ve `extraData` alanları eklenir.
- `ScenarioCard` widget'ı tip bazlı render yapar.
- `ScenariosBloc`'a `ComparisonSaveRequested` event'i eklenir.

## Öncelik

**Faz 2** — Mevcut özellikler stabilize olduktan sonra.

Önce tamamlanması gerekenler:
1. Enflasyon düzeltmesi
2. Görsel paylaşma
3. Portföy simülatörü
