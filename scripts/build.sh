#!/usr/bin/env sh
# Wraps swirl-room.html (written as a claude.ai artifact body) into a full standalone page at _site/index.html.
set -e
mkdir -p _site
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' \
    '<style>[hidden]{display:none!important}body{margin:0}</style>' \
    '</head>' '<body>'
  cat swirl-room.html
  printf '%s\n' '</body>' '</html>'
} > _site/index.html
echo "built _site/index.html"
