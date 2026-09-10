#!/usr/bin/env python3
"""Линтер политики документирования — см. `.claude/skills/documenting/SKILL.md`."""

from __future__ import annotations

import argparse
import ast
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass

# ---------------------------------------------------------------- конфигурация

# Шапка файла читается ДО кода и ничего не рвёт — ей 10 строк на «что это и почему так».
# Всё дальше по файлу (докстринг метода, комментарий в теле) рвёт чтение и живёт на 3.
MAX_COMMENT_LINES = 3
MAX_HEADER_LINES = 10
OVER_LIMIT = "лишнее — либо в docs/ со ссылкой, либо под нож: пересказ кода и локальный ченджлог не документ"

CODE_EXT = {
    ".py": "py",
    ".ts": "c",
    ".tsx": "c",
    ".js": "c",
    ".mjs": "c",
    ".cjs": "c",
    ".sh": "h",
    ".bash": "h",
    ".yaml": "h",
    ".yml": "h",
}

# Шапку от комментария в теле отличает не номер строки, а то, что она стоит ДО кода.
# Импорты и директивы кодом не считаются: их бывает два десятка подряд, и шапка
# под ними шапкой быть не перестаёт.
PROLOGUE = {
    "py": re.compile(r"^\s*(import\s|from\s+[\w.]+\s+import\b)"),
    "c": re.compile(
        r"^\s*(import[\s{'\"]|export\s+[*{][^;]*\bfrom\b|(const|let|var)\s+.*=\s*require\(|['\"]use \w+['\"])"
    ),
    "h": re.compile(r"^\s*(#!|set\s+[-+])"),
}

SKIP = (
    re.compile(r"(^|/)(node_modules|\.next|\.wrangler|\.venv|venv|__pycache__|dist|build|coverage)/"),
    re.compile(r"(^|/)migrations/"),
    re.compile(r"(^|/)tests?/fixtures/"),
)

# .md разрешён только здесь. Всё остальное — свалка.
MD_ALLOWED = (
    re.compile(r"^docs/"),
    re.compile(r"^\.claude/"),
    re.compile(r"^(CLAUDE|README|CONTRIBUTING|SECURITY|LICENSE)\.md$"),
    re.compile(r"^[^/]+/(CLAUDE|README)\.md$"),
    re.compile(r"^[^/]+/[^/]+/(CLAUDE|README)\.md$"),
)

# Первая строка дока: статус, дата, вердикт.
DOC_HEADER = re.compile(
    r"^>\s*\*{0,2}(актуально|черновик|устарело?|реализовано|заморожено|справочник)"
    r"\*{0,2}\s*[·|,/—-]\s*\d{4}-\d{2}-\d{2}",
    re.IGNORECASE,
)

# lib/core/base/src/data убраны сознательно: это конвенция экосистем, а не безымянность.
NAME_EXEMPT = re.compile(r"(?!)")
GENERIC_NAMES = {
    "utils",
    "util",
    "utilities",
    "helpers",
    "helper",
    "common",
    "misc",
    "manager",
    "handler",
    "processor",
    "stuff",
    "things",
    "temp",
    "tmp",
    "new",
    "old",
    "extra",
    "other",
    "general",
    "test2",
    "index2",
    "main2",
}

ESCAPE = re.compile(r"docs-lint:\s*(allow|ignore)")

CYRILLIC = re.compile(r"[\u0400-\u04FF]")

# Оснастка объясняется по-русски: её читает владелец, а не приложение.
LNG_EXEMPT = re.compile(r"^(scripts/|\.github/|\.[a-z-]+\.ya?ml$)")

