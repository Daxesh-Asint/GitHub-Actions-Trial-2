#!/bin/bash
LOG_FILE="/home/ubuntu/runner-cleanup.log"

log() {
    echo "[$(date)] $1" >> "$LOG_FILE"
}

if pgrep -f "Runner.Worker" > /dev/null; then
    log "ACTIVE JOB DETECTED. Skipping cleanup to protect ongoing deployment."
    exit 0
fi

log "Starting automated maintenance. All runners are idle."

for runner_dir in /home/ubuntu/asint-runner-*/_work; do
    if [ -d "$runner_dir" ]; then
        find "$runner_dir" -mindepth 1 -maxdepth 2 -type d ! -name "_actions" -mmin +1440 -exec rm -rf {} + 2>/dev/null
        rm -rf "$runner_dir/_temp/*" 2>/dev/null
    fi
done

journalctl --vacuum-size=100M >/dev/null 2>&1
apt-get clean >/dev/null 2>&1

FREE_SPACE=$(df -h / | awk 'NR==2 {print $4}')
log "Cleanup completed successfully. Available disk space: $FREE_SPACE."

