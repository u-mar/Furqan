#!/bin/bash
# Deprecated — use: npm run download-quran  (node scripts/download-quran-data.js)
exec node "$(dirname "$0")/download-quran-data.js" "$@"
