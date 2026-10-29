#!/bin/sh
set -eu
: "${API_BASE_URL:?Configure API_BASE_URL with the public API origin}"
case "$API_BASE_URL" in
  https://*|http://*) ;;
  *) echo 'API_BASE_URL must be an HTTP(S) origin' >&2; exit 1 ;;
esac
host=${API_BASE_URL#*://}
host=${host%/}
case "$host" in
  ''|*[!a-zA-Z0-9.:-]*) echo 'API_BASE_URL must contain only an origin (no path, query or credentials)' >&2; exit 1 ;;
esac
printf '{"apiBaseUrl":"%s"}\n' "${API_BASE_URL%/}" > /usr/share/nginx/html/app.config.json