# Директивы и разделители — не комментарии по смыслу.
DIRECTIVE = re.compile(
    r"^\s*(#!|#\s*(noqa|type:|ruff:|mypy:|pylint:|fmt:|-\*-|pyright:|nosec)"
    r"|//\s*(eslint-|@ts-|prettier-|biome-|oxlint-)"
    r"|#\s*(yaml-language-server|checkov:|hadolint|renovate:))",
)
# Рамка раздела — не комментарий: ни считать её, ни ругаться на неё незачем.
# Раньше сюда не попадали ни `# ── Stage 2 ─────`, ни `# --- Настройки ---`,
# и каждая такая рамка съедала три строки лимита у комментария под собой.
FRAME = r"[-=*_#~\u2500-\u257F]"
BANNER = re.compile(
    rf"^\s*(?:#|//)\s*({FRAME})"
    rf"(?:\1{{3,}}\s*$"  # сплошная линия без заголовка
    rf"|\1{{1,}}.*\1{{3,}}\s*$"  # рамка с заголовком: 2 знака слева и 4 справа…
    rf"|\1{{2,}}.*\1{{1,}}\s*$)"  # …или 3 слева и 2 справа
)

PATH_RE = re.compile(
    r"[`(\[\s]((?:[\w.@-]+/)+[\w.@-]+"
    r"\.(?:py|ts|tsx|js|mjs|sh|ya?ml|sql|toml|json|md))[`)\]\s,.:;]"
)
MD_PATH_RE = re.compile(r"[`(\[\s]((?:[\w.@-]+/)*[\w.@-]+\.md)(?:#[\w-]+)?[`)\]\s,.:;]")

STOP_TERMS = {
    "index",
    "route",
    "page",
    "types",
    "client",
    "server",
    "config",
    "main",
    "test",
    "tests",
    "spec",
    "init",
    "app",
    "src",
    "lib",
    "api",
    "claude",
    "readme",
    "changelog",
    "docs",
    "schema",
    "utils",
}

SEVERITY_FAIL = "error"
SEVERITY_WARN = "warn"


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    code: str
    severity: str
    msg: str
    end: int = 0  # последняя строка блока; 0 = находка в одну строку

    def __str__(self) -> str:
        tag = "ERROR" if self.severity == SEVERITY_FAIL else "warn "
        return f"{tag} {self.path}:{self.line}: [{self.code}] {self.msg}"

    def annotation(self) -> str:
        lvl = "error" if self.severity == SEVERITY_FAIL else "warning"
        return f"::{lvl} file={self.path},line={self.line}::[{self.code}] {self.msg}"


# ------------------------------------------------------------------- git-слой


def sh(*args: str, cwd: str | None = None) -> str:
    # S603: только литералы git и пути из репозитория, шелла нет.
    return subprocess.run(  # noqa: S603
        args, capture_output=True, text=True, check=False, cwd=cwd
    ).stdout


def tracked(root: str) -> list[str]:
    """Список файлов под гитом — так .gitignore соблюдается бесплатно."""
    out = sh("git", "ls-files", "-z", cwd=root)
    files = [p for p in out.split("\0") if p]
    if not files:  # не репозиторий — обходим руками
        files = [os.path.relpath(os.path.join(d, f), root) for d, _, fs in os.walk(root) for f in fs]
    return [p for p in files if not any(s.search(p) for s in SKIP)]


def hunk_lines(*git_args: str, cwd: str | None = None) -> set[int]:
    out = sh(*git_args, cwd=cwd)
    res: set[int] = set()
    for m in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", out, re.M):
        start, count = int(m.group(1)), int(m.group(2) or 1)
        res.update(range(start, start + count))
    return res


def skip_formatting_commits(base: str, root: str) -> str:
    """Двигает базу диффа за форматирующий коммит: переклейка строк — не авторство."""

    # Такие коммиты уже перечислены в `.git-blame-ignore-revs` ради `git blame` —
    # один источник правды на две задачи.
    listed = read(root, ".git-blame-ignore-revs")
    if not listed:
        return base
    revs = {ln.strip() for ln in listed if ln.strip() and not ln.startswith("#")}
    in_range = sh("git", "rev-list", f"{base}..HEAD", cwd=root).split()
    hit = [r for r in in_range if r in revs]  # rev-list идёт от свежих к старым
    if not hit:
        return base
    print(f"дифф считаем от {hit[0][:9]} — форматирующий коммит из .git-blame-ignore-revs")
    return hit[0]


def changed_files(base: str, root: str) -> list[str]:
    out = sh("git", "diff", "--name-only", "--diff-filter=ACMR", f"{base}...HEAD", cwd=root)
    return [p for p in out.splitlines() if p and not any(s.search(p) for s in SKIP)]


