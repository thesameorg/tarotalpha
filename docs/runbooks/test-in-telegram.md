# Проверить сайт внутри Telegram

> актуально · 2026-09-11 · продовый бот открывает `tarotalpha.dksg87.workers.dev`, тестовый — превью-версию ветки на `tg-tarotalpha.dksg87.workers.dev`; гонять в web.telegram.org под дополнительным аккаунтом; превью пишет в ту же D1, что и прод

Мини-апп — тот же сайт: `web/telegram.ts` включается по хэшу запуска. Что клиент даёт и с какой версии — `docs/reference/telegram-mini-app.md`.

## Один раз: боты

1. `@BotFather` → `/newbot` → Bot Settings → Configure Mini App → Enable Mini App, адрес `https://tarotalpha.dksg87.workers.dev/`. Там же иконка и цвета заглушки на светлую и тёмную тему.
2. Второй бот так же, адрес `https://tg-tarotalpha.dksg87.workers.dev/` — превью-версия из ветки.
3. Токены воркеру не нужны: клиент говорит с Telegram сам, сервер пользователя не знает.

## Ветка в тестовом боте

1. `pnpm run deploy:tg` — `vite build`, затем `wrangler versions upload --preview-alias tg`: версия не становится продом, но живёт на `tg-tarotalpha.dksg87.workers.dev` и ходит в продовую D1 (`docs/adr/0001-cloudflare-worker-d1.md`).
2. В web.telegram.org под дополнительным аккаунтом открыть тестового бота → «Open App»; для дип-линка — `t.me/<тестовый бот>?startapp=<id расклада>`. Мини-апп в iframe, DevTools показывают его целиком, ошибки скрипта — в консоли этого фрейма.
3. Телефон: тот же бот в мобильном клиенте. Свайпы вниз выключены (`disableVerticalSwipes()` в `web/telegram.ts`): без этого жест по графику при странице в верхнем положении сворачивал мини-апп, проверено на телефоне владельца 2026-09-11; закрывается крестиком клиента.

## Без Telegram

`http://localhost:5173/#tgWebAppData=x&tgWebAppPlatform=web&tgWebAppVersion=9.0&tgWebAppThemeParams=%7B%22bg_color%22%3A%22%23161824%22%7D` — скрипт грузится, сайт считает себя мини-аппом: переключатели ушли из шапки, вызовы к клиенту уходят в пустоту. Без `tgWebAppData` запуск не засчитывается — так случайно набранный хэш не прячет шапку; `bg_color` задаёт `colorScheme` (тёмный фон — тёмная), без него скрипт считает тему светлой. `&tgWebAppStartParam=<id>` в том же хэше проверяет дип-линк. `sessionStorage` помнит запуск до закрытия вкладки — обычный сайт снова в новой вкладке.
