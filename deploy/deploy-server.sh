#!/usr/bin/env bash
set -euo pipefail

export PATH="/www/server/nodejs/v22.22.3/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ARCHIVE_PATH="${1:-/tmp/server-release.tar.gz}"
APP_DIR="${APP_DIR:-/www/wwwroot/node/pm-server}"
BACKUP_ROOT="${BACKUP_ROOT:-/www/wwwroot/node/pm-server-backups}"
BT_START_SCRIPT="${BT_START_SCRIPT:-/www/server/nodejs/vhost/scripts/pm_server.sh}"
PID_FILE="${PID_FILE:-/www/server/nodejs/vhost/pids/pm_server.pid}"
LOG_FILE="${LOG_FILE:-/www/wwwlogs/nodejs/pm_server.log}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:53380/api/health}"
SKIP_DB_BACKUP="${SKIP_DB_BACKUP:-0}"
FORCE_INSTALL="${FORCE_INSTALL:-0}"

LOCK_FILE="/tmp/pm-server-deploy.lock"
STAGING_DIR="/tmp/pm-server-staging-$$"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_BACKUP_DIR="$BACKUP_ROOT/releases/$TIMESTAMP"

cleanup() {
  rm -rf "$STAGING_DIR" "$ARCHIVE_PATH"
}
trap cleanup EXIT

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "ERROR: Another deployment is currently in progress."
  exit 1
fi

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "ERROR: Release archive not found at $ARCHIVE_PATH"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: App directory does not exist: $APP_DIR"
  exit 1
fi

mkdir -p "$BACKUP_ROOT/db" "$BACKUP_ROOT/releases" "$STAGING_DIR"

echo "==> [1/6] Extracting release archive..."
tar -xzf "$ARCHIVE_PATH" -C "$STAGING_DIR"

if [ ! -f "$STAGING_DIR/dist/index.js" ] || [ ! -f "$STAGING_DIR/package.json" ]; then
  echo "ERROR: Invalid release archive (missing dist/index.js or package.json)"
  exit 1
fi

