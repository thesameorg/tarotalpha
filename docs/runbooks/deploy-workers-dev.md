# Выкатить на workers.dev

> актуально · 2026-09-10 · обычный путь — мерж в `main`: Actions прогоняет проверки, применяет миграции D1 и деплоит; руками с машины деплоят только аварийно; аккаунт прибит `account_id` в `wrangler.jsonc`

## Обычный путь

1. Смержить PR в `main`. Job `deploy` в `.github/workflows/check.yml` применяет миграции, выкатывает и дёргает `/api/health` снаружи; проверки на `main` не повторяются (ADR-0004), поэтому мержить только зелёный PR.
2. Пока в репозитории нет секрета `CLOUDFLARE_API_TOKEN`, шаг деплоя пропускается молча — прод остаётся прежним.

## Завести секрет, один раз, делает владелец

1. Cloudflare → My Profile → API Tokens → Create Token → шаблон «Edit Cloudflare Workers». К правам шаблона добавить `Account · D1 · Edit`. Account Resources — только `Dksg87@gmail.com's Account`. Срок жизни — по вкусу, ротация руками.
2. Токен в секрет репозитория: `gh secret set CLOUDFLARE_API_TOKEN --repo thesameorg/tarotalpha` и вставить значение в приглашение. Ни в файлы, ни в чат токен не вставлять.
3. Проверить: следующий пуш в `main` — job `deploy` зелёный, версия в `wrangler deployments list` новая.

## Аварийно, с машины

1. `wrangler whoami` — в списке `Dksg87@gmail.com's Account`, в правах `d1 (write)`. Нет — `wrangler login`.
2. Новая миграция в `migrations/` — сначала `pnpm exec wrangler d1 migrations apply tarotalpha --remote`, потом деплой; воркер со старой схемой на новой миграции не падает, наоборот — падает.
3. `pnpm run deploy` — `vite build`, затем `wrangler deploy` по собранному конфигу; в конце печатает адрес `https://tarotalpha.dksg87.workers.dev`.
4. Проверить: `curl https://tarotalpha.dksg87.workers.dev/api/health` → `{"ok":true,"engine":…}` с меткой движка из `ENGINE_VERSION`; открыть `/?asset=BTCUSDT`, открыть шаг, «Поделиться», открыть ссылку в другом окне.

Откат: `pnpm exec wrangler rollback` возвращает предыдущую версию воркера; схему D1 назад не откатывают, миграции пишут только добавляющими.

Первый раз база создавалась руками: `pnpm exec wrangler d1 create tarotalpha`, id в `wrangler.jsonc`. Повторять не нужно.

Замер CPU — панель Workers → Observability, поле `cpuTime` у `POST /api/readings`; на бесплатном тарифе лимит 10 мс, ожидание — меньше миллисекунды.
