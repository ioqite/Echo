#!/usr/bin/env bash
# deploy.sh — One-command deploy to Cloudflare Workers + D1.
#
# Prerequisites:
#   1. npx wrangler login   (or set CLOUDFLARE_API_TOKEN env var)
#   2. Set ECHO_DB_ID:
#        - Already have a D1 database?  export ECHO_DB_ID=xxxxxxxx
#        - Need to create one?          Leave ECHO_DB_ID unset and this script
#                                        will create it and print the ID.
#   3. Set PASSWORD (initial password, only used on first run):
#        export PASSWORD="your-password"
#        (or the script will prompt you)
#
# Usage:
#   ./scripts/deploy.sh                    # create DB if needed, build, deploy
#   ECHO_DB_ID=xxx ./scripts/deploy.sh     # use existing DB
#   SKIP_DB_INIT=1 ./scripts/deploy.sh     # skip schema init (already initialized)

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Echo — Deploy to Cloudflare Workers"
echo "=========================================="

# ---- 1. Install deps ----
if [ ! -d node_modules ]; then
  echo "[1/5] Installing dependencies..."
  npm install
else
  echo "[1/5] Dependencies already installed."
fi

# ---- 2. Database ID ----
echo "[2/5] Resolving D1 database ID..."
DB_ID="${ECHO_DB_ID:-}"
if [ -z "$DB_ID" ]; then
  if [ -f .dev.vars ] && grep -qE '^\s*ECHO_DB_ID\s*=' .dev.vars; then
    DB_ID=$(grep -E '^\s*ECHO_DB_ID\s*=' .dev.vars | head -1 | sed -E 's/^\s*ECHO_DB_ID\s*=\s*(?:"([^"]*)"|'"'"'([^'"'"']*)'"'"'|([^\s#]+)).*/\1\2\3/')
    echo "  Read ECHO_DB_ID from .dev.vars"
  fi
fi

if [ -z "$DB_ID" ]; then
  echo "  ECHO_DB_ID not set. Creating a new D1 database..."
  CREATE_OUTPUT=$(npx wrangler d1 create echo-db 2>&1) || {
    echo "  Failed to create D1 database. Output:"
    echo "$CREATE_OUTPUT"
    exit 1
  }
  DB_ID=$(echo "$CREATE_OUTPUT" | grep -oE 'database_id\s*=\s*"[^"]+"' | head -1 | sed -E 's/database_id\s*=\s*"([^"]+)"/\1/')
  if [ -z "$DB_ID" ]; then
    echo "  Could not parse database_id from wrangler output."
    echo "  Full output:"
    echo "$CREATE_OUTPUT"
    echo ""
    echo "  The database may have been created. Find it with: npx wrangler d1 list"
    echo "  Then set ECHO_DB_ID and re-run this script."
    exit 1
  fi
  echo "  Created database echo-db (id: $DB_ID)"
  echo "  Saving to .dev.vars for future use..."
  if [ -f .dev.vars ]; then
    # Remove any existing ECHO_DB_ID line
    grep -v '^\s*ECHO_DB_ID\s*=' .dev.vars > .dev.vars.tmp || true
    mv .dev.vars.tmp .dev.vars
  fi
  echo "ECHO_DB_ID=$DB_ID" >> .dev.vars
  echo "  Saved to .dev.vars"
fi

# Inject database_id into wrangler.toml
echo "  Injecting database_id into wrangler.toml..."
ECHO_DB_ID="$DB_ID" node scripts/prepare-wrangler.js

# ---- 3. Initialize schema ----
if [ "${SKIP_DB_INIT:-0}" != "1" ]; then
  echo "[3/5] Initializing database schema (remote)..."
  npx wrangler d1 execute echo-db --remote --file=./schema.sql
else
  echo "[3/5] Skipping schema init (SKIP_DB_INIT=1)."
fi

# ---- 4. Set PASSWORD secret ----
echo "[4/5] Setting PASSWORD secret..."
if [ -z "${PASSWORD:-}" ]; then
  if [ -f .dev.vars ] && grep -qE '^\s*PASSWORD\s*=' .dev.vars; then
    PASSWORD=$(grep -E '^\s*PASSWORD\s*=' .dev.vars | head -1 | sed -E 's/^\s*PASSWORD\s*=\s*(?:"([^"]*)"|'"'"'([^'"'"']*)'"'"'|([^\s#]+)).*/\1\2\3/')
  fi
fi
if [ -z "${PASSWORD:-}" ]; then
  read -rsp "  Enter initial password (input hidden): " PASSWORD
  echo
fi
if [ -n "$PASSWORD" ]; then
  echo "$PASSWORD" | npx wrangler secret put PASSWORD
  echo "  PASSWORD secret set."
else
  echo "  WARNING: No PASSWORD provided. Using default from wrangler.toml [vars]."
fi

# ---- 5. Build & deploy ----
echo "[5/5] Building frontend and deploying..."
npm run build
npx wrangler deploy

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "=========================================="
echo ""
echo "  Your Echo instance is live at the URL printed above."
echo "  Initial password: the one you set (change it in the UI after first login)."
echo ""
echo "  Next steps:"
echo "    - Visit the Worker URL"
echo "    - Log in with the password"
echo "    - Open Settings (top-right gear) to change the password"
echo ""