def read(root: str, path: str) -> list[str] | None:
    try:
        with open(os.path.join(root, path), encoding="utf-8") as fh:
            return fh.read().split("\n")
    except (OSError, UnicodeDecodeError):
        return None


# ------------------------------------------------------- разрешение путей


# Существует у разработчика и отсутствует в CI: путь сюда — это ссылка на чужой
# файл, которую линтер пропустит локально и завалит на чистом чекауте.
UNTRACKED_DIRS = ("node_modules/", ".venv/", ".next/", "dist/", "build/")


def on_disk(root: str, rel: str) -> bool:
    """Есть на диске и не внутри того, чего в CI не бывает."""
    if any(part + "/" in rel + "/" for part in (d.rstrip("/") for d in UNTRACKED_DIRS)):
        return False
    return os.path.exists(os.path.join(root, rel))


def resolve(root: str, index: list[str], src: str, cand: str) -> list[str]:
    """Доки пишут хвост пути (`lib/x.ts` вместо `src/lib/x.ts`) — ищем по суффиксу."""
    if cand in index or on_disk(root, cand):
        return [cand]
    rel = os.path.normpath(os.path.join(os.path.dirname(src), cand))
    if on_disk(root, rel):
        return [rel]
    tail = "/" + cand
    return [p for p in index if p.endswith(tail)]


def skip_candidate(cand: str, before: str) -> bool:
    head = cand.split("/", 1)[0]
    return "://" in before[-12:] or cand.startswith("...") or "." in head


# ------------------------------------------------------------------ проверки


def py_doc_lines(lines: list[str]) -> tuple[dict[int, int], set[int]]:
    """Docstring-диапазоны питона через ast: ручной сканер триплетов разъезжается на данных."""
    try:
        tree = ast.parse("\n".join(lines))
    except SyntaxError:
        return {}, set()
    spans: dict[int, int] = {}
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        body = getattr(node, "body", None)
        first = body[0] if body else None
        if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
            spans[first.lineno] = first.end_lineno
    inside = {n for a, b in spans.items() for n in range(a, b + 1)}
    return spans, inside


def first_code_line(lines: list[str], kind: str) -> int:
    """Строка, на которой файл начинается по-настоящему: всё выше — импорты и директивы."""
    pro = PROLOGUE[kind]
    depth = 0
    for i, raw in enumerate(lines, 1):
        t = raw.strip()
        if not t or t.startswith(("#", "//", "/*", "*", '"""', "'''")):
            continue
        delta = t.count("(") + t.count("{") - t.count(")") - t.count("}")
        if depth:  # хвост многострочного импорта
            depth = max(0, depth + delta)
            continue
        if pro.match(raw):
            depth = max(0, delta)
            continue
        return i
    return len(lines) + 1


class _CommentRuns:
    """Накопитель блоков комментариев одного файла: шапка выше кода получает 10 строк, остальные — 3."""

    def __init__(self, path: str, lines: list[str], kind: str) -> None:
        self.path, self.lines = path, lines
        self.out: list[Finding] = []
        self.run_len = self.run_start = 0
        self.seen = self.in_block = False
        self.code_at = first_code_line(lines, kind)

    def report(self, start: int, end: int, code: str, what: str) -> None:
        """Первый блок файла, стоящий выше кода, — шапка, ей 10 строк. Всё прочее — 3."""
        limit = MAX_HEADER_LINES if not self.seen and start < self.code_at else MAX_COMMENT_LINES
        self.seen = True
        n = end - start + 1
        if n > limit and not any(ESCAPE.search(x) for x in self.lines[start - 1 : end]):
            msg = f"{what} {n} строк (лимит {limit}) — {OVER_LIMIT}"
            self.out.append(Finding(self.path, start, code, SEVERITY_FAIL, msg, end))

    def flush(self) -> None:
        if self.run_len:
            self.report(self.run_start, self.run_start + self.run_len - 1, "CMT001", "комментарий")
        self.run_len, self.run_start = 0, 0

    def extend(self, i: int) -> None:
        """Строка i продолжает текущий блок или начинает новый."""
        if self.run_len == 0:
            self.run_start = i
        self.run_len += 1

    def c_block(self, t: str, i: int) -> bool:
        """`/* … */` в C-подобном файле: True, если строка принадлежит блочному комментарию и разобрана."""
        if self.in_block:
            self.run_len += 1
            if "*/" in t:
                self.in_block = False
                self.flush()
            return True
        if not t.startswith("/*"):
            return False
        if "*/" not in t:
            self.in_block = True
            self.run_len, self.run_start = 1, i
        else:
            self.flush()
        return True


