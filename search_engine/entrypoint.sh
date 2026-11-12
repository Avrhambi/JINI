#!/bin/bash
# Container entry point: show the environment (secrets masked), then transcribe the sample recording.
# bash, not sh: Debian's sh (dash) drops env vars whose names aren't valid identifiers, like FLASH_2.5_API_KEY
set -euo pipefail

SECRET_PATTERN='KEY|SECRET|TOKEN|PASSWORD'

echo "===== Environment variables (secrets masked) ====="
# env -0 rather than $VAR / compgen -e, which can't see names containing a dot
env -0 | sort -z | while IFS= read -r -d '' entry; do
    name="${entry%%=*}"
    value="${entry#*=}"
    if [[ "$name" =~ $SECRET_PATTERN && -n "$value" ]]; then
        value="***"
    fi
    echo "$name=$value"
done

echo "===== Transcribing sample recording ====="
exec python /app/transcribe_sample.py "$@"
