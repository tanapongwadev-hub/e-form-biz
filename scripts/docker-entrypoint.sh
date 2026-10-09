#!/bin/sh
set -eu

export FORM_CONFIG_FILE="${FORM_CONFIG_FILE:-/data/form-configs.json}"
config_file="$FORM_CONFIG_FILE"

if [ ! -f "$config_file" ]; then
  echo "Form config file not found or not a file: $config_file" >&2
  exit 1
fi

chown node:node "$config_file"
chmod 600 "$config_file"

exec setpriv --reuid=node --regid=node --init-groups "$@"