def _is_line_comment(t: str, raw: str, kind: str) -> bool:
    """Строка — однострочный комментарий, а не директива и не декоративный баннер."""
    mark = "#" if kind in ("py", "h") else "//"
    return t.startswith(mark) and not DIRECTIVE.match(raw) and not BANNER.match(raw)


def check_comments(path: str, lines: list[str], kind: str) -> list[Finding]:
    """CMT001 — блок комментариев длиннее лимита. CMT002 — docstring длиннее лимита."""
    runs = _CommentRuns(path, lines, kind)
    spans, doc_lines = py_doc_lines(lines) if kind == "py" else ({}, set())

    for i, raw in enumerate(lines, 1):
        t = raw.strip()
        if i in doc_lines:
            if i in spans:
                runs.flush()
                runs.report(i, spans[i], "CMT002", "docstring")
            continue
        if kind == "c" and runs.c_block(t, i):
            continue
        if _is_line_comment(t, raw, kind):
            runs.extend(i)
        else:
            runs.flush()

    runs.flush()
    return runs.out


def trailing_comment(raw: str, mark: str) -> str:
    """Хвост после маркера комментария, если тот не внутри кавычек. Иначе пусто."""
    pos = raw.rfind(mark)
    if pos <= 0:
        return ""
    head = raw[:pos]
    if head.count('"') % 2 or head.count("'") % 2:
        return ""
    return raw[pos:]


def _lng_finding(path: str, i: int, raw: str, prose: bool, tail: str) -> Finding | None:
    """LNG001 для одной строки: кириллица в прозе или в хвостовом комментарии, иначе None."""
    if ESCAPE.search(raw):
        return None
    if prose and CYRILLIC.search(raw):
        return Finding(
            path,
            i,
            "LNG001",
            SEVERITY_FAIL,
            "кириллица в комментарии — код объясняется по-английски, длинное объяснение в docs/ со ссылкой",
        )
    if tail and CYRILLIC.search(tail):
        return Finding(
            path, i, "LNG001", SEVERITY_FAIL, "кириллица в хвостовом комментарии — код объясняется по-английски"
        )
    return None


def _c_block_prose(t: str, in_block: bool) -> tuple[bool, bool]:
    """Для C-подобных файлов: (строка — проза, после неё мы внутри `/* … */`)."""
    if in_block or t.startswith("/*"):
        return True, "*/" not in t
    return False, in_block


def check_english(path: str, lines: list[str], kind: str) -> list[Finding]:
    """LNG001 — кириллица в комментарии или докстринге. Строки и данные не трогаем."""
    if LNG_EXEMPT.match(path) or any(ESCAPE.search(x) for x in lines[:10]):
        return []
    out: list[Finding] = []
    _, doc_lines = py_doc_lines(lines) if kind == "py" else ({}, set())
    in_block = False
    mark = "#" if kind in ("py", "h") else "//"

    for i, raw in enumerate(lines, 1):
        t = raw.strip()
        prose = False

        if kind == "py":
            prose = i in doc_lines
        elif kind == "c":
            prose, in_block = _c_block_prose(t, in_block)

        if not prose and t.startswith(mark):
            prose = True
        tail = "" if prose else trailing_comment(raw, mark)
        found = _lng_finding(path, i, raw, prose, tail)
        if found:
            out.append(found)
    return out


