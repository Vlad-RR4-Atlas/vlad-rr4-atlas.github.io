#!/usr/bin/env bash
# Запасной способ публикации без GitHub Actions: собирает сайт и кладёт только готовые файлы в ветку gh-pages.
# В Settings -> Pages выберите Source: Deploy from a branch, ветка gh-pages, папка / (root).
# Запуск: bash scripts/publish-branch.sh
set -euo pipefail
npm run check
npm run build
remote=$(git remote get-url origin)
tmp=$(mktemp -d)
cp -a dist/. "$tmp"/
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "Публикация сайта $(date -u '+%F %H:%M') UTC"
git push -f -q "$remote" gh-pages
echo "Ветка gh-pages обновлена"
