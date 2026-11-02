#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
printf 'Updated to %s\n' "$(git rev-parse --short HEAD)"
