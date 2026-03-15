# Saydın Veritabanı Şeması

## Teknoloji Seçimi

**PostgreSQL + TimescaleDB** kullanılmaktadır.

TimescaleDB, PostgreSQL üzerine kurulu bir uzantıdır. Aynı SQL sözdizimini kullanır, ayrı bir veritabanı sistemi gerektirmez. Zaman serisi verilerinde otomatik partisyonlama (hypertable) ile ~10x daha hızlı range query sağlar.

Detay: [ADR-002](../decisions/ADR-002-timescaledb.md)

---

## Tam Şema

```sql
-- ============================================================
-- UZANTILAR
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- ENUM'LAR
-- ============================================================

CREATE TYPE asset_category AS ENUM (
    'currency',         -- USD/TRY, EUR/TRY
    'precious_metal',   -- Altın, Gümüş
    'stock',            -- BIST hisseleri
    'crypto'            -- BTC, ETH vb.
);

-- ============================================================
-- ASSETS — Desteklenen Tüm Finansal Varlıklar
-- ============================================================

CREATE TABLE assets (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol        VARCHAR(20)   NOT NULL UNIQUE,
    -- Örnekler: 'USDTRY', 'XAU_TRY_GRAM', 'BTC', 'THYAO'
    display_name  VARCHAR(100)  NOT NULL,
    -- Örnekler: 'Dolar/TL', 'Altın (Gram/TL)', 'Bitcoin'
    category      asset_category NOT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    source        VARCHAR(50)   NOT NULL,
    -- Değerler: 'tcmb', 'coingecko', 'goldapi', 'twelvedata'
    source_id     VARCHAR(100),
    -- Dış API'nin kendi tanımlayıcısı
    -- Örnekler: 'TP.DK.USD.A' (TCMB), 'bitcoin' (CoinGecko)
    metadata      JSONB,
    -- Esnek alan: minimum_amount, display_unit, decimal_places vb.
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed verisi (migration'da doldurulacak):
-- ('USDTRY', 'Dolar/TL', 'currency', 'tcmb', 'TP.DK.USD.A')
-- ('EURTRY', 'Euro/TL', 'currency', 'tcmb', 'TP.DK.EUR.A')
-- ('XAU_TRY_GRAM', 'Altın (Gram/TL)', 'precious_metal', 'goldapi', 'XAU')
-- ('XAG_TRY_GRAM', 'Gümüş (Gram/TL)', 'precious_metal', 'goldapi', 'XAG')
-- ('BTC', 'Bitcoin', 'crypto', 'coingecko', 'bitcoin')
-- ('ETH', 'Ethereum', 'crypto', 'coingecko', 'ethereum')
-- ('THYAO', 'Türk Hava Yolları', 'stock', 'twelvedata', 'THYAO:BIST')
-- ('GARAN', 'Garanti Bankası', 'stock', 'twelvedata', 'GARAN:BIST')

-- ============================================================
-- PRICE_POINTS — Günlük Fiyat Verisi (TimescaleDB Hypertable)
-- ============================================================

CREATE TABLE price_points (
    asset_id      UUID          NOT NULL REFERENCES assets(id),
    price_date    DATE          NOT NULL,
    open          NUMERIC(18,6),
    high          NUMERIC(18,6),
    low           NUMERIC(18,6),
    close         NUMERIC(18,6) NOT NULL,
    -- 'close' değeri tüm "ya alsaydım" hesaplamalarında kullanılır
    volume        NUMERIC(24,4),
    -- Hisse/kripto için geçerli, forex için NULL
    source_raw    JSONB,
    -- Ham API yanıtı: hata ayıklama ve veri kalitesi kontrolü için saklanır
    ingested_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    PRIMARY KEY (asset_id, price_date)
);

-- TimescaleDB hypertable: 1 aylık chunk'lar
SELECT create_hypertable(
    'price_points',
    'price_date',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- ÖNEMLİ: Tüm fiyat değerleri NUMERIC(18,6) tipindedir.
-- Float veya double KULLANILMAZ. Finansal hesaplamalar tam sayısal aritmetik gerektirir.

-- Birincil sorgu indeksi: "USDTRY'nin 2020-01-01 fiyatı ne?"
CREATE INDEX idx_price_points_asset_date
    ON price_points (asset_id, price_date DESC);

-- ============================================================
-- INGESTION_JOBS — Veri Çekme İşlemi Takibi
-- ============================================================

CREATE TABLE ingestion_jobs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id          UUID        NOT NULL REFERENCES assets(id),
    job_type          VARCHAR(50) NOT NULL,
    -- Değerler: 'historical_backfill', 'daily_update'
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at       TIMESTAMPTZ,
    status            VARCHAR(20) NOT NULL DEFAULT 'running',
    -- Değerler: 'running', 'success', 'failed'
    records_upserted  INT,
    error_message     TEXT,
    date_range_start  DATE,
    date_range_end    DATE
);

-- ============================================================
-- USERS — Kullanıcı Hesapları
-- ============================================================

CREATE TABLE users (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id     VARCHAR(200)  UNIQUE,
    -- MVP: anonim cihaz tabanlı auth. Kayıt gerektirmez.
    email         VARCHAR(200)  UNIQUE,
    -- Phase 2: e-posta ile kayıt olunca doldurulur
    tier          VARCHAR(20)   NOT NULL DEFAULT 'free',
    -- Değerler: 'free', 'premium'
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ
);

-- ============================================================
-- SAVED_SCENARIOS — Kullanıcının Kayıtlı Senaryoları
-- ============================================================

CREATE TABLE saved_scenarios (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id       UUID          NOT NULL REFERENCES assets(id),
    buy_date       DATE          NOT NULL,
    sell_date      DATE,
    -- NULL = "bugüne kadar"
    quantity       NUMERIC(18,8) NOT NULL,
    quantity_unit  VARCHAR(20)   NOT NULL,
    -- Değerler: 'try' (TL tutarı), 'units' (birim), 'grams'
    label          VARCHAR(200),
    -- Kullanıcının kendi notu: "2020 dolar alımlı ne olurdu"
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Uygulama katmanında zorunlu:
-- free tier: kullanıcı başına max 5 senaryo
-- premium tier: sınırsız

-- ============================================================
-- MARKET_HOLIDAYS — Piyasa Tatil Günleri
-- ============================================================

CREATE TABLE market_holidays (
    asset_id      UUID  NOT NULL REFERENCES assets(id),
    holiday_date  DATE  NOT NULL,
    reason        VARCHAR(200),
    PRIMARY KEY (asset_id, holiday_date)
);
-- Veri çekme worker'ı bu tabloyu kontrol ederek
-- tatil günlerini "eksik veri" olarak saymaz.
```

---

## Tasarım Kararları

### NUMERIC(18,6) — Float Kullanılmaz
Finansal değerlerde kayan noktalı aritmetik kullanmak yuvarlama hatalarına yol açar. `NUMERIC` tipi tam ondalık hassasiyet sağlar.

### `close` Kanonik Fiyat
"Ya alsaydım?" hesaplamalarında endüstri standardı kapanış fiyatıdır. `open`, `high`, `low` grafik gösterimi için saklanır.

### `source_raw JSONB`
Ham API yanıtı saklanır. Böylece veri kalitesi sorununuz olduğunda API'yi tekrar çağırmadan mevcut veriyi yeniden işleyebilirsiniz.

### Günlük Granülarite
Gün içi (intraday) veri API maliyetini ~1000x artırır ve "2020'de alsaydım" gibi uzun vadeli senaryolar için gerekli değildir. Detay: [ADR-003](../decisions/ADR-003-daily-granularity.md)

### Cihaz Tabanlı Auth
Kayıt olmadan anlık değer — kullanıcı friction'ı minimize edilir. Detay: [ADR-004](../decisions/ADR-004-device-id-auth.md)
