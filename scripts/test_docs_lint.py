#!/usr/bin/env python3
"""Самопроверка парсеров docs_lint. Запуск: python3 scripts/test_docs_lint.py"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docs_lint as L


def codes(src: str, kind: str) -> list[str]:
    return [f.code for f in L.check_comments("x", src.split("\n"), kind)]


def marks(src: str, kind: str) -> list[tuple[str, int]]:
    return [(f.code, f.line) for f in L.check_comments("x", src.split("\n"), kind)]


def body(src: str) -> str:
    """Тот же текст, но ниже кода — чтобы проверять лимит тела, а не шапки."""
    return "x = 1\n" + src


# --- шапка файла: 10 строк, всё остальное в файле: 3
assert codes('"""Шапка.\n' + "а\n" * 8 + '"""', "py") == []  # 10 — ровно потолок
assert codes('"""Шапка.\n' + "а\n" * 9 + '"""', "py") == ["CMT002"]  # 11 — уже нет
assert codes("# a\n# b\n# c\n# d\n# e\nx = 1", "py") == []  # лента `#` в начале файла — тоже шапка
assert codes("/**\n" + " * x\n" * 8 + " */\nlet x", "c") == []
assert codes("/**\n" + " * x\n" * 9 + " */\nlet x", "c") == ["CMT001"]
assert codes(body("# a\n# b\n# c\n# d\nx = 1"), "py") == ["CMT001"]  # в теле — 3
assert codes(body("/**\n * a\n * b\n * c\n */\nlet x"), "c") == ["CMT001"]

# --- шапка — это блок ВЫШЕ кода, а не блок в первых строках
# Импорты кодом не считаются: под двумя десятками импортов шапка остаётся шапкой.
assert codes("import a from 'a'\n" * 20 + "\n/**\n" + " * x\n" * 8 + " */\nlet x", "c") == []
assert codes("'use client'\n\nimport a from 'a'\n\n// a\n// b\n// c\n// d\nlet x", "c") == []
assert codes("import {\n  a,\n  b,\n} from 'a'\n\n// a\n// b\n// c\n// d\nlet x", "c") == []
assert codes("import os\nfrom x import (\n    y,\n)\n\n# a\n# b\n# c\n# d\nx = 1", "py") == []
assert codes("#!/usr/bin/env bash\nset -euo pipefail\n\n# a\n# b\n# c\n# d\necho", "h") == []
# Одна строка кода выше — и блок уже не шапка, как бы высоко он ни стоял.
assert codes("const A = 1\n// a\n// b\n// c\n// d\nlet x", "c") == ["CMT001"]
assert codes("name: x\n\n# a\n# b\n# c\n# d\nkey: v", "h") == ["CMT001"]
# Шапка бывает одна: второй блок в прологе — уже тело.
assert codes("// шапка\n\n// a\n// b\n// c\n// d\nimport a from 'a'", "c") == ["CMT001"]

# --- python: docstring
assert codes(body('def f():\n    """Одна строка."""\n    pass'), "py") == []
assert codes(body('def f():\n    """Раз\n    два\n    """'), "py") == []
assert codes(body('def f():\n    """Раз\n    два\n    три\n    четыре\n    """'), "py") == ["CMT002"]
assert codes(body('def f():\n    """Раз\n    два\n    три\n    docs-lint: allow\n    """'), "py") == []
# Многострочные данные — не docstring: закрывающая кавычка не открывает фантом и не сбивает разбор дальше.
assert marks('S = """\na\n"""\nb = 1\nc = 2\nd = 3\ne = 4\nZ = """\nf\n"""', "py") == []
assert marks(
    'S = """\nx\n"""\n' + "y = 1\n" * 8 + 'def f():\n    """Раз\n    два\n    три\n    четыре\n    """', "py"
) == [("CMT002", 13)]
assert [f.code for f in L.check_english("x.py", 'A = """\nx\n"""\nB = "привет"'.split("\n"), "py")] == []

# --- python: комментарии
assert codes(body("# a\n# b\n# c\nx = 1"), "py") == []
assert codes(body("# a\n# b\n\n# c\n# d\nx = 1"), "py") == []  # пустая строка рвёт блок
assert codes("#!/usr/bin/env python3\n# noqa: E501\n# type: ignore\n# ruff: noqa\nx=1", "py") == []

# --- ts: // и /* */
assert codes(body("// a\n// b\n// c\nlet x"), "c") == []
assert codes(body("// a\n// b\n// c\n// d\nlet x"), "c") == ["CMT001"]
assert codes(body("/* однострочный */\nlet x"), "c") == []
assert codes(body("/*\n * a\n * b\n * c\n */\nlet x"), "c") == ["CMT001"]
assert (
    codes(
        "// eslint-disable-next-line a\n// eslint-disable-next-line b\n"
        "// eslint-disable-next-line c\n// eslint-disable-next-line d\nlet x",
        "c",
    )
    == []
)

# --- yaml / sh
assert codes(body("# a\n# b\n# c\n# d\nkey: 1"), "h") == ["CMT001"]
assert codes("# ---------\n# a\nkey: 1", "h") == []

# --- парсер git-ханков
sample = "@@ -1,0 +5,3 @@\n@@ -20 +21 @@\n@@ -30,2 +40,0 @@\n"
got: set[int] = set()
for m in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", sample, re.M):
    s, c = int(m.group(1)), int(m.group(2) or 1)
    got.update(range(s, s + c))
assert got == {5, 6, 7, 21}, got

# --- строка статуса дока
assert L.DOC_HEADER.match("> актуально · 2026-08-24 · рендерер ходит в Payload только через readFetch")
assert L.DOC_HEADER.match("> **реализовано** — 2026-01-02 — вердикт")
assert L.DOC_HEADER.match("> заморожено · 2026-08-24 · статус в Linear")
assert L.DOC_HEADER.match("> справочник · 2026-08-24 · предметная область")
assert not L.DOC_HEADER.match("> готово · 2026-08-24 · выдуманный статус")
assert not L.DOC_HEADER.match("> просто цитата")
assert not L.DOC_HEADER.match("# Заголовок")

# --- разрешённые места для .md
for ok in (
    "docs/pipeline/keywords.md",
    "CLAUDE.md",
    "appsite/CLAUDE.md",
    "hatchet/worker_pipeline/README.md",
    ".claude/skills/documenting/SKILL.md",
):
    assert L.check_md_location(ok) == [], ok
for bad in ("_work/notes.md", "appsite/docs/stack.md", "payloadcms/payload/todo.md"):
    assert [f.code for f in L.check_md_location(bad)] == ["MD001"], bad

# --- нейминг
assert [f.code for f in L.check_naming("admin/src/admin_api/utils.py")] == ["NAM001"]
assert [f.code for f in L.check_naming("appsite/src/helpers/date.ts")] == ["NAM001"]
assert L.check_naming("appsite/src/lib/job-dispatch.ts") == []
assert L.check_naming("scripts/backup/backup.sh") == []  # backup — осмысленное имя

# --- разрешение путей по суффиксу
idx = ["appsite/src/lib/job-dispatch.ts", "payloadcms/renderer/src/lib/payload.ts", "appsite/src/lib/payload.ts"]
assert L.resolve(".", idx, "appsite/CLAUDE.md", "lib/job-dispatch.ts") == ["appsite/src/lib/job-dispatch.ts"]
assert len(L.resolve(".", idx, "CLAUDE.md", "src/lib/payload.ts")) == 2  # неоднозначно → молчим
assert L.resolve(".", idx, "CLAUDE.md", "src/lib/gone.ts") == []  # мёртвая ссылка

# --- что не считаем путём
assert L.skip_candidate("serpapi.com/google-domains.json", "в ")  # это хост
assert L.skip_candidate(".../profile/route.ts", "` ")  # сознательное сокращение
assert L.skip_candidate("src/x.ts", "https://host/")  # часть URL
assert not L.skip_candidate("src/lib/x.ts", "смотри ")


# --- ссылка код → документ
def cmt003(src: str, index: list[str]) -> list[str]:
    return [f.code for f in L.check_code_doc_links("/nonexistent", "a/b.py", src.split("\n"), index, "py")]


assert cmt003("# см. docs/pipeline/keywords.md", []) == ["CMT003"]
assert cmt003("# см. docs/pipeline/keywords.md", ["docs/pipeline/keywords.md"]) == []
assert cmt003("x = 1  # docs/gone.md docs-lint: allow", []) == []
assert cmt003("x = 'docs/gone.md'", []) == []  # не комментарий

# --- рамка раздела: считается разделителем, а не комментарием
assert L.BANNER.match("# ----------------")
assert L.BANNER.match("# ---------- Prompts ----------")
assert L.BANNER.match("// --- Unplan: cancel the task ---")
assert L.BANNER.match("# \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
assert L.BANNER.match("# \u2500\u2500 Stage 2 \u2500\u2500\u2500\u2500")
# знак с обоих концов один и всего его ≥6, иначе рамкой становится обычный текст
assert not L.BANNER.match("# __init__ is called before __new__")
assert not L.BANNER.match("// **bold** note about **this**")
assert not L.BANNER.match("# -- a --")
assert not L.BANNER.match("# обычный комментарий")
assert not L.BANNER.match("# a - b - c")

print("ok")


# --- фильтр «блок написан этим PR», и что он вообще подключён
import inspect  # noqa: E402

assert "authored(f, added)" in inspect.getsource(L.main), "authored определён, но не вызывается"

long_block = L.Finding("a.py", 191, "CMT002", L.SEVERITY_FAIL, "", 205)
assert not L.authored(long_block, {"a.py": {191}})  # правка одной строки — не наш долг
assert L.authored(long_block, {"a.py": set(range(191, 199))})  # переписали половину — наш
assert L.authored(long_block, {"a.py": None})  # файл целиком новый
one_liner = L.Finding("a.py", 5, "MD004", L.SEVERITY_FAIL, "")
assert L.authored(one_liner, {"a.py": {5}})
assert not L.authored(one_liner, {"a.py": {6}})

# --- у длинных блоков end обязан быть заполнен, иначе фильтр вырождается
for f in L.check_comments("x", ('"""a\n' + "b\n" * 10 + '"""').split("\n"), "py"):
    assert f.end > f.line, f
for f in L.check_comments("x", body("# a\n# b\n# c\n# d\nx = 1").split("\n"), "py"):
    assert f.end == f.line + 3, f

# --- новый файл обозначается None, а не множеством из десяти миллионов чисел:
# на 39 новых файлах это съедало 26 ГБ и раннер убивал процесс
src = inspect.getsource(L)
assert "range(1, 10**" not in src, "новый файл снова обозначен гигантским range"
assert "None  # None = файл целиком новый" in src


# --- хук не лезет за пределы чекаута: все наши доки внутри репозитория, и политика
# описывает только его
import docs_lint_hook as H  # noqa: E402

assert H.outside_repo("../../elsewhere/note.md")
assert H.outside_repo("..")
assert not H.outside_repo("docs/flows/customer-email.md")
assert not H.outside_repo(".claude/agents/critic.md")
assert not H.outside_repo("appsite/src/lib/notifications/policy.ts")

print("все проверки прошли")


# --- LNG001: кириллица в комментарии, но не в данных
def lng(src: str, kind: str, path: str = "appsite/src/x.ts") -> list[str]:
    return [f.code for f in L.check_english(path, src.split("\n"), kind)]


assert lng("// a russian word: привет\nlet x", "c") == ["LNG001"]
assert lng("/*\n * привет\n */\nlet x", "c") == ["LNG001"]
assert lng("const stop = ['привет', 'пока']", "c") == []  # данные — не комментарий
assert lng("// docs-lint: allow — «Расширение»\nlet x", "c") == []
assert lng('"""Каноникализация."""\nx = 1', "py", "hatchet/w.py") == ["LNG001"]
assert lng('"""Canon.\n\nтекст\n"""\nx = 1', "py", "hatchet/w.py") == ["LNG001"]
assert lng('STOP = {"и", "в"}\n# fine', "py", "hatchet/w.py") == []
assert lng("# кириллица\nx = 1", "py", "scripts/x.py") == []  # оснастка изъята
assert lng("# кириллица\nx: 1", "h", ".prettierrc.yaml") == []

print("ok")

# --- LNG001: хвостовые комментарии и файловое изъятие
assert lng("x = 10  # десять в месяц", "py", "hatchet/w.py") == ["LNG001"]
assert lng('url = "https://x#якорь"', "py", "hatchet/w.py") == []  # решётка внутри кавычек
assert lng('"""Морфология RU. docs-lint: allow"""\n# любой русский', "py", "hatchet/w.py") == []

print("ok")

# --- MD004: путь внутри непрослеживаемой директории не считается существующим.
# Он есть у разработчика и отсутствует в CI, поэтому ссылка на него проходила
# локально и валила чистый чекаут.
import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as _root:
    os.makedirs(os.path.join(_root, "appsite/node_modules/next"))
    open(os.path.join(_root, "appsite/node_modules/next/index.js"), "w").close()
    open(os.path.join(_root, "real.py"), "w").close()
    assert L.on_disk(_root, "real.py")
    assert not L.on_disk(_root, "appsite/node_modules/next/index.js")
    assert not L.on_disk(_root, "appsite/.next/x.json")

print("ok")
