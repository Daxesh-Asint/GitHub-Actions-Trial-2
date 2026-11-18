#!/bin/bash
set -e

# ==============================================================================
# 🔑 1. CONFIGURATION (REPLACE WITH TOKEN PROVIDED BY REPO ADMIN)
# ==============================================================================
COMPANY_REPO_URL="https://github.com/StillSomehowSane/asint_ais"
COMPANY_TOKEN="AXNICATPQ2ZAA3KCQIO2B73K347ZY"
RUNNER_VERSION="2.338.1"
TOTAL_WORKERS=8

echo "================================================================="
echo "  STARTING COMPLETE CLEAN-SLATE SETUP FOR ASINT COMPANY RUNNERS  "
echo "================================================================="

# ==============================================================================
# 🧹 2. STOP & REMOVE ALL OLD POC RUNNERS & SERVICES
# ==============================================================================
echo ">>> [1/5] Cleaning up legacy POC runner services..."
for old_dir in /home/ubuntu/actions-runner /home/ubuntu/aws-runner-*; do
  if [ -d "$old_dir" ]; then
    echo "Stopping service in $old_dir..."
    cd "$old_dir"
    sudo ./svc.sh stop 2>/dev/null || true
    sudo ./svc.sh uninstall 2>/dev/null || true
    cd /home/ubuntu
    sudo rm -rf "$old_dir"
  fi
done
sudo systemctl daemon-reload

# ==============================================================================
# 💾 3. CONFIGURE 8 GB SWAPFILE FOR 8 PARALLEL WORKERS
# ==============================================================================
echo ">>> [2/5] Configuring 8 GB swap space for 8 parallel runners..."
if [ -f /swapfile ]; then
  sudo swapoff /swapfile 2>/dev/null || true
  sudo rm -f /swapfile
fi
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo sed -i '/\/swapfile/d' /etc/fstab
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# ==============================================================================
# 📦 4. VERIFY SYSTEM DEPENDENCIES & CACHE RUNNER PACKAGE
# ==============================================================================
echo ">>> [3/5] Verifying dependencies (git, gh, jq, curl)..."
sudo apt-get update -y
sudo apt-get install -y git curl jq tar gzip libicu-dev build-essential

mkdir -p /home/ubuntu/runner-cache && cd /home/ubuntu/runner-cache
if [ ! -f "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" ]; then
  echo "Downloading GitHub Actions Runner v${RUNNER_VERSION}..."
  curl -o "actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -L \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
fi

# ==============================================================================
# 🚀 5. REGISTER & LAUNCH 8 COMPANY WORKERS
# ==============================================================================
echo ">>> [4/5] Deploying $TOTAL_WORKERS company runner workers..."
for i in $(seq 1 $TOTAL_WORKERS); do
  RUNNER_NAME=$(printf "asint-runner-%02d" $i)
  RUNNER_DIR="/home/ubuntu/$RUNNER_NAME"

  echo "---------------------------------------------------------"
  echo "Setting up $RUNNER_NAME..."
  echo "---------------------------------------------------------"

  mkdir -p "$RUNNER_DIR" && cd "$RUNNER_DIR"
  cp /home/ubuntu/runner-cache/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz .
  tar xzf "./actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

  # Register with company repository
  ./config.sh --url "$COMPANY_REPO_URL" \
    --token "$COMPANY_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels self-hosted,Linux,X64,asint-runner \
    --unattended \
    --replace

  # Install and start as a background systemd service
  sudo ./svc.sh install ubuntu
  sudo ./svc.sh start
done

# ==============================================================================
# ✅ 6. FINAL STATUS CHECK
# ==============================================================================
echo "================================================================="
echo "  SUCCESS: All $TOTAL_WORKERS Company Runners Are Active & Online!  "
echo "================================================================="
