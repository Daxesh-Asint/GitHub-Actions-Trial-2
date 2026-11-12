#!/bin/bash
LOG_FILE="/home/ubuntu/runner-cleanup.log"

for runner_dir in /home/ubuntu/asint-runner-*; do
    if [ -d "$runner_dir/_work" ]; then
        runner_name=$(basename "$runner_dir")
        
        # Check if this specific runner has an active worker running
        if pgrep -f "$runner_name.*Runner.Worker" > /dev/null; then
            echo "[$(date)] $runner_name is busy, skipping." >> "$LOG_FILE"
        else
            # 1. Clean old work and temp files (older than 10 mins)
            find "$runner_dir/_work" -mindepth 1 -maxdepth 2 -type d ! -name "_actions" -mmin +10 -exec rm -rf {} + 2>/dev/null
            rm -rf "$runner_dir/_work/_temp/"* 2>/dev/null

            # 2. Delete leftover installer tar archives
            rm -f "$runner_dir"/actions-runner-linux-x64-*.tar.gz 2>/dev/null

            # 3. Trim diagnostic logs older than 3 days
            find "$runner_dir/_diag" -type f -mtime +3 -delete 2>/dev/null

            # 4. SMART RUNNER PRUNING: Keep active version, delete old inactive backup versions
            ACTIVE_BIN=$(readlink -f "$runner_dir/bin" 2>/dev/null)
            ACTIVE_EXT=$(readlink -f "$runner_dir/externals" 2>/dev/null)

            for old_bin in "$runner_dir"/bin.*; do
                if [ -d "$old_bin" ] && [ "$old_bin" != "$ACTIVE_BIN" ]; then
                    rm -rf "$old_bin" 2>/dev/null
                fi
            done

            for old_ext in "$runner_dir"/externals.*; do
                if [ -d "$old_ext" ] && [ "$old_ext" != "$ACTIVE_EXT" ]; then
                    rm -rf "$old_ext" 2>/dev/null
                fi
            done
        fi
    fi
done

# System-level cleanups
journalctl --vacuum-size=50M > /dev/null 2>&1
apt-get clean > /dev/null 2>&1
echo "[$(date)] Cleanup finished. Free disk: $(df -h / | awk 'NR==2 {print $4}')" >> "$LOG_FILE"

# Rotate cleanup log to 1000 lines max
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
