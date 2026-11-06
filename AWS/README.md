# ☁️ AWS Self-Hosted Runner Infrastructure Documentation

This repository folder documents the complete configuration, provisioning architecture, daily operations, and automated maintenance for the **AsInt Self-Hosted GitHub Actions Runner** cluster hosted on **Amazon Web Services (AWS) EC2**.

---

## 📌 1. Infrastructure Overview

* **Instance Name:** `asint-github-actions-runner`
* **Instance ID:** `i-0bf51cdca82e0113d`
* **AWS Region:** `us-east-1` (VPC: `Test_VPC`)
* **Operating System:** Ubuntu Server 24.04 LTS (x86_64)
* **Instance Type:** `t3.medium` (2 vCPU, 4 GiB RAM)
* **Root Storage:** 30 GB EBS gp3 SSD (`/dev/root`)
* **Swap Space:** 8.0 GB Swapfile (`/swapfile`) configured for concurrency safety
* **Private IP:** `172.31.27.14`
* **Public IP:** `18.234.53.103` (Dynamic / Instance Connect)
* **Target Company Repository:** `https://github.com/StillSomehowSane/asint_ais`

---

## 🏗️ 2. Multi-Worker Runner Architecture

To execute concurrent deployments in parallel without job queueing, the instance hosts **8 isolated runner worker daemons**:

| Runner Name | Working Directory | Systemd Service | Status |
| :--- | :--- | :--- | :--- |
| `asint-runner-01` | `/home/ubuntu/asint-runner-01` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-01.service` | Active (Running) |
| `asint-runner-02` | `/home/ubuntu/asint-runner-02` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-02.service` | Active (Running) |
| `asint-runner-03` | `/home/ubuntu/asint-runner-03` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-03.service` | Active (Running) |
| `asint-runner-04` | `/home/ubuntu/asint-runner-04` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-04.service` | Active (Running) |
| `asint-runner-05` | `/home/ubuntu/asint-runner-05` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-05.service` | Active (Running) |
| `asint-runner-06` | `/home/ubuntu/asint-runner-06` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-06.service` | Active (Running) |
| `asint-runner-07` | `/home/ubuntu/asint-runner-07` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-07.service` | Active (Running) |
| `asint-runner-08` | `/home/ubuntu/asint-runner-08` | `actions.runner.StillSomehowSane-asint_ais.asint-runner-08.service` | Active (Running) |

All 8 services are registered with `systemd` to automatically restart on reboot or network recovery.

---

## 🚀 3. Initial Provisioning & Setup Command

The 8-worker cluster was deployed using the automated setup script [`scripts/setup_company_runners.sh`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/scripts/setup_company_runners.sh):

```bash
# 1. Download official GitHub Actions runner package
RUNNER_VERSION="2.338.1"
mkdir -p /home/ubuntu/runner-cache && cd /home/ubuntu/runner-cache
curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

# 2. Configure 8GB Swap Safeguard
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Deploy and register each worker daemon (1 to 8)
for i in {1..8}; do
  RUNNER_NAME=$(printf "asint-runner-%02d" $i)
  RUNNER_DIR="/home/ubuntu/${RUNNER_NAME}"
  mkdir -p "$RUNNER_DIR" && cd "$RUNNER_DIR"
  tar xzf /home/ubuntu/runner-cache/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
  ./config.sh --url "https://github.com/StillSomehowSane/asint_ais" \
              --token "<COMPANY_REGISTRATION_TOKEN>" \
              --name "$RUNNER_NAME" \
              --labels "self-hosted,Linux,X64,aws-runner" \
              --unattended --replace
  sudo ./svc.sh install ubuntu
  sudo ./svc.sh start
done
```

---

## 🧹 4. Automated Disk Maintenance & Active-Job Safeguard

To prevent the 30 GB EBS disk from running out of space, an automated self-contained maintenance script is installed on the EC2 machine at `/usr/local/bin/cleanup_runners.sh`.

### Maintenance Script: `/usr/local/bin/cleanup_runners.sh`
```bash
#!/bin/bash
LOG_FILE="/home/ubuntu/runner-cleanup.log"

for runner_dir in /home/ubuntu/asint-runner-*; do
    if [ -d "$runner_dir/_work" ]; then
        runner_name=$(basename "$runner_dir")
        # Check if this specific runner has an active worker running
        if pgrep -f "$runner_name.*Runner.Worker" > /dev/null; then
            echo "[$(date)] $runner_name is busy, skipping." >> "$LOG_FILE"
        else
            # Delete old work folders on this idle runner (older than 10 mins)
            find "$runner_dir/_work" -mindepth 1 -maxdepth 2 -type d ! -name "_actions" -mmin +10 -exec rm -rf {} + 2>/dev/null
            rm -rf "$runner_dir/_work/_temp/*" 2>/dev/null

            # Delete leftover installer tar.gz archives (safe — runner already installed)
            rm -f "$runner_dir"/actions-runner-linux-x64-*.tar.gz 2>/dev/null

            # Trim _diag logs older than 7 days (keep folder, remove old log files)
            find "$runner_dir/_diag" -type f -mtime +7 -delete 2>/dev/null
        fi
    fi
done

journalctl --vacuum-size=100M > /dev/null 2>&1
apt-get clean > /dev/null 2>&1
echo "[$(date)] Cleanup finished. Free disk: $(df -h / | awk 'NR==2 {print $4}')" >> "$LOG_FILE"

# Log file size safeguard: keep only latest 1000 lines (caps file under ~70 KB)
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
```

### Key Safeguard Features:
1. **Per-Runner Active Protection:** Evaluates each runner independently. If Runner 8 is compiling code, it skips Runner 8 while safely cleaning Runners 1 through 7.
2. **Preserves `_actions` & Binaries:** Retains downloaded GitHub action tools and never touches runner core binaries (`bin`/`externals`).
3. **Removes Installer Caches:** Deletes installer `.tar.gz` archives safely.
4. **Trims `_diag` Logs:** Deletes diagnostic log files older than 7 days (keeps the folder intact).
5. **Vacuum System Logs:** Restricts Linux `journalctl` to 100 MB max.
6. **Log Rotation Safeguard:** Automatically caps `/home/ubuntu/runner-cleanup.log` to the most recent 1,000 lines (~70 KB max), preventing infinite file growth.
7. **Execution Audit Log:** Records every run with timestamp and available free disk space to `/home/ubuntu/runner-cleanup.log`.

---

## ⏰ 5. Crontab Schedule Configuration

The maintenance script runs automatically under root crontab (`sudo crontab -l`):

```text
# Run automated cleanup every 5 minutes:
*/5 * * * * /usr/local/bin/cleanup_runners.sh
```

---

## 🛠️ 6. Useful Operations & Troubleshooting Commands

### Check Disk Space
```bash
df -h /
```

### Check Runner Status Across All 8 Workers
```bash
sudo systemctl status actions.runner.* --no-pager
```

### Immediate Emergency Disk Cleanup (If Disk hits 95%+)
```bash
sudo rm -rf /home/ubuntu/asint-runner-*/_work/*
sudo journalctl --vacuum-size=100M
sudo apt-get clean
df -h /
```

### View Automated Maintenance Log History
```bash
tail -n 25 /home/ubuntu/runner-cleanup.log
```

### Change Server Timezone to Indian Standard Time (IST)
```bash
sudo timedatectl set-timezone Asia/Kolkata
timedatectl
```

