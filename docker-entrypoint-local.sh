#!/bin/sh
set -eu
if [ "$API_BASE_URL" != "http://localhost:5000" ]; then
  echo 'Local frontend requires http://localhost:5000' >&2
  exit 1
fi
printf '%s\n' '{"apiBaseUrl":"http://localhost:5000"}' > /usr/share/nginx/html/app.config.json
