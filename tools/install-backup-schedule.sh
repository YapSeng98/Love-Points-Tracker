#!/bin/bash
# Installs a macOS launchd job that runs tools/backup.js every 7 days,
# whether or not anyone remembers to. See tools/backup.js for why this
# matters (a managed database is still not a backup).
#
# Safe to re-run — unloads any previous copy first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
SCRIPT="$ROOT/tools/backup.js"
LABEL="com.lovepointstracker.backup"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$ROOT/backups/backup.log"

if [ -z "$NODE_BIN" ]; then
  echo "node not found on PATH — install Node first." >&2
  exit 1
fi
if [ ! -f "$ROOT/tools/backup.local.json" ]; then
  echo "⚠️  tools/backup.local.json doesn't exist yet — the scheduled job will"
  echo "   fail until you run:"
  echo "     node tools/backup.js login <username> <password>"
  echo "   Either partner's login is enough — /backup-full returns both bags."
  echo "   Installing the schedule anyway; it'll start working once that's done."
fi

mkdir -p "$ROOT/backups"

sed -e "s#__NODE__#$NODE_BIN#" \
    -e "s#__SCRIPT__#$SCRIPT#" \
    -e "s#__LOG__#$LOG#" \
    "$ROOT/tools/com.lovepointstracker.backup.plist.template" > "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load -w "$PLIST_DST"

echo "✅ installed — backups run every 7 days, plus once right now."
echo "   log: $LOG"
echo "   snapshots land in: $ROOT/backups/"
echo ""
echo "To remove:  launchctl unload \"$PLIST_DST\" && rm \"$PLIST_DST\""
