#!/bin/sh
set -e

if [ -x /seed ]; then
  /seed -if-empty || true
fi

exec /server
