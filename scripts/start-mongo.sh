#!/bin/bash
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_PATH="$WORKSPACE_DIR/data/mongodb-bin/bin/mongod"
DATA_DIR="$WORKSPACE_DIR/data/mongo"
LOG_FILE="$WORKSPACE_DIR/data/mongo.log"

echo "=== Starting EcoTrace MongoDB Server (v7.0) ==="

if [ ! -f "$BIN_PATH" ]; then
    echo "Downloading MongoDB standalone distribution..."
    mkdir -p "$WORKSPACE_DIR/data/mongodb-bin"
    curl -sSL https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian12-7.0.14.tgz | tar -xz -C "$WORKSPACE_DIR/data/mongodb-bin" --strip-components=1
fi

mkdir -p "$DATA_DIR"

if ss -tulpn | grep -q ":27017 "; then
    echo "MongoDB is already active and listening on port 27017."
else
    "$BIN_PATH" --dbpath "$DATA_DIR" --port 27017 --bind_ip 127.0.0.1 --logpath "$LOG_FILE" --fork
    echo "MongoDB started successfully on port 27017."
fi
