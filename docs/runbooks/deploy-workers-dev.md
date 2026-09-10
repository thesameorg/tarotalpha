# Выкатить на workers.dev

> актуально · 2026-09-10 · деплой идёт с машины разработчика в аккаунт, прибитый `account_id` в `wrangler.jsonc`; из ресурсов в аккаунте только D1

Первый раз, один раз:

1. `wrangler whoami` — в списке должен быть аккаунт `Dksg87@gmail.com's Account`, а в правах токена `d1 (write)`. Нет прав — `wrangler login` заново.
2. `npx wrangler d1 create tarotalpha` — команда печатает `database_id`; вписать его в `wrangler.jsonc` вместо `TODO-create-with-wrangler-d1-create`.
3. `npx wrangler d1 migrations apply tarotalpha --remote` — схема в облачную D1.

Каждый деплой:

1. `npm run deploy` — `vite build`, затем `wrangler deploy` по собранному конфигу; в конце печатает адрес `https://tarotalpha.<subdomain>.workers.dev`.
2. Проверить снаружи: `curl https://<адрес>/api/health` → `{"ok":true,"engine":"v1"}`; открыть `/?asset=BTCUSDT`, открыть шаг, нажать «Поделиться», открыть ссылку в другом окне.
3. Новая миграция в `migrations/` — сначала `wrangler d1 migrations apply tarotalpha --remote`, потом деплой; воркер со старой схемой на новой миграции не падает, а вот наоборот — падает.

Откат: `npx wrangler rollback` возвращает предыдущую версию воркера; схему D1 назад не откатывают, миграции пишут только добавляющими.

Замер CPU после деплоя — в панели Workers → Observability, поле `cpuTime` у `POST /api/readings`; на бесплатном тарифе лимит 10 мс, ожидание — меньше миллисекунды.
