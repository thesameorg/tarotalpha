# Поднять прототип локально

> актуально · 2026-09-10 · один процесс `pnpm run dev` поднимает клиент и воркер с локальной D1; свечи идут в биржу прямо из браузера, ключей нет

1. `pnpm install --frozen-lockfile` — Node 22+, зависимости из локфайла.
2. `pnpm exec wrangler d1 migrations apply tarotalpha --local` — схема в локальную D1 (`.wrangler/state`, тот же каталог читает `vite dev`).
3. `pnpm run dev` — клиент и воркер на `http://localhost:5173`; `/api/health` отвечает `{"ok":true,"engine":…}` с меткой движка из `ENGINE_VERSION`.
4. Открыть `http://localhost:5173/?asset=BTCUSDT`: график грузится живым запросом к Binance из браузера; если биржа недоступна из сети — страница скажет об этом, а не покажет пустой график.

Что ещё гоняют руками:

- `pnpm run test` — движок, биржевые адаптеры на моках и воркер внутри workerd.
- `pnpm run typecheck && pnpm run lint && pnpm run build` — то же, что CI на PR (`docs/adr/0002-ci-on-pr-deploy-from-local.md`).
- `pre-commit run --all-files` — формат и политика документирования по всему репозиторию.

Пакеты ставит pnpm: один стор на машину, в каждом дереве задачи — жёсткие ссылки, второе дерево места почти не занимает. `packageManager` в `package.json` держит версию; `corepack enable` — если pnpm ещё не стоит.
