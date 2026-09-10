#!/usr/bin/env python3
"""Наливает раскладов задним числом, чтобы у стола была история и звёзды не врали на пустой базе.

Скрипт только создаёт расклады через публичный API — сверяет их крон, по пять штук за прогон.
Первые звёзды появляются, когда наберётся десять сверок, то есть примерно через двадцать минут.
Гадалка у всех раскладов одна: сверка всё равно судит всю пятёрку сразу, и роль поля здесь нулевая.
Как этим пользоваться: docs/runbooks/seed-readings.md
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

HOUR_MS = 3_600_000
DAY_MS = 24 * HOUR_MS
ASSETS = "BTCUSDT,ETHUSDT,SOLUSDT,XRPUSDT,DOGEUSDT"


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def post_reading(base: str, body: dict) -> tuple[int, str]:
    request = urllib.request.Request(
        f"{base}/api/readings",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.load(response).get("id", "")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()[:120]
    except OSError as error:
        return 0, str(error)


def anchors(newest: int, count: int, every_hours: int) -> list[int]:
    return [newest - i * every_hours * HOUR_MS for i in range(count)]


def main() -> int:
    parser = argparse.ArgumentParser(description="налить раскладов задним числом")
    parser.add_argument("--base", default="http://localhost:8787", help="куда лить: localhost или workers.dev")
    parser.add_argument("--assets", default=ASSETS, help="инструменты через запятую")
    parser.add_argument("--per-asset", type=int, default=24, help="сколько якорей на инструмент")
    parser.add_argument("--every", type=int, default=8, help="шаг между якорями в часах")
    parser.add_argument("--steps", type=int, default=2, help="дней в раскладе")
    parser.add_argument("--pause", type=float, default=1.1, help="пауза между запросами: лимит 60 в минуту")
    args = parser.parse_args()

    health = get_json(f"{args.base}/api/health")
    engine = health["engine"]
    now_ms = int(time.time() * 1000)
    last_closed = now_ms // HOUR_MS * HOUR_MS - HOUR_MS
    # Якорь берём такой, чтобы горизонт уже закрылся: иначе сверять нечего и расклад просто ждёт своего часа.
    newest = last_closed - args.steps * DAY_MS
    made, failed = 0, {}
    for asset in args.assets.split(","):
        for anchor in anchors(newest, args.per_asset, args.every):
            body = {
                "asset": asset,
                "anchor_ts": anchor,
                "steps": args.steps,
                "source": "bybit",
                "reader": "atr",
                "engine_version": engine,
            }
            status, detail = post_reading(args.base, body)
            if status == 201:
                made += 1
            else:
                failed[status] = failed.get(status, 0) + 1
                print(f"  {asset} {anchor}: {status} {detail}", file=sys.stderr)
            time.sleep(args.pause)
        print(f"{asset}: готово, всего создано {made}")
    print(f"создано раскладов: {made}; отказов: {failed or 'нет'}")
    print("сверку сделает крон: пять раскладов за прогон, прогон раз в десять минут")
    return 0 if made > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
