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

            # Delete versioned auto-update backup folders (bin.X.X.X, externals.X.X.X)
            # Active versions are plain 'bin' and 'externals' — these are old backups only
            find "$runner_dir" -maxdepth 1 -type d -name "bin.*" -exec rm -rf {} + 2>/dev/null
            find "$runner_dir" -maxdepth 1 -type d -name "externals.*" -exec rm -rf {} + 2>/dev/null

            # Trim _diag logs older than 7 days (keep folder, remove old log files)
            find "$runner_dir/_diag" -type f -mtime +7 -delete 2>/dev/null
        fi
    fi
done

journalctl --vacuum-size=100M > /dev/null 2>&1
apt-get clean > /dev/null 2>&1
echo "[$(date)] Cleanup finished. Free disk: $(df -h / | awk 'NR==2 {print $4}')" >> "$LOG_FILE"
