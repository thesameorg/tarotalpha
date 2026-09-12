# Сайт внутри Telegram

> актуально · 2026-09-12 · мини-апп — тот же сайт, `web/telegram.ts` включается по хэшу запуска; шапка, «назад», настройки, шер и хранилище — методы `Telegram.WebApp` без участия сервера; продовый бот открывает прод, тестовый — превью-версию ветки, которая пишет в ту же D1

Используется в `web/telegram.ts`. Факты — по документации core.telegram.org/bots/webapps (Bot API 10.1), сверено 2026-09-11.

## Запуск

- Адрес задаётся в BotFather (Main Mini App). Клиент открывает его с хэшем `#tgWebAppData=<initData>&tgWebAppVersion=<Bot API>&tgWebAppPlatform=<ios|android|weba|webk|tdesktop|macos>&tgWebAppThemeParams=<json>[&tgWebAppStartParam=<startapp>]`.
- Скрипт `https://telegram.org/js/telegram-web-app.js` читает хэш при загрузке и кладёт параметры в `sessionStorage` (`__telegram__initParams`); после перезагрузки без хэша берёт их оттуда. Хэш он не стирает, а `tgWebAppData` — это initData с подписью и `user`: в ссылке, собранной из `location.href`, он утечёт.
- Пока приложение не вызвало `ready()`, клиент держит заглушку (иконка и цвета — BotFather → Configure Mini App); без вызова заглушка уходит по `load` страницы.
- `t.me/<бот>?startapp=<x>` открывает Main Mini App; `x` приходит как `start_param` внутри initData всегда, а как `tgWebAppStartParam` в хэше — не у всех клиентов: web.telegram.org/k кладёт его только в initData (проверено 2026-09-11). Перед открытием по ссылке клиент спрашивает «To launch this web app, you will connect to its website».
- Вне клиента скрипт работает: вызовы уходят в пустоту без ошибок; без `tgWebAppVersion` версия считается 6.0, и методы новее пишут warn в консоль и ничего не делают.

## Что даёт клиент и с какой версии

| Что | Bot API | Заметка |
| --- | --- | --- |
| `BackButton` | 6.1 | стрелка в шапке клиента; без неё «назад» на телефоне закрывает мини-апп |
| `setHeaderColor`, `setBackgroundColor` | 6.1 | `#RRGGBB` или `bg_color`/`secondary_bg_color` из темы клиента |
| `openTelegramLink("https://t.me/share/url?url=…&text=…")` | 6.1 | диалог «отправить» с превью по OG-тегам ссылки; мини-апп не закрывается |
| `openLink(url)` | 6.4 | внешний браузер; `target="_blank"` внутри webview не гарантирован |
| `CloudStorage` | 6.9 | 1024 ключа на пару «пользователь + бот», ключ 1–128 символов `[A-Za-z0-9_-]`, значение до 4096 символов; серверу не нужен |
| `requestWriteAccess` | 6.9 | разрешение боту писать пользователю первым |
| `SettingsButton` | 7.0 | пункт Settings в меню ⋮ клиента |
| `disableVerticalSwipes` | 7.7 | иначе жест вниз по графику при странице в верхнем положении клиент читает как «свернуть» (проверено на телефоне 2026-09-11) |
| `shareMessage` | 8.0 | заготовка сообщения через Bot API `savePreparedInlineMessage`, нужен сервер |
| `DeviceStorage` | 9.0 | до 5 МБ на устройстве, аналог localStorage |

`colorScheme` (`light`/`dark`) и событие `themeChanged` — тема клиента, с темой устройства может не совпадать; `initDataUnsafe.user.language_code` — язык интерфейса Telegram, с языком устройства может не совпадать.

## initData на сервере

- `initData` — query-string с полем `hash`. Проверка: все поля, кроме `hash`, сортируются по ключу в строки `key=value` через `\n`; `secret = HMAC_SHA256(bot_token, key = "WebAppData")`; `hash == hex(HMAC_SHA256(data_check_string, secret))`. Свежесть — `auth_date`; срок документация не задаёт, `@tma.js/init-data-node` (есть сборка на Web Crypto для воркера) по умолчанию считает сутки. Без токена бота — поле `signature` (Ed25519, Bot API 8.0) и публичный ключ Telegram.
- `initDataUnsafe` — то же, разобранное на клиенте; документация прямо запрещает доверять ему на сервере.
- Проверка нужна только там, где воркер действует от имени пользователя: пишет ему ботом, принимает оплату звёздами. Таких мест нет, и токена бота у воркера нет: клиент говорит с Telegram сам.
- Telegram Stars живут только внутри Telegram: бот или мини-апп, вывод через Fragment от 1000 звёзд с выдержкой 21 день, покупки с iOS и Android минус 30 % магазинам.

## Проверить руками

**Боты, один раз.** `@BotFather` → `/newbot` → Bot Settings → Configure Mini App → Enable Mini App, адрес `https://tarotalpha.dksg87.workers.dev/`; там же иконка и цвета заглушки. Второй бот так же, с адресом `https://tg-tarotalpha.dksg87.workers.dev/` — превью-версия ветки.

**Ветка в тестовом боте.**

1. `pnpm run deploy:tg` — `vite build`, затем `wrangler versions upload --preview-alias tg`: версия не становится продом, живёт на `tg-tarotalpha.dksg87.workers.dev` и пишет в продовую D1.
2. web.telegram.org под дополнительным аккаунтом → тестовый бот → «Open App»; дип-линк — `t.me/<тестовый бот>?startapp=<id расклада>`. Мини-апп живёт в iframe, DevTools показывают его целиком, ошибки скрипта — в консоли этого фрейма.
3. Телефон: тот же бот в мобильном клиенте; закрывается крестиком клиента.

**Без Telegram.** `http://localhost:5173/#tgWebAppData=x&tgWebAppPlatform=web&tgWebAppVersion=9.0&tgWebAppThemeParams=%7B%22bg_color%22%3A%22%23161824%22%7D` — скрипт грузится, сайт считает себя мини-аппом: переключатели ушли из шапки, вызовы к клиенту уходят в пустоту. Без `tgWebAppData` запуск не засчитывается, чтобы случайный хэш не прятал шапку; `bg_color` задаёт `colorScheme` (тёмный фон — тёмная тема), без него скрипт считает тему светлой. `&tgWebAppStartParam=<id>` в том же хэше проверяет дип-линк. `sessionStorage` помнит запуск до закрытия вкладки.
