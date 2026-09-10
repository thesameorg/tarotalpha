# Иконки монет и бирж: откуда взяты и как пополнять

> справочник · 2026-09-10 · монеты — `cryptocurrency-icons` 0.18.1 (CC0-1.0), биржи — `simple-icons` 16.30.0 (CC0-1.0); 50 пар сверены с Binance `exchangeInfo`; чего в пакетах нет, дорисовано руками

Используется в `web/coin-list.ts`; файлы лежат в `web/public/coins/` и `web/public/exchanges/`, в рантайме наружу ничего не ходит.

- `cryptocurrency-icons` (npm, devDependency) — CC0-1.0, а не MIT; последний выпуск 2021 года, 483 цветные SVG в `svg/color/<тикер>.svg`. Монет моложе — SUI, TAO, PEPE и ещё двадцати из списка — там нет.
- Для монеты без иконки в пакете `web/public/coins/<тикер>.svg` — круг с первой буквой тикера в стиле пакета (32×32, цвет круга выведен из тикера); `generic.svg` — запасной круг из того же пакета на случай неизвестного тикера.
- `simple-icons` (npm, devDependency) — CC0-1.0; `binance.svg` взят как есть, `bybit.svg` в пакете нет, поэтому `web/public/exchanges/bybit.svg` — текстовая марка, нарисованная руками.
- Список: топ-150 CoinGecko по капитализации (`/api/v3/coins/markets`, 2026-09-10) ∩ пары `<тикер>USDT` со `status: TRADING` в Binance `GET /api/v3/exchangeInfo?permissions=SPOT`, первые 50; стейблкоины (USDC, USDS, USDe, USD1, RLUSD, BFUSD, TUSD, FDUSD) и токены золота (XAUT, PAXG) выкинуты руками.
- Добавить монету: `curl 'https://api.binance.com/api/v3/exchangeInfo?symbols=["XXXUSDT"]'` должен вернуть `status: TRADING`; строка `coin("XXX", "Имя")` в `COINS` на место по капитализации; `cp node_modules/cryptocurrency-icons/svg/color/xxx.svg web/public/coins/`, а нет в пакете — скопировать любой сгенерированный `web/public/coins/*.svg` и заменить букву и цвет.