def check_code_doc_links(root: str, path: str, lines: list[str], index: list[str], kind: str) -> list[Finding]:
    """CMT003 — код ссылается на документ, которого нет. Ссылка обязана быть живой."""
    out = []
    marks = ("#", "//", "*", '"""', "'''")
    for i, raw in enumerate(lines, 1):
        t = raw.strip()
        if not t.startswith(marks) or ESCAPE.search(raw):
            continue
        for m in MD_PATH_RE.finditer(" " + raw + " "):
            cand = m.group(1)
            if skip_candidate(cand, raw[: m.start()]) or "/" not in cand:
                continue
            if not resolve(root, index, path, cand):
                out.append(
                    Finding(
                        path,
                        i,
                        "CMT003",
                        SEVERITY_FAIL,
                        f"ссылка на несуществующий документ `{cand}` — либо путь устарел, либо документ не завели",
                    )
                )
    return out


def check_md_location(path: str) -> list[Finding]:
    """MD001 — markdown вне разрешённых мест."""
    if any(p.search(path) for p in MD_ALLOWED):
        return []
    return [
        Finding(
            path,
            1,
            "MD001",
            SEVERITY_FAIL,
            "markdown вне docs/ — документы живут только в docs/, заметок рядом с кодом не заводим",
        )
    ]


def check_md_header(path: str, lines: list[str]) -> list[Finding]:
    """MD003 — первые строки дока: статус, дата, вердикт одним предложением."""
    if not path.startswith("docs/") or os.path.basename(path) == "README.md":
        return []
    if any(DOC_HEADER.match(ln.strip()) for ln in lines[:8] if ln.strip()):
        return []
    return [
        Finding(
            path,
            1,
            "MD003",
            SEVERITY_FAIL,
            "нет строки статуса — вторая строка дока: `> актуально · ГГГГ-ММ-ДД · <вердикт одним предложением>`",
        )
    ]


def check_md_index(root: str, path: str) -> list[Finding]:
    """MD002 — документ не вписан в README своей папки."""
    if not path.startswith("docs/") or os.path.basename(path) == "README.md":
        return []
    idx = os.path.join(os.path.dirname(path), "README.md")
    name = os.path.basename(path)
    body = read(root, idx)
    if body is None:
        return [
            Finding(
                path,
                1,
                "MD002",
                SEVERITY_FAIL,
                f"нет оглавления {idx} — в каждой папке docs/ нужен README со строкой на документ",
            )
        ]
    if name not in "\n".join(body):
        return [
            Finding(
                path,
                1,
                "MD002",
                SEVERITY_FAIL,
                f"не вписан в {idx} — добавь строку `{name} — <на какой вопрос отвечает>`",
            )
        ]
    return []


def doc_targets(root: str, path: str, lines: list[str], index: list[str]) -> tuple[list[Finding], set[str]]:
    """MD004 — путь, названный в доке, не существует. Возвращает и живые пути (для MD005)."""
    out: list[Finding] = []
    alive: set[str] = set()
    for i, raw in enumerate(lines, 1):
        if raw.strip().startswith(("http", ">")) or ESCAPE.search(raw):
            continue
        for m in PATH_RE.finditer(" " + raw + " "):
            cand = m.group(1)
            if skip_candidate(cand, raw[: m.start()]):
                continue
            hits = resolve(root, index, path, cand)
            if len(hits) == 1:
                alive.add(hits[0])  # однозначный — годится для MD005
            elif not hits:
                out.append(
                    Finding(
                        path,
                        i,
                        "MD004",
                        SEVERITY_FAIL,
                        f"ссылка на несуществующий путь `{cand}` — док отстал от кода",
                    )
                )
    return out, alive


def check_naming(path: str) -> list[Finding]:
    """NAM001 — имя файла или папки ничего не говорит о содержимом."""
    out = []
    if NAME_EXEMPT.search(path):
        return out
    parts = path.split("/")
    if os.path.splitext(parts[-1])[0].lower() in GENERIC_NAMES:
        out.append(
            Finding(
                path,
                1,
                "NAM001",
                SEVERITY_WARN,
                f"имя `{parts[-1]}` не говорит, что внутри — назови по тому, что делает",
            )
        )
    for d in parts[:-1]:
        if d.lower() in GENERIC_NAMES:
            out.append(
                Finding(
                    path,
                    1,
                    "NAM001",
                    SEVERITY_WARN,
                    f"папка `{d}/` не говорит, что внутри — назови по смыслу",
                )
            )
            break
    return out


