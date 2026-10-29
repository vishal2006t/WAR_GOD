#!/bin/bash
set -e

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "================================================================="
echo "   ECOTRACE — Full Platform Orchestration (WEB3-02 Hackathon)    "
echo "================================================================="

# 1. Start MongoDB
"$WORKSPACE_DIR/scripts/start-mongo.sh"

# 2. Compile Smart Contracts and start Hardhat local node if not active
echo "Checking Hardhat node on port 8545..."
if ! curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo "Starting Hardhat Local Node (Chain ID: 31337)..."
    cd "$WORKSPACE_DIR/blockchain"
    npx hardhat node > "$WORKSPACE_DIR/data/hardhat.log" 2>&1 &
    sleep 3
    echo "Deploying EWasteRegistry to local EVM..."
    npx hardhat run scripts/deploy.ts --network localhost
fi

# 3. Start Backend
echo "Starting Backend API on port 5000..."
cd "$WORKSPACE_DIR/backend"
npx ts-node src/server.ts > "$WORKSPACE_DIR/data/backend.log" 2>&1 &
sleep 2

# 4. Start Frontend
echo "Starting Frontend UI on port 5173..."
cd "$WORKSPACE_DIR/frontend"
npm run dev > "$WORKSPACE_DIR/data/frontend.log" 2>&1 &

echo ""
echo "================================================================="
echo " EcoTrace is now fully operational!"
echo " Frontend Web Portal: http://localhost:5173/"
echo " Backend REST API:   http://localhost:5000/health"
echo " Hardhat Local Node: http://127.0.0.1:8545"
echo " MongoDB Database:   mongodb://127.0.0.1:27017/ecotrace"
echo "================================================================="
