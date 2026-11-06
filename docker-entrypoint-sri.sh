#!/bin/sh
set -eu
: "${API_BASE_URL:?Configure API_BASE_URL with the public API origin}"
case "$API_BASE_URL" in
  https://*) ;;
  *) echo 'API_BASE_URL must be an HTTPS origin' >&2; exit 1 ;;
esac
host=${API_BASE_URL#*://}
host=${host%/}
case "$host" in
  ''|*[!a-zA-Z0-9.:-]*) echo 'API_BASE_URL must contain only an origin (no path, query or credentials)' >&2; exit 1 ;;
esac
installer=${WINDOWS_INSTALLER_URL:-}
if [ -n "$installer" ]; then
  case "$installer" in https://*) ;; *) echo 'WINDOWS_INSTALLER_URL must be HTTPS' >&2; exit 1 ;; esac
  case "$installer" in *[!a-zA-Z0-9._~:/?%+@=-]*) echo 'Invalid WINDOWS_INSTALLER_URL' >&2; exit 1 ;; esac
fi
printf '{"apiBaseUrl":"%s","windowsInstallerUrl":"%s"}\n' "${API_BASE_URL%/}" "$installer" > /usr/share/nginx/html/app.config.json
