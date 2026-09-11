# Telegram Mini App: с чем клиент открывает сайт и что даёт

> справочник · 2026-09-11 · Telegram открывает адрес с параметрами запуска в хэше, скрипт `telegram-web-app.js` помнит их в sessionStorage; шапка, «назад», настройки, шер и хранилище — методы `Telegram.WebApp` без участия сервера; проверка `initData` нужна только там, где воркер действует от имени пользователя

Используется в `web/telegram.ts`. По официальной документации core.telegram.org/bots/webapps (Bot API 10.1), сверено 2026-09-11; живой прогон — `docs/runbooks/test-in-telegram.md`.

## Запуск

- Адрес мини-аппа задаётся в BotFather (Main Mini App). Клиент открывает его с хэшем `#tgWebAppData=<initData>&tgWebAppVersion=<Bot API>&tgWebAppPlatform=<ios|android|weba|webk|tdesktop|macos>&tgWebAppThemeParams=<json>[&tgWebAppStartParam=<startapp>]`. На web.telegram.org страница живёт в iframe и в DevTools видна целиком.
- Скрипт `https://telegram.org/js/telegram-web-app.js` читает хэш при загрузке и кладёт параметры в `sessionStorage` (`__telegram__initParams`); после перезагрузки без хэша берёт их оттуда. Хэш он не стирает, а `tgWebAppData` — это initData с подписью и `user`: в ссылке, собранной из `location.href`, он утечёт.
- Пока приложение не вызвало `ready()`, клиент держит заглушку (иконка и цвета — BotFather → Configure Mini App); без вызова заглушка уходит по `load` страницы.
- `t.me/<бот>?startapp=<x>` открывает Main Mini App; `x` приходит как `tgWebAppStartParam` в хэше и `initDataUnsafe.start_param`. `t.me/<бот>/<апп>?startapp=<x>&mode=compact` — прямая ссылка на именованное приложение, `compact` — полэкрана.
- Вне клиента (страница с подставным хэшем) скрипт работает: вызовы к клиенту уходят в пустоту без ошибок; без `tgWebAppVersion` версия считается 6.0, и методы новее её пишут warn в консоль и не делают ничего.

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
| `disableVerticalSwipes` | 7.7 | иначе тач вниз при странице в верхнем положении клиент читает как «свернуть» |
| `shareMessage` | 8.0 | заготовка сообщения через Bot API `savePreparedInlineMessage`, нужен сервер |
| `DeviceStorage` | 9.0 | до 5 МБ на устройстве, аналог localStorage |

- `colorScheme` (`light`/`dark`) и событие `themeChanged` — тема клиента; с `prefers-color-scheme` устройства может не совпадать.
- `initDataUnsafe.user.language_code` — язык интерфейса Telegram; с языком устройства может не совпадать.

## initData на сервере

- `initData` — query-string с полем `hash`. Проверка: все поля кроме `hash` сортируются по ключу в строки `key=value` через `\n`; `secret = HMAC_SHA256(bot_token, key = "WebAppData")`; `hash == hex(HMAC_SHA256(data_check_string, secret))`. Свежесть — `auth_date`; срок документация не задаёт, `@tma.js/init-data-node` (есть сборка на Web Crypto для воркера) по умолчанию считает сутки. Вариант без токена бота — поле `signature` (Ed25519, Bot API 8.0) с публичным ключом Telegram.
- `initDataUnsafe` — то же, разобранное на клиенте; документация прямо запрещает доверять ему на сервере.
- Нужна только там, где воркер действует от имени пользователя: пишет ему ботом, принимает оплату звёздами. Сейчас таких мест нет, и токен бота воркеру не выдан.

## Деньги

- Telegram Stars живут только внутри Telegram: бот или мини-апп, вывод через Fragment от 1000 звёзд с выдержкой 21 день, покупки с iOS и Android минус 30 % магазинам.
