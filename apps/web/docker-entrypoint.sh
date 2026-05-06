#!/bin/sh
set -e

SERVER_BASE_URL="${SERVER_BASE_URL:-http://server:3000}"
export SERVER_BASE_URL

# Derive host (strip protocol and any trailing path) for the Host header
SERVER_HOST=$(echo "$SERVER_BASE_URL" | sed 's|https\?://||' | sed 's|/.*||')
export SERVER_HOST

envsubst '${SERVER_BASE_URL} ${SERVER_HOST}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
