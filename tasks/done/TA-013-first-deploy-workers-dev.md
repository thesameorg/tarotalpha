# TA-013 · Первый деплой на workers.dev

> ветка: feat/prototype · PR: https://github.com/thesameorg/tarotalpha/pull/1 · выполнено руками 2026-09-10, база и первый деплой на месте

**Зачем.** Прототип собирается и ходит в биржу локально, но снаружи его не видно, а гейт «вижу», лимит CPU и геоблок Binance из колокаций проверяются только живым адресом. Домена нет и не нужно: `workers.dev` хватает.

**Что меняется.** У прототипа появляется публичный адрес; в аккаунте владельца создаётся D1.

**DoD.** `npm run deploy` проходит с чистой машины по runbook в `docs/runbooks/`; ссылка на расклад открывается снаружи с проверкой пророчества; `cpuTime` в логах Workers на `POST /api/readings` названо в PR.

**Как чиню.** Аккаунт `Dksg87@gmail.com's Account`, `account_id` прибит в `wrangler.jsonc`: `wrangler d1 create tarotalpha`, id в конфиг, `wrangler d1 migrations apply --remote`, `npm run deploy`. Каждый шаг — строка runbook.

**Разрешение.** Владелец дал «да» на D1 и деплой 2026-09-10, с указанием аккаунта.

**Ждёт.** TA-011.
