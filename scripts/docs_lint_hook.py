#!/usr/bin/env python3
"""PostToolUse-хук: проверяет только что записанный файл и возвращает замечания агенту."""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def outside_repo(rel: str) -> bool:
    """Путь ведёт за пределы чекаута."""
    return rel == ".." or rel.startswith(".." + os.sep)


def main() -> int:
    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    path = (event.get("tool_input") or {}).get("file_path", "")
    root = event.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(HERE)
    if not path:
        return 0
    if os.path.isabs(path):
        path = os.path.relpath(path, root)
    # Все наши внутренние доки лежат внутри репозитория, поэтому политика описывает
    # только его. Файл снаружи ей не подчиняется — MD001 ругалась на него зря.
    if outside_repo(path):
        return 0

    # S603: фиксированная программа, путь едет отдельным argv, шелла нет.
    res = subprocess.run(  # noqa: S603
        [sys.executable, os.path.join(HERE, "docs_lint.py"), path],
        capture_output=True,
        text=True,
        cwd=root,
        check=False,
    )
    found = res.stdout.strip()
    # Код ноль бывает и с находками: предупреждения его не поднимают, а хук обещает любое нарушение.
    if res.returncode == 0 and not found:
        return 0
    # Находок нет, а код не ноль — упал сам линтер. Без stderr агент видел пустое «нарушена».
    if not found:
        print("scripts/docs_lint.py упал:\n" + res.stderr.strip(), file=sys.stderr)
        return 2

    # Подсказка про комментарий — только к находке про комментарий: к имени файла она сбивала бы с толку.
    hint = " Длинный комментарий — это документ, его место в docs/ со ссылкой." if "[CMT001]" in found else ""
    print(
        "Политика документирования (.claude/skills/documenting/SKILL.md) нарушена:\n"
        + found
        + "\n\nПочини сейчас."
        + hint,
        file=sys.stderr,
    )
    return 2  # 2 = stderr уходит агенту как замечание


if __name__ == "__main__":
    sys.exit(main())
