#!/usr/bin/env bash
# Дерево под задачу: ветка от свежего origin/main плюс зависимости, которых git не носит.
# Правила параллельной работы — раздел «Параллельность» в CLAUDE.md.
set -uo pipefail

COMMON="$(git rev-parse --git-common-dir 2>/dev/null)"
[ -n "$COMMON" ] || {
  echo "не git-репозиторий" >&2
  exit 2
}
COMMON="$(cd "$COMMON" && pwd)"
MAIN="$(dirname "$COMMON")" # основной чекаут, даже когда команду зовут изнутри дерева
TREES="$MAIN/.claude/worktrees"
REMOTE="refs/remotes/origin" # полное имя: локальная ветка origin/main перекрыла бы короткое

# Локфайла ещё нет — ставить нечего, и это не ошибка (оснастка живёт в TA-003).
install_deps() {
  local dir="$1"
  if [ -f "$dir/pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    (cd "$dir" && pnpm install --frozen-lockfile) || return 1
  elif [ -f "$dir/package-lock.json" ]; then
    (cd "$dir" && npm ci) || return 1
  else
    echo "локфайла нет — зависимости не ставил"
  fi
}

case "${1:-}" in
  create)
    branch="${2:-}"
    [ -n "$branch" ] || {
      echo "нужна ветка:  npm run wt -- feat/foo [имя]" >&2
      exit 2
    }
    case "$branch" in
      origin/*)
        echo "'$branch' затенит remote-tracking ref — после этого origin/main резолвится не туда" >&2
        exit 2
        ;;
    esac
    git check-ref-format --branch "$branch" >/dev/null 2>&1 || {
      echo "'$branch' — недопустимое имя ветки (git check-ref-format)" >&2
      exit 2
    }
    dir="$TREES/${3:-$(printf '%s' "$branch" | tr '/' '-')}"
    # Занятое имя не разруливаем: совпали слаги — двое делают одно (CLAUDE.md).
    [ -e "$dir" ] && {
      echo "$dir уже занят" >&2
      exit 3
    }
    # Одноимённую ветку тянем тем же fetch: без её ref мы бы ушли от main и получили отлуп.
    git -C "$MAIN" fetch origin main "+refs/heads/$branch:$REMOTE/$branch" --quiet 2>/dev/null ||
      git -C "$MAIN" fetch origin main --quiet ||
      echo "fetch не прошёл — беру локальный origin/main" >&2
    if git -C "$MAIN" show-ref --verify --quiet "refs/heads/$branch"; then
      git -C "$MAIN" worktree add --quiet "$dir" "$branch" || exit 1
      echo "ветка $branch уже была локально — взял как есть ($(git -C "$MAIN" rev-parse --short "$branch"))"
    elif git -C "$MAIN" show-ref --verify --quiet "$REMOTE/$branch"; then
      git -C "$MAIN" worktree add --quiet "$dir" --track -b "$branch" "$REMOTE/$branch" || exit 1
      echo "ветка $branch есть на origin — взял её, а не origin/main"
    else
      # --no-track: иначе апстримом станет main, и git подскажет `push origin HEAD:main`.
      git -C "$MAIN" worktree add --quiet --no-track "$dir" -b "$branch" "$REMOTE/main" || exit 1
      echo "ветка $branch от origin/main ($(git -C "$MAIN" rev-parse --short "$REMOTE/main"))"
    fi
    install_deps "$dir" || echo "зависимости не встали — поставь руками" >&2
    echo "cd $dir"
    ;;

  rm)
    force=""
    name=""
    shift
    for a in "$@"; do
      case "$a" in
        --force | -f) force=1 ;;
        *) [ -n "$name" ] || name="$(printf '%s' "$a" | tr '/' '-')" ;;
      esac
    done
    dir="$TREES/$name"
    if [ -z "$name" ] || [ ! -d "$dir" ]; then
      echo "${name:+нет дерева $name. }Деревья:" >&2
      list="$(ls -1 "$TREES" 2>/dev/null)"
      echo "${list:-  (ни одного)}" >&2
      exit 2
    fi
    [ "$(git rev-parse --show-toplevel 2>/dev/null)" != "$(cd "$dir" 2>/dev/null && pwd)" ] || {
      echo "стоишь в этом дереве — снимать его отсюда нельзя:  cd $MAIN" >&2
      exit 2
    }
    if [ -z "$force" ]; then
      br="$(git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null)"
      [ -n "$br" ] || {
        echo "$name: HEAD отцеплен, ветки нет — сносить только с --force" >&2
        exit 4
      }
      # Работа сдана, когда она на origin и на неё открыт PR. Пропавший ref — не то же
      # самое, что неслитые коммиты: после мерджа с prune его сносят, и rev-list падает.
      if git -C "$dir" show-ref --verify --quiet "$REMOTE/$br"; then
        [ "$(git -C "$dir" rev-list --count "$REMOTE/$br..$br")" = "0" ] || {
          echo "$name: на ветке $br есть незапушенное — запушь или сноси с --force" >&2
          exit 4
        }
      else
        echo "$name: ветки $br нет на origin (не пушили либо снесли после мерджа) — сноси с --force" >&2
        exit 4
      fi
    fi
    # Ветку не трогаем: на ней может стоять следующий PR стека.
    git -C "$MAIN" worktree remove ${force:+--force} "$dir" || exit 1
    git -C "$MAIN" worktree prune
    echo "снято: $name (ветка на месте)"
    ;;

  *)
    echo "usage: scripts/worktree.sh {create <ветка> [имя] | rm <имя> [--force]}" >&2
    exit 2
    ;;
esac
