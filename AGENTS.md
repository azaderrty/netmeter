# NetMeter — стан проєкту та наступні кроки

> Файл пам'яті для продовження роботи в opencode. Оновлювати після кожного етапу.

## Що це
Окремий Android-застосунок **NetMeter** (`com.xsiloflex.netmeter`): тест швидкості,
ping/jitter/loss, публічний IP + провайдер, локальна мережа, інфо про пристрій,
експериментальні інструменти. Не пов'язаний з AirWeather.

- Репозиторій: https://github.com/xsiloflex-cyber/netmeter (public)
- Локально: `/public/netmeter`
- Гілка: `main`. Remote — **SSH** `git@github.com:xsiloflex-cyber/netmeter.git`
  (OAuth-токен gh НЕ має scope `workflow`, тому HTTPS-пуш файлів `.github/workflows/*`
  блокується; використовуємо SSH).
- Технології: Capacitor 6 + ванільний JS (`www/`), Android-проєкт у репо (не `.gitignore`).

## Стан на цей момент
Останній коміт: `158d767` — CI-ран `38942351127` успішний, APK зібрано.

**Опубліковано реліз:** `v1.0.0` (pre-release), тег на `158d767`.
https://github.com/xsiloflex-cyber/netmeter/releases/tag/v1.0.0
Assets: `netmeter-1.0.0-debug.apk` (4 605 688 B, sha256 `a74c9dc8…b2f3`) + `SHA256SUMS.txt`.
Створено командою `gh release create ... --prerelease`. Щоб зробити «latest»:
`gh release edit v1.0.0 --prerelease=false --latest`.


Виконано:
- **Фаза 0 (критично)** — `www/app.js` виправлено: замість ESM bare-імпортів
  використовує `window.Capacitor.Plugins.{Device,Network}` з guard'ами
  (`canUseNative`). Саме це раніше ламало запуск застосунку.
- **Фаза 1** — кастомна іконка застосунку (концепт A: глобус-мережа + «IP»),
  джерело `assets/icon.svg`, генерація через `npm run assets`
  (`@capacitor/assets`, синій фон `#1e3a8a` / dark `#0b1225`). Згенеровано й
  закомічено `mipmap-*` + `drawable*` splash. Старий vector `ic_launcher_foreground.xml`
  і color-background видалено.
- **Фаза 2** — бейдж публічного IP у картці «Мій IP / провайдер»:
  `#ipBadge` / `#ipBadgeValue` + кнопка `#copyIp` («Скопійовано ✓»),
  стилі `.ip-badge` у `www/styles.css`, логіка копіювання в `www/app.js`
  (clipboard API + fallback `execCommand`).
- **Фаза 3** — Quick Settings плитка:
  `android/app/src/main/java/com/xsiloflex/netmeter/IpTileService.java`
  (показує публічний IP як subtitle, по тапу копіює IP і відкриває застосунок;
  Cloudflare `cf-meta-ip` → fallback ipwho.is), іконка `res/drawable/ic_qs_ip.xml`,
  запис у `AndroidManifest.xml` (permission `BIND_QUICK_SETTINGS_TILE`),
  `MainActivity.onResume()` викликає `TileService.requestListeningState` (API>=24).
- **Прибирання** — додано `.gitignore`; `node_modules/` (85 МБ) і згенеровані
  `android/app/src/main/assets/public/*` більше НЕ трекаються.

Готові APK (перевірені вмістом: іконки, `ic_qs_ip`, `IpTileService` у dex,
`app.js` без ESM, `ip-badge` в HTML):
- `/sdcard/Download/netmeter-1.0.0-debug.apk`
- `/sdcard/Download/netmeter-latest-debug.apk`

Підпис: debug-PKCS12 `signing/netmeter.keystore` (alias `netmeter`, пароль `android`).
CI інжектить підпис через `-Pandroid.injected.signing.*`.

