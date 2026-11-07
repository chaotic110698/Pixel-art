#!/bin/bash
# Batterie de tests d'audit (Playwright + Chromium, voir CLAUDE.md).
# Usage : scripts/audit/run.sh [test…]   (sans argument : tous les tests)
# Sert le dossier du site sur le port 8123 s'il n'est pas déjà servi.
cd "$(dirname "$0")/../.."
PORT=${PORT:-8123}
export AUDIT_URL="http://localhost:$PORT/"
if ! curl -s -o /dev/null "$AUDIT_URL"; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER' EXIT
  sleep 1
fi
TESTS=${*:-"tools export files pt lib ui guide misc mobile a11y en sizes storage fuzz"}
FAIL=0
for t in $TESTS; do
  echo "== $t"
  node "scripts/audit/$t.js" 2>&1 | tee /tmp/audit_$t.log | grep -E "^(FAIL|OK  )|vérifications OK|ERREURS PAGE|TEXTE PARASITE|PAGEERR" | grep -v "^OK  " 
  grep -q "^FAIL\|ERREURS PAGE" /tmp/audit_$t.log && FAIL=1
done
exit $FAIL
