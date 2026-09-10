# TA-003 · Оснастка JS

> ветка: feat/prototype · PR: нет

**Зачем.** Линтер политики документирования уже стоит, а формата, типов и тестов ещё нет. Нужен TypeScript в strict, ESLint flat с type-aware правилами, Prettier, vitest — и всё это заведённое в `pre-commit`, чтобы CI не узнавал первым.

**Что меняется.** Нарушение стиля, мёртвый импорт и красный тест ловятся на коммите, а не на ревью.

**DoD.** Линтер краснеет на подсунутом файле-нарушителе и молчит на чистом. Проверяется обоими прогонами: линтер, который не краснеет ни на чём, линтером не является.

**Как чиню.** TypeScript strict с `noUncheckedIndexedAccess`, ESLint 9 flat с `typescript-eslint` type-checked и `eslint-config-prettier`, vitest для движка и `@cloudflare/vitest-pool-workers` для воркера. В `pre-commit` — eslint и `tsc` локальными хуками рядом с prettier. Скрипты: `typecheck`, `lint`, `test`, `build`, `dev`, `deploy`.

**Разведка.** Переиспользую: `.prettierrc.yaml`, `.pre-commit-config.yaml`. Завожу новое: `eslint.config.js`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`. Сломается: ничего. Не трогаю: питоновый линтер. Пропустил: «Чужое» — форма конфига плагина Vite сверяется с документацией Cloudflare при установке, а не здесь.

**Цена.** `npm install` и один прогон CI.

**Ждёт.** TA-002.
