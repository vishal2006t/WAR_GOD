#!/bin/bash
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$WORKSPACE_DIR/data/postgres"
LOG_FILE="$WORKSPACE_DIR/data/postgres.log"

echo "=== Starting EcoTrace PostgreSQL Database ==="
if [ ! -d "$DATA_DIR" ]; then
    echo "Initializing new PostgreSQL cluster..."
    /usr/lib/postgresql/18/bin/initdb -D "$DATA_DIR" -U postgres --auth=trust
    echo "unix_socket_directories = '/tmp'" >> "$DATA_DIR/postgresql.conf"
    echo "listen_addresses = 'localhost'" >> "$DATA_DIR/postgresql.conf"
fi

# Check if already running
if /usr/lib/postgresql/18/bin/pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "PostgreSQL is already active and listening on port 5432."
else
    /usr/lib/postgresql/18/bin/pg_ctl -D "$DATA_DIR" -l "$LOG_FILE" start
    echo "PostgreSQL started successfully on port 5432."
fi
