#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="$root_dir/layout/_widget/anime-calendar.ejs"

theme_dir="$root_dir/node_modules/hexo-theme-kratos-rebirth"
if [ ! -d "$theme_dir" ]; then
  echo "hexo-theme-kratos-rebirth not installed" >&2
  exit 1
fi

mkdir -p "$theme_dir/layout/_widget"
cp "$source_file" "$theme_dir/layout/_widget/anime-calendar.ejs"