def check_staleness(touched: set[str], doc_map: dict[str, set[str]]) -> list[Finding]:
    """MD005 — PR тронул файлы, которые док называет своими, а сам док не тронут."""
    out = []
    for doc, targets in sorted(doc_map.items()):
        if doc in touched:
            continue
        hit = sorted(targets & touched)
        if hit:
            out.append(
                Finding(
                    doc,
                    1,
                    "MD005",
                    SEVERITY_WARN,
                    f"описывает изменённые файлы ({', '.join(hit[:3])}"
                    f"{' и ещё ' + str(len(hit) - 3) if len(hit) > 3 else ''}), но сам не обновлён",
                )
            )
    return out


# ----------------------------------------------- поиск доков, которые могут врать


def terms_of(root: str, files: list[str]) -> set[str]:
    """Слова, по которым ищем доки про то же самое: имена файлов и добавленные символы."""
    out: set[str] = set()
    for p in files:
        stem = os.path.splitext(os.path.basename(p))[0]
        for part in re.split(r"[-_.]", stem):
            if len(part) >= 4 and part.lower() not in STOP_TERMS:
                out.add(part.lower())
    return out


def related_docs(root: str, index: list[str], files: list[str], top: int = 6) -> list[tuple[str, int, list[str]]]:
    """Доки, которые говорят о том же, что изменил PR — их надо перечитать на противоречия."""
    docs = {}
    for doc in index:
        if doc.endswith(".md") and "/content/" not in doc:
            body = read(root, doc)
            if body:
                docs[doc] = "\n".join(body).lower()
    if not docs:
        return []

    weighted: dict[str, int] = {}
    for term, weight in [(p.lower(), 5) for p in files] + [(t, 1) for t in terms_of(root, files)]:
        weighted[term] = max(weighted.get(term, 0), weight)

    # Термин, встречающийся в четверти доков, ничего не различает — выкидываем.
    ceiling = max(2, len(docs) // 4)
    hits = {
        term: [d for d, text in docs.items() if re.search(rf"(?<![\w/-]){re.escape(term)}\b", text)]
        for term in weighted
    }
    useful = {t: w for t, w in weighted.items() if 0 < len(hits[t]) <= ceiling}

    scored: dict[str, tuple[int, list[str]]] = defaultdict(lambda: (0, []))
    for term, weight in useful.items():
        for doc in hits[term]:
            score, why = scored[doc]
            scored[doc] = (score + weight, why + [term])

    ranked = sorted(scored.items(), key=lambda kv: -kv[1][0])
    return [(d, s, sorted(set(w))[:6]) for d, (s, w) in ranked[:top]]


# ---------------------------------------------------------------------- сборка


def authored(f: Finding, added: dict[str, set[int] | None]) -> bool:
    """Блок под правилом, только если PR его писал, а не задел строку внутри."""

    # Переименование пути в чужом 40-строчном докстринге — не новый долг, его
    # разбирает ратчет. Новый комментарий на 8 строк — долг.
    new = added.get(f.path)
    if new is None:  # None = файл целиком новый, писали его в этом PR
        return True
    if not f.end:
        return f.line in new
    span = range(f.line, f.end + 1)
    return sum(1 for i in span if i in new) >= max(2, len(span) // 2)


def _collect_md(root: str, path: str, lines: list[str], index: list[str]) -> tuple[list[Finding], set[str]]:
    """MD-файл: базовые правила плюс живые ссылки. Скиллы — инструкции, мёртвые ссылки не считаем."""
    findings = check_naming(path) + check_md_location(path) + check_md_header(path, lines) + check_md_index(root, path)
    if path.startswith(".claude/"):
        return findings, set()
    dead, alive = doc_targets(root, path, lines, index)
    return findings + dead, alive


def _collect_code(root: str, path: str, lines: list[str], ext: str, index: list[str]) -> list[Finding]:
    """Код-файл: имя, комментарии, английский, живые ссылки на docs/."""
    kind = CODE_EXT[ext]
    return (
        check_naming(path)
        + check_comments(path, lines, kind)
        + check_english(path, lines, kind)
        + check_code_doc_links(root, path, lines, index, kind)
    )


def _update_doc_map(root: str, index: list[str], doc_map: dict[str, set[str]]) -> None:
    """Доки, не тронутые в этом PR, тоже нужны для устаревания — их живые ссылки досчитываем здесь."""
    for doc in index:
        if doc.endswith(".md") and doc not in doc_map and doc.startswith(("docs/", "CLAUDE")):
            lines = read(root, doc)
            if lines:
                _, alive = doc_targets(root, doc, lines, index)
                if alive:
                    doc_map[doc] = alive


def collect(root: str, files: list[str], touched: set[str], index: list[str]) -> list[Finding]:
    # touched непусто только в режиме --base: устаревание — вопрос уровня PR.
    findings: list[Finding] = []
    doc_map: dict[str, set[str]] = {}

    for path in files:
        if any(s.search(path) for s in SKIP):
            continue
        ext = os.path.splitext(path)[1]

        if ext == ".md":
            lines = read(root, path)
            if lines is None:
                continue
            md_findings, alive = _collect_md(root, path, lines, index)
            findings += md_findings
            if alive:
                doc_map[path] = alive

        elif ext in CODE_EXT:
            lines = read(root, path)
            if lines is None:
                continue
            findings += _collect_code(root, path, lines, ext, index)

    if touched:
        _update_doc_map(root, index, doc_map)
        findings += check_staleness(touched, doc_map)

    return findings


def counts_at(root: str, ref: str) -> Counter:
    """Счётчики нарушений на состоянии ref — ратчет без файла-бейзлайна."""
    tmp = tempfile.mkdtemp(prefix="docs-lint-")
    work = os.path.join(tmp, "tree")
    sh("git", "worktree", "add", "--detach", "--quiet", work, ref, cwd=root)
    try:
        if not os.path.isdir(os.path.join(work, ".git")) and not os.path.exists(os.path.join(work, ".git")):
            return Counter()
        idx = tracked(work)
        return Counter(f.code for f in collect(work, idx, set(), idx))
    finally:
        sh("git", "worktree", "remove", "--force", work, cwd=root)
        shutil.rmtree(tmp, ignore_errors=True)


# ------------------------------------------------------------------------- CLI


def summary(text: str) -> None:
    """Пишет блок в сводку прогона GitHub Actions; вне CI — молчит."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(text + "\n\n")


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="линтер политики документирования")
    ap.add_argument("files", nargs="*", help="файлы (режим pre-commit: только новые строки)")
    ap.add_argument(
        "--worktree", action="store_true", help="новые строки считать против HEAD, а не против индекса (режим хука)"
    )
    ap.add_argument("--base", help="дифф против ref (режим PR)")
    ap.add_argument("--ratchet-vs", metavar="REF", help="счётчики сейчас против счётчиков на REF")
    ap.add_argument("--related", action="store_true", help="какие доки перечитать на противоречия")
    ap.add_argument("--only", help="только этот код проверки")
    ap.add_argument("--summary", action="store_true", help="только сводка по кодам")
    ap.add_argument("--annotate", action="store_true", help="формат аннотаций GitHub Actions")
    return ap.parse_args()


def run_ratchet(root: str, index: list[str], ref: str) -> int:
    """Ратчет: сравнивает два состояния целиком."""
    now = Counter(f.code for f in collect(root, index, set(), index))
    was = counts_at(root, ref)
    grown = {c: (was.get(c, 0), now[c]) for c in now if now[c] > was.get(c, 0)}
    width = max([len(c) for c in set(now) | set(was)] + [5])
    rows = []
    for c in sorted(set(now) | set(was)):
        a, b = was.get(c, 0), now.get(c, 0)
        mark = "хуже" if b > a else ("лучше" if b < a else "—")
        print(f"{c:<{width}} {a:>6} → {b:<6} {mark if mark != '—' else ''}")
        rows.append(f"| `{c}` | {a} | {b} | {mark} |")
    summary(f"### Ratchet vs `{ref}`\n\n| код | было | стало | |\n|---|---:|---:|---|\n" + "\n".join(rows))
    if grown:
        print(f"\nратчет: долг вырос против {ref}", file=sys.stderr)
        for c, (a, b) in grown.items():
            print(f"  {c}: {a} → {b}", file=sys.stderr)
        return 1
    print("\nратчет: долг не вырос")
    return 0


def select_files(
    args: argparse.Namespace, root: str, index: list[str]
) -> tuple[list[str], dict[str, set[int] | None], set[str]]:
    """Какие файлы смотрим и какие строки считаем «новыми»."""
    added: dict[str, set[int] | None] = {}
    touched: set[str] = set()

    if args.files:
        files = [f for f in args.files if not any(s.search(f) for s in SKIP)]
        # Хук зовут до `git add`, поэтому индекс ему не годится: он смотрит рабочее
        # дерево против HEAD. Файл, которого git ещё не знает, проверяем целиком.
        diff = ["diff", "HEAD"] if args.worktree else ["diff", "--cached"]
        known = set(index)
        added = {f: (hunk_lines("git", *diff, "-U0", "--no-color", "--", f) if f in known else None) for f in files}
    elif args.base:
        args.base = skip_formatting_commits(args.base, root)
        files = changed_files(args.base, root)
        touched = set(files)  # MD005 включается только здесь
        new = set(sh("git", "diff", "--name-only", "--diff-filter=A", f"{args.base}...HEAD").splitlines())
        added = {
            f: (
                None  # None = файл целиком новый; множество строк тут строить незачем
                if f in new
                else hunk_lines("git", "diff", "-U0", "--no-color", f"{args.base}...HEAD", "--", f)
            )
            for f in files
        }
    else:
        files = index
    return files, added, touched


def print_related(root: str, index: list[str], files: list[str]) -> int:
    """Какие доки перечитать на противоречия."""
    hits = related_docs(root, index, files or index)
    if not hits:
        print("связанных доков не нашлось")
        return 0
    print("Перечитай эти доки — они говорят о том же, что изменил PR:\n")
    for doc, score, why in hits:
        print(f"  {doc}  (вес {score}: {', '.join(why)})")
    print("\nПротиворечие правится в этом же PR или помечается устаревшим.")
    return 0


def print_findings(findings: list[Finding], args: argparse.Namespace, files: list[str]) -> int:
    """Печатает находки в выбранном формате и возвращает код возврата процесса."""
    if args.summary:
        counts: dict[str, int] = defaultdict(int)
        for f in findings:
            counts[f.code] += 1
        print(f"{'код':8} {'шт':>6}")
        for c, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            print(f"{c:8} {n:6}")
        print(f"{'ИТОГО':8} {len(findings):6}")
        return 0

    for f in sorted(findings, key=lambda x: (x.severity != SEVERITY_FAIL, x.path, x.line)):
        print(f.annotation() if args.annotate else f)

    errors = sum(1 for f in findings if f.severity == SEVERITY_FAIL)
    if findings:
        print(f"\n{errors} ошибок, {len(findings) - errors} предупреждений", file=sys.stderr)
    if args.base:
        head = "нарушений нет" if not findings else f"{errors} ошибок, {len(findings) - errors} предупреждений"
        body = "\n".join(f"- `{f.code}` {f.path}:{f.line} — {f.msg}" for f in findings[:40])
        summary(f"### Docs policy\n\nБаза `{args.base}`, файлов {len(files)}. {head}.\n\n{body}")
    return 1 if errors else 0


def main() -> int:
    args = parse_args()

    root = sh("git", "rev-parse", "--show-toplevel").strip() or os.getcwd()
    os.chdir(root)
    index = tracked(root)

    if args.ratchet_vs:
        return run_ratchet(root, index, args.ratchet_vs)

    files, added, touched = select_files(args, root, index)

    if args.related:
        return print_related(root, index, files)

    if args.base:
        head = sh("git", "rev-parse", "--short", "HEAD").strip()
        ref = sh("git", "rev-parse", "--short", args.base).strip()
        print(f"дифф: {args.base} ({ref}) ... HEAD ({head}) — файлов {len(files)}")

    findings = collect(root, files, touched, index)

    if added:
        findings = [f for f in findings if f.code.startswith("MD") or authored(f, added)]
    if args.only:
        findings = [f for f in findings if f.code == args.only]

    return print_findings(findings, args, files)


if __name__ == "__main__":
    sys.exit(main())