## Ключові факти про середовище
- Оболонка Acode-пісочниця (Android), busybox; **немає** JDK/gradle/adb/ImageMagick/rsvg.
  Node 22 + npm є. `openssl` є. `python3` НЕМАЄ.
- Збірка APK — ЛИШЕ через GitHub Actions (workflow `Build APK`, тригер на push у `main`).
  Локально лише `npm install`, `npx cap sync android`, `node --check`.
- Встановлення APK — вручну користувачем (pm/am для цього uid заблоковані).
- Робоча директорія зазвичай `/public`, але проєкт у `/public/netmeter`.

## Наступні кроки (не зроблено)
1. **Нативний плагін `plugins/localnet`** (головна наступна задача) для картки
   «Локальна мережа» та інструментів:
   - локальні IPv4/IPv6, список інтерфейсів (`NetworkInterface`);
   - шлюз + DNS (`ConnectivityManager.getLinkProperties`);
   - TCP-перевірка порту (`Socket`);
   - Wi‑Fi RSSI (`WifiManager`) — best-effort;
   - traceroute — best-effort.
   Підключити як `file:./plugins/localnet`, `cap sync`, заповнити в `www/app.js`
   елементи `#localIP`, `#gateway`, `#dns`, `#ifaces` та кнопки
   `#portCheck`, `#wifiBtn`, `#traceBtn` (зараз заглушки).
   Для Wi‑Fi RSSI можуть знадобитись дозволи `ACCESS_NETWORK_STATE` /
   `ACCESS_WIFI_STATE` (+ runtime для `NEARBY_WIFI_DEVICES` на Android 13+).
2. Перевірити на пристрої: бейдж, живі дані (IP/ISP/пристрій), тест швидкості,
   QS-плитку (додати вручну: «Редагувати плитки» → NetMeter).
3. Опційно: release-підпис, PWA-манифест, README.
4. Борг/ідеї: `loss` завжди 0.0 (заглушка), індикатор джерела ping (CF), IPv6
   `api6.ipify.org` може бути недоступним у мережі.

## Дані/ендпоінти (без API-ключів, CORS `*`)
- Download: `https://speed.cloudflare.com/__down?bytes=N`
- Upload: `https://speed.cloudflare.com/__up` (POST)
- Публічний IP/ASN/geo: заголовки відповіді `cf-meta-*`
  (`https://speed.cloudflare.com/meta` JSON — 403, НЕ використовувати)
- Провайдер/geo: `https://ipwho.is/?fields=ip,connection,country,city,timezone,latitude,longitude`
- IPv6: `https://api6.ipify.org?format=json` (може бути недоступним → «недоступний»)
- DNS lookup (UI): Cloudflare DoH `https://cloudflare-dns.com/dns-query?name=X&type=A`
  з `Accept: application/dns-json`

## Команди
```sh
cd /public/netmeter
npm install
npx cap sync android
node --check www/app.js
npm run assets                 # регенерувати іконки/сплеші
git add -A && git commit -m "..." && git push origin main
gh run list --repo xsiloflex-cyber/netmeter --limit 3
gh run download <RUN_ID> --repo xsiloflex-cyber/netmeter --name netmeter-debug-apk -D /tmp/x
```

## Пристрій (де все запускається)
- Lenovo **TB310FU** (Lenovo Tab M11, Wi‑Fi), SoC MediaTek **MT8786V/N** (Helio G88:
  6×A55@1.8 + 2×A75@2.0), ~4 ГБ RAM, Android **13** (SDK 33), arm64‑v8a.
- Bootloader **заблокований** (`ro.boot.flash.locked=1`, verified boot = green).
- Читати Android-властивості можна через `/system/bin/getprop` (він є, попри те що
  `getprop` немає в PATH).
- **Ubuntu Touch** для цієї моделі НЕ підтримується (немає в UBports, немає Halium-порту,
  MediaTek, locked bootloader). Реальна альтернатива — Ubuntu в proot (Termux +
  proot-distro), без root/GPU; або GSI (ризиковано). postmarketOS — не підтримується.
