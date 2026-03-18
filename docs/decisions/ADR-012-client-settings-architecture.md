# ADR-012: Client Ayarlar Altyapısı ve Tema Yönetimi

**Tarih:** 2026-03-18
**Durum:** Kabul Edildi

## Bağlam

Uygulama şu anda sadece light tema destekliyor ve kullanıcı tercihleri için herhangi bir lokal depolama mekanizması yok. Dark mode desteği eklenmesi gerekiyor (Faz 1.2). Ayrıca ileride gelecek ayarlar (bildirim tercihleri, haptic feedback, dil seçimi vb.) için genişletilebilir bir altyapı gerekiyor.

## Karar

### Depolama: SharedPreferences

Kullanıcı tercihlerini **SharedPreferences** ile cihaz lokalinde saklıyoruz.

- **Neden SharedPreferences?** Basit key-value yeterli. Hive/SQLite gibi çözümler bu aşamada overkill.
- **Neden lokal?** Tema gibi ayarlar cihaza özel — bir kullanıcı telefonunda dark, tablette light isteyebilir. Sunucu senkronizasyonu gereksiz.
- **Gelecek:** Faz 3-4'te sunucu tarafı gereken ayarlar (bildirim tercihleri vb.) olursa, `SettingsRepository` interface'i arkasında backend implementasyonu eklenir. Mevcut kod değişmez.

### Mimari: Clean Architecture Feature

Mevcut proje yapısına uygun olarak `features/settings/` altında Clean Architecture katmanları:

```
features/settings/
├── data/repositories/settings_repository_impl.dart   ← SharedPreferences
├── domain/
│   ├── entities/app_settings.dart                    ← Immutable, copyWith
│   └── repositories/settings_repository.dart         ← Abstract interface
└── presentation/
    ├── cubit/settings_cubit.dart                     ← Global state (LazySingleton)
    ├── pages/settings_page.dart
    └── widgets/theme_selector_tile.dart
```

### State: SettingsCubit (LazySingleton)

- **Cubit, BLoC değil:** Ayar değişikliği basit bir setter, event/handler pattern gereksiz.
- **LazySingleton:** Tüm uygulamadan tek instance'a erişilmeli (tema MaterialApp seviyesinde).
- **AppSettings entity:** Yeni ayar eklemek = 1 field + 1 widget. `copyWith` ile immutable güncelleme.

### Tema: Flutter Native ThemeMode

- `MaterialApp`'te `theme` (light), `darkTheme` (dark) ve `themeMode` parametreleri kullanılır.
- `AppColors` sınıfı her iki tema için uygun renkler sağlar.
- Seçenekler: Açık / Koyu / Sistem (varsayılan: Sistem).

### Erişim: AppBar Gear Icon → Settings Page

- Bottom navigation'a yeni tab eklemek UX'i bozar (4 tab ideal).
- Sağ üst köşede gear icon, `Navigator.push` ile settings sayfasına gider.

## Alternatifler

| Alternatif | Neden Reddedildi |
|------------|-----------------|
| Hive | Basit key-value için fazla karmaşık, SharedPreferences yeterli |
| Sunucu tarafı ayarlar | Tema gibi cihaza özel tercihler için gereksiz network maliyeti |
| Bottom nav'a 5. tab | 4 tab ideal, ayarlar ana özellik değil |
| Provider/ValueNotifier | Proje BLoC/Cubit kullanıyor, tutarlılık için Cubit |

## Sonuçlar

- SharedPreferences paketi eklenir (`shared_preferences`)
- Yeni `features/settings/` feature oluşturulur
- `SettingsCubit` DI'a LazySingleton olarak kaydedilir
- `MaterialApp` tema bilgisini `SettingsCubit` state'inden alır
- Gelecek ayarlar `AppSettings` entity'sine field ekleyerek genişletilir
