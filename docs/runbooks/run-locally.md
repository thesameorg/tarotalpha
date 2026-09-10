# Поднять прототип локально

> актуально · 2026-09-10 · один процесс `npm run dev` поднимает клиент и воркер с локальной D1; свечи идут в биржу прямо из браузера, ключей нет

1. `npm ci` — Node 22+, зависимости из локфайла.
2. `npx wrangler d1 migrations apply tarotalpha --local` — схема в локальную D1 (`.wrangler/state`, тот же каталог читает `vite dev`).
3. `npm run dev` — клиент и воркер на `http://localhost:5173`; `/api/health` отвечает `{"ok":true,"engine":"v1"}`.
4. Открыть `http://localhost:5173/?asset=BTCUSDT`: график грузится живым запросом к Binance из браузера; если биржа недоступна из сети — страница скажет об этом, а не покажет пустой график.

Что ещё гоняют руками:

- `npm run test` — движок, биржевые адаптеры на моках и воркер внутри workerd.
- `npm run typecheck && npm run lint && npm run build` — то же, что CI на PR (`docs/adr/0002-ci-on-pr-deploy-from-local.md`).
- `pre-commit run --all-files` — формат и политика документирования по всему репозиторию.