backup_database() {
  if [ "$SKIP_DB_BACKUP" = "1" ]; then
    echo "==> [2/6] Skipping database backup (SKIP_DB_BACKUP=1)"
    return 0
  fi

  if [ ! -f "$APP_DIR/.env" ]; then
    echo "==> [2/6] .env not found, skipping database backup"
    return 0
  fi

  echo "==> [2/6] Backing up database before deployment..."
  local db_type
  db_type="$(node -e '
    const fs = require("fs");
    const env = fs.readFileSync(process.argv[1], "utf8");
    let dbType = "SQLITE";
    for (const line of env.split(/\r?\n/)) {
      const m = /^\s*DB_TYPE\s*=\s*(.+?)\s*$/.exec(line);
      if (m) dbType = m[1].replace(/^["'\'']|["'\'']$/g, "").toUpperCase();
    }
    console.log(dbType);
  ' "$APP_DIR/.env")"

  if [ "$db_type" = "MYSQL" ]; then
    node -e '
      const fs = require("fs");
      const { execFileSync } = require("child_process");
      const env = fs.readFileSync(process.argv[1], "utf8");
      let mysqlUrl = "";
      for (const line of env.split(/\r?\n/)) {
        const m = /^\s*MYSQL_URL\s*=\s*(.+?)\s*$/.exec(line);
        if (m) mysqlUrl = m[1].replace(/^["'\'']|["'\'']$/g, "");
      }
      if (!mysqlUrl) {
        console.error("ERROR: DB_TYPE=MYSQL but MYSQL_URL is missing in .env");
        process.exit(1);
      }
      const u = new URL(mysqlUrl);
      const dbName = u.pathname.replace(/^\//, "");
      const outFile = process.argv[2];
      const args = [
        "-h", u.hostname,
        "-P", String(u.port || 3306),
        "-u", decodeURIComponent(u.username),
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        "--default-character-set=utf8mb4",
        dbName,
      ];
      const sql = execFileSync("mysqldump", args, {
        env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) },
        maxBuffer: 512 * 1024 * 1024,
      });
      const zlib = require("zlib");
      fs.writeFileSync(outFile, zlib.gzipSync(sql));
    ' "$APP_DIR/.env" "$BACKUP_ROOT/db/mysql_${TIMESTAMP}.sql.gz"
    echo "    MySQL backup saved: mysql_${TIMESTAMP}.sql.gz"
  else
    local sqlite_path
    sqlite_path="$(node -e '
      const fs = require("fs");
      const path = require("path");
      const env = fs.readFileSync(process.argv[1], "utf8");
      let p = "./data/app.db";
      for (const line of env.split(/\r?\n/)) {
        const m = /^\s*PISA_APP_DB_PATH\s*=\s*(.+?)\s*$/.exec(line);
        if (m) p = m[1].replace(/^["'\'']|["'\'']$/g, "");
      }
      console.log(path.resolve(process.argv[2], p));
    ' "$APP_DIR/.env" "$APP_DIR")"

    if [ -f "$sqlite_path" ]; then
      sqlite3 "$sqlite_path" ".backup '$BACKUP_ROOT/db/sqlite_${TIMESTAMP}.db'"
      gzip -f "$BACKUP_ROOT/db/sqlite_${TIMESTAMP}.db"
      echo "    SQLite backup saved: sqlite_${TIMESTAMP}.db.gz"
    else
      echo "    SQLite file not found at $sqlite_path, skipping"
    fi
  fi

  ls -1t "$BACKUP_ROOT/db"/*.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
}

snapshot_current_release() {
  echo "==> [3/6] Snapshotting current release for rollback..."
  mkdir -p "$RELEASE_BACKUP_DIR"
  for item in dist web-admin frontend-html static discover package.json pnpm-lock.yaml; do
    if [ -e "$APP_DIR/$item" ]; then
      cp -a "$APP_DIR/$item" "$RELEASE_BACKUP_DIR/"
    fi
  done
  ls -1dt "$BACKUP_ROOT/releases"/* 2>/dev/null | tail -n +4 | xargs -r rm -rf
}

find_app_node_pids() {
  local pids=""
  local p
  for p in $(ps -eo pid,args | awk '/dist\/index\.js/ {print $1}'); do
    if [ "$(readlink -f "/proc/$p/cwd" 2>/dev/null || true)" = "$APP_DIR" ]; then
      pids="$pids $p"
    fi
  done
  echo "$pids"
}

stop_server() {
  local main_pid=""
  if [ -f "$PID_FILE" ]; then
    main_pid="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  fi
  if [ -n "$main_pid" ] && kill -0 "$main_pid" 2>/dev/null; then
    kill -TERM "$main_pid" 2>/dev/null || true
  fi

  local cpid
  for cpid in $(find_app_node_pids); do
    kill -TERM "$cpid" 2>/dev/null || true
  done

  for _ in $(seq 1 15); do
    local remaining
    remaining="$(find_app_node_pids | xargs)"
    if [ -z "$remaining" ]; then
      return 0
    fi
    sleep 1
  done

  for cpid in $(find_app_node_pids); do
    kill -KILL "$cpid" 2>/dev/null || true
  done
  sleep 1
}

start_server() {
  if [ ! -x "$BT_START_SCRIPT" ]; then
    echo "ERROR: BT start script not found or not executable: $BT_START_SCRIPT"
    return 1
  fi
  su -s /bin/bash www -c "bash '$BT_START_SCRIPT'"
}

wait_for_health() {
  local i
  for i in $(seq 1 30); do
    if curl -sf -m 2 "$HEALTH_URL" | grep -q '"up"'; then
      echo "    Health check passed on attempt $i."
      return 0
    fi
    sleep 1
  done
  return 1
}

sync_release_files() {
  local src_dir="$1"
  mkdir -p "$APP_DIR/dist" "$APP_DIR/web-admin" "$APP_DIR/frontend-html" "$APP_DIR/static" "$APP_DIR/discover"

  rsync -a --delete "$src_dir/dist/" "$APP_DIR/dist/"
  rsync -a --delete --exclude='.user.ini' --exclude='.well-known/' "$src_dir/web-admin/" "$APP_DIR/web-admin/"
  rsync -a --delete --exclude='.user.ini' --exclude='.well-known/' "$src_dir/frontend-html/" "$APP_DIR/frontend-html/"

  if [ -d "$src_dir/static" ]; then
    rsync -a --delete "$src_dir/static/" "$APP_DIR/static/"
  fi
  if [ -d "$src_dir/discover" ]; then
    rsync -a --delete "$src_dir/discover/" "$APP_DIR/discover/"
  fi

  cp -f "$src_dir/package.json" "$APP_DIR/package.json"
  cp -f "$src_dir/pnpm-lock.yaml" "$APP_DIR/pnpm-lock.yaml"
  if [ -f "$src_dir/.env.example" ]; then
    cp -f "$src_dir/.env.example" "$APP_DIR/.env.example"
  fi
}

fix_ownership() {
  local target
  for target in dist static discover package.json pnpm-lock.yaml .env.example; do
    if [ -e "$APP_DIR/$target" ]; then
      chown -R www:www "$APP_DIR/$target"
    fi
  done
  for target in web-admin frontend-html; do
    if [ -d "$APP_DIR/$target" ]; then
      find "$APP_DIR/$target" -mindepth 1 ! -name '.user.ini' -exec chown www:www {} + 2>/dev/null || true
      chown www:www "$APP_DIR/$target" 2>/dev/null || true
    fi
  done
}

install_prod_deps_if_needed() {
  local old_hash=""
  local new_hash
  new_hash="$(sha256sum "$STAGING_DIR/pnpm-lock.yaml" | awk '{print $1}')"
  if [ -f "$APP_DIR/pnpm-lock.yaml" ]; then
    old_hash="$(sha256sum "$APP_DIR/pnpm-lock.yaml" | awk '{print $1}')"
  fi

  if [ "$FORCE_INSTALL" = "1" ] || [ ! -d "$APP_DIR/node_modules/.pnpm" ] || [ "$old_hash" != "$new_hash" ]; then
    echo "==> [4/6] Installing production dependencies via pnpm..."
    sync_release_files "$STAGING_DIR"
    fix_ownership
    cd "$APP_DIR"
    pnpm install --prod --frozen-lockfile --registry=https://registry.npmmirror.com
    chown -R www:www "$APP_DIR/node_modules"
  else
    echo "==> [4/6] pnpm-lock.yaml unchanged, skipping dependency install..."
    sync_release_files "$STAGING_DIR"
    fix_ownership
  fi
}

rollback() {
  echo "ERROR: Health check failed! Rolling back to $RELEASE_BACKUP_DIR..."
  if [ -f "$LOG_FILE" ]; then
    echo "--- Tail of $LOG_FILE ---"
    tail -n 60 "$LOG_FILE" || true
  fi
  stop_server
  sync_release_files "$RELEASE_BACKUP_DIR"
  fix_ownership
  start_server
  if wait_for_health; then
    echo "Rollback succeeded and previous release is healthy."
  else
    echo "CRITICAL: Rollback health check also failed!"
  fi
  exit 1
}

backup_database
snapshot_current_release
install_prod_deps_if_needed

echo "==> [5/6] Restarting pm_server..."
stop_server
start_server

echo "==> [6/6] Verifying service health..."
if ! wait_for_health; then
  rollback
fi

echo "==> Deployment succeeded at $(date '+%Y-%m-%d %H:%M:%S')"
