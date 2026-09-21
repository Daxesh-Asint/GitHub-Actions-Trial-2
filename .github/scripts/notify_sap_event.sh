#!/usr/bin/env bash
set -e

# 1. Determine payload inputs (from env vars passed by workflow)
echo "=== RECEIVED CLIENT PAYLOAD ==="
echo "$CLIENT_PAYLOAD_JSON"
echo "================================"

[ -z "$EVENT_TYPE" ] && EVENT_TYPE="$INPUT_EVENT_TYPE"
[ -z "$RESOURCE_NAME" ] && RESOURCE_NAME="$INPUT_RESOURCE_NAME"
[ -z "$RESOURCE_NAME" ] && RESOURCE_NAME="SAP CI/CD Pipeline"

ALLOWED_JOBS=(
  "AsInt-AIS-02"
  "AsInt-AIS-02-Safety-Test-DND"
  "AsInt-AIS-02-mta-fix"
  "AsInt-APM-01"
  "AsInt-APM-02"
  "AsInt-APM-EIOT"
  "AsInt-DEMO"
  "AsInt-IRC"
  "IRC"
  "AsInt-ST"
  "BAYSTAR"
  "Baystar"
  "Hemlock-NON-PROD"
  "Hemlock-PROD"
  "Indorama-PROD-900"
  "Indorama-PROD-933"
  "Indorama-QA-233"
  "Indorama-QA-234"
  "VMOS"
  "AsInt-AIS-02-DC"
)

IS_ALLOWED=false
for job in "${ALLOWED_JOBS[@]}"; do
  if [ "$RESOURCE_NAME" = "$job" ]; then
    IS_ALLOWED=true
    break
  fi
done

if [ "$IS_ALLOWED" != "true" ]; then
  echo "🚫 Job '$RESOURCE_NAME' is not in the allowed notification whitelist. Skipping notification."
  exit 0
fi

echo "event_type=$EVENT_TYPE" >> $GITHUB_OUTPUT
echo "resource_name=$RESOURCE_NAME" >> $GITHUB_OUTPUT

STATUS="$PAYLOAD_STATUS"
[ -z "$STATUS" ] && STATUS="$INPUT_STATUS"
[ -z "$STATUS" ] && STATUS="INFO"

SUBJECT="$PAYLOAD_SUBJECT"
[ -z "$SUBJECT" ] && SUBJECT="$INPUT_SUBJECT"

BODY="$PAYLOAD_BODY"
CATEGORY="$PAYLOAD_CATEGORY"

# Clean Resource Name for Display (e.g. AsInt-Indorama-Prod-900 -> Indorama Prod 900)
CLEAN_NAME=$(echo "$RESOURCE_NAME" | sed -e 's/^AsInt-//I' -e 's/-/ /g')

# Map Resource Name to Target Branch to determine Commit ID
TARGET_BRANCH=""
case "$RESOURCE_NAME" in
  "AsInt-AIS-02"|"AsInt-AIS-02-Safety-Test-DND"|"AsInt-AIS-02-mta-fix")
    TARGET_BRANCH="tenant/asint-ais-02"
    ;;
  "AsInt-APM-01")
    TARGET_BRANCH="tenant/asint-apm-01-new"
    ;;
  "AsInt-APM-02")
    TARGET_BRANCH="tenant/asint-apm-02-v2"
    ;;
  "AsInt-APM-EIOT")
    TARGET_BRANCH="apm-eiot-temp-copy"
    ;;
  "AsInt-DEMO")
    TARGET_BRANCH="tenant/asint-demo"
    ;;
  "AsInt-IRC"|"IRC")
    TARGET_BRANCH="tenant/asint-irc-temp"
    ;;
  "AsInt-ST")
    TARGET_BRANCH="st-env-for-contentfederation"
    ;;
  "BAYSTAR"|"Baystar")
    TARGET_BRANCH="tenant/baystar"
    ;;
  "Hemlock-NON-PROD")
    TARGET_BRANCH="tenant/hemlock-non-prod"
    ;;
  "Hemlock-PROD")
    TARGET_BRANCH="tenant/hemlock-prod"
    ;;
  "Indorama-PROD-900")
    TARGET_BRANCH="tenant/indorama-prod-900"
    ;;
  "Indorama-PROD-933")
    TARGET_BRANCH="tenant/indorama-prod-933"
    ;;
  "Indorama-QA-233")
    TARGET_BRANCH="tenant/indorama-qa-233"
    ;;
  "Indorama-QA-234")
    TARGET_BRANCH="tenant/indorama-qa-234"
    ;;
  "VMOS")
    TARGET_BRANCH="tenant/vmos-dev"
    ;;
  "AsInt-AIS-02-DC")
    TARGET_BRANCH="tenant/asint-ais-02-dc"
    ;;
esac

COMMIT_ID="$PAYLOAD_COMMIT_ID"
[ -z "$COMMIT_ID" ] && COMMIT_ID="$PAYLOAD_COMMIT"
[ -z "$COMMIT_ID" ] && COMMIT_ID="$PAYLOAD_SHA"
[ -z "$COMMIT_ID" ] && COMMIT_ID="$INPUT_COMMIT_ID"

# If commit_id is an unexpanded template placeholder, clear it
case "$COMMIT_ID" in
  "{"*|*"}"*) COMMIT_ID="" ;;
esac

# Search inside tags or raw payload if commit_id is empty
RAW_TAGS="$PAYLOAD_TAGS"
[ -z "$RAW_TAGS" ] && RAW_TAGS="$CLIENT_PAYLOAD_JSON"
if [ -z "$COMMIT_ID" ]; then
  TAG_COMMIT=$(echo "$RAW_TAGS" | grep -oE '(commitish|commit|sha)[=:][" ]?[a-f0-9]+' | grep -oE '[a-f0-9]{7,40}' | head -n 1)
  [ -n "$TAG_COMMIT" ] && COMMIT_ID="$TAG_COMMIT"
fi

# Shorten to 7 characters if a valid commit hash was received
if echo "$COMMIT_ID" | grep -qE '^[a-f0-9]{7,40}$'; then
  COMMIT_ID=$(echo "$COMMIT_ID" | cut -c 1-7)
else
  COMMIT_ID=""
fi

if [ -z "$COMMIT_ID" ] && [ -n "$TARGET_BRANCH" ]; then
  COMMIT_ID=$(gh api repos/$GITHUB_REPOSITORY/commits/$TARGET_BRANCH --jq '.sha' 2>/dev/null | cut -c 1-7)
fi
[ -z "$COMMIT_ID" ] && COMMIT_ID="N/A"

echo "commit_id=$COMMIT_ID" >> $GITHUB_OUTPUT
echo "status=$STATUS" >> $GITHUB_OUTPUT
echo "clean_name=$CLEAN_NAME" >> $GITHUB_OUTPUT

DASHBOARD_URL="https://asint-payg-development.cicd.cfapps.eu10.hana.ondemand.com/ui/index.html#"
TIMESTAMP=$(TZ='Asia/Kolkata' date +"%Y-%m-%d %I:%M %p IST")

# 2. Configure Card Header, Color, and Subtitle based on Event Type
if [ "$EVENT_TYPE" = "sap_cicd_started" ]; then
  CARD_TITLE="🟡 SAP CI/CD Pipeline Started"
  CARD_COLOR="warning"
  STATUS_BADGE="⏳ Running Build & Deployment"
  CARD_SUBTITLE="Build execution is now in progress for $CLEAN_NAME."
elif [ "$STATUS" = "SUCCESS" ] || [ "$STATUS" = "INFO" ]; then
  CARD_TITLE="✅ SAP CI/CD Deployment Succeeded"
  CARD_COLOR="good"
  STATUS_BADGE="🚀 Deployed Successfully"
  CARD_SUBTITLE="Pipeline build and deployment completed without errors."
else
  CARD_TITLE="❌ SAP CI/CD Deployment Failed"
  CARD_COLOR="attention"
  STATUS_BADGE="⚠️ Build / Deployment Failed"
  CARD_SUBTITLE="Pipeline execution encountered an error. Please inspect logs."
fi

[ -n "$SUBJECT" ] && [ "$SUBJECT" != "null" ] && CARD_SUBTITLE="$SUBJECT"

# ──────────────────────────────────────────────────────────
# ⚙️ Resolve CF App Configuration (from .github/cf-apps.json)
# ──────────────────────────────────────────────────────────
CONFIG_FILE=".github/cf-apps.json"
CF_ENV_NAME=""
CF_API=""
CF_ORG=""
CF_SPACE=""
CF_APPS_RAW=""

if [ -f "$CONFIG_FILE" ]; then
  CF_ENV_JSON=$(jq -c --arg name "$RESOURCE_NAME" '
    def norm: ascii_downcase | gsub("[^a-z0-9]"; "");
    .environments as $envs |
    ([$envs | to_entries[] | select(
      (.key | norm) == ($name | norm) or
      ((.value.aliases // [])[] | norm) == ($name | norm)
    ) | {key: .key, value: .value}] | first) // null
  ' "$CONFIG_FILE" 2>/dev/null || echo "")

  if [ -n "$CF_ENV_JSON" ] && [ "$CF_ENV_JSON" != "null" ]; then
    CF_ENV_NAME=$(echo "$CF_ENV_JSON" | jq -r '.key // empty')
    CF_API=$(echo "$CF_ENV_JSON" | jq -r '.value.api // empty')
    CF_ORG=$(echo "$CF_ENV_JSON" | jq -r '.value.org // empty')
    CF_SPACE=$(echo "$CF_ENV_JSON" | jq -r '.value.space // empty')
    CF_APPS_RAW=$(echo "$CF_ENV_JSON" | jq -r '(.value.apps // [])[]' 2>/dev/null || echo "")
  fi
fi

# Normalized environment key used for concurrency tracking (e.g. ais02, apm01)
if [ -n "$CF_ENV_NAME" ]; then
  ENV_TAG_KEY=$(echo "$CF_ENV_NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]//g')
else
  ENV_TAG_KEY=$(echo "$RESOURCE_NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]//g')
fi

# Optional override from payload / input if provided
PAYLOAD_APP="${PAYLOAD_APP_NAME:-$INPUT_APP_NAME}"
if [ -n "$PAYLOAD_APP" ]; then
  CF_APPS_RAW="$PAYLOAD_APP"
fi

CF_APPS_COMMA=""
CF_APPS_COUNT=0
while IFS= read -r app; do
  TRIMMED=$(echo "$app" | xargs)
  if [ -n "$TRIMMED" ]; then
    if [ -z "$CF_APPS_COMMA" ]; then
      CF_APPS_COMMA="$TRIMMED"
    else
      CF_APPS_COMMA="$CF_APPS_COMMA, $TRIMMED"
    fi
    CF_APPS_COUNT=$((CF_APPS_COUNT + 1))
  fi
done <<< "$CF_APPS_RAW"

echo "cf_app_name=$CF_APPS_COMMA" >> $GITHUB_OUTPUT
echo "=== RESOLVED CF CONFIGURATION ==="
echo "Resource: $RESOURCE_NAME"
echo "Env Key:  ${CF_ENV_NAME:-$ENV_TAG_KEY}"
echo "CF API:   $CF_API"
echo "CF Org:   $CF_ORG"
echo "CF Space: $CF_SPACE"
echo "CF Apps:  $CF_APPS_COMMA (Count: $CF_APPS_COUNT)"
echo "================================="

CF_APP_STATUS=""
if [ -n "$CF_APPS_COMMA" ] && [ "$CF_APPS_COUNT" -gt 0 ] 2>/dev/null; then
  RUN_ID="$GITHUB_RUN_ID"
  CURRENT_SHA="$GITHUB_SHA"

  echo "Installing CF CLI..."
  wget -q -O - https://packages.cloudfoundry.org/debian/cli.cloudfoundry.org.key | sudo apt-key add - 2>/dev/null || true
  echo "deb https://packages.cloudfoundry.org/debian stable main" | sudo tee /etc/apt/sources.list.d/cloudfoundry-cli.list > /dev/null
  sudo apt-get update -qq 2>/dev/null || true
  sudo apt-get install -y cf8-cli 2>/dev/null || true

  echo "Logging into Cloud Foundry..."
  cf login -a "$CF_API" -u "$CF_USERNAME" -p "$CF_PASSWORD" || true
  cf target -o "$CF_ORG" -s "$CF_SPACE" || true

  if [ "$EVENT_TYPE" = "sap_cicd_started" ]; then
    STOP_FAILED=false
    IFS=',' read -ra APPS_LIST <<< "$CF_APPS_COMMA"
    for app in "${APPS_LIST[@]}"; do
      TRIMMED=$(echo "$app" | xargs)
      if [ -n "$TRIMMED" ]; then
        echo "🛑 Stopping app $TRIMMED to free memory quota for deployment..."
        if ! cf stop "$TRIMMED"; then
          STOP_FAILED=true
        fi
      fi
    done

    if [ "$STOP_FAILED" = "true" ]; then
      CF_APP_STATUS="⚠️ Attempted to stop $CF_APPS_COMMA (Check CF logs)"
    else
      CF_APP_STATUS="🛑 $CF_APPS_COMMA stopped (needed more CF runtime memory to get deployment completed)"
    fi
  elif [ "$EVENT_TYPE" = "sap_cicd_finished" ]; then
    START_FAILED=false
    IFS=',' read -ra APPS_LIST <<< "$CF_APPS_COMMA"
    for app in "${APPS_LIST[@]}"; do
      TRIMMED=$(echo "$app" | xargs)
      if [ -n "$TRIMMED" ]; then
        echo "🔍 Resolving App GUID and state for $TRIMMED..."
        APP_GUID=$(cf app "$TRIMMED" --guid 2>/dev/null | tr -d '[:space:]' || echo "")
        echo "App: $TRIMMED, GUID: ${APP_GUID:-unknown}"

        STARTED=false
        if [ -n "$APP_GUID" ]; then
          for attempt in 1 2 3; do
            echo "▶️ Sending direct Start action to CF v3 API for $TRIMMED (attempt $attempt of 3)..."
            START_RESP=$(cf curl "/v3/apps/$APP_GUID/actions/start" -X POST 2>&1 || true)
            echo "Response: $START_RESP"

            # Check if start request succeeded (HTTP 200/state: STARTED)
            if echo "$START_RESP" | grep -qiE '"state":\s*"STARTED"'; then
              echo "Waiting up to 30s for $TRIMMED instances to be running..."
              for poll in {1..6}; do
                sleep 5
                CURRENT_STATE=$(cf app "$TRIMMED" 2>/dev/null | grep -iE 'requested state:' | awk '{print tolower($3)}' || echo "")
                if [ "$CURRENT_STATE" = "started" ]; then
                  STARTED=true
                  echo "✅ App $TRIMMED is started and running!"
                  break 2
                fi
              done
            else
              echo "⚠️ Direct start request failed or returned unexpected response. Waiting 10s before retry..."
              sleep 10
            fi
          done
        fi

        # Fallback to cf start if direct API did not achieve started state
        if [ "$STARTED" != "true" ]; then
          echo "⚠️ Direct v3 API start was unsuccessful. Attempting standard 'cf start $TRIMMED' as fallback..."
          if cf start "$TRIMMED"; then
            STARTED=true
            echo "✅ App $TRIMMED started successfully via fallback!"
          else
            START_FAILED=true
            echo "❌ Failed to start $TRIMMED. Fetching recent logs..."
            cf logs "$TRIMMED" --recent || true
          fi
        fi
      fi
    done

    if [ "$START_FAILED" = "true" ]; then
      CF_APP_STATUS="⚠️ Attempted to start $CF_APPS_COMMA (Check CF logs)"
    else
      CF_APP_STATUS="▶️ $CF_APPS_COMMA started (runtime services restored)"
    fi

    if [ "$STATUS" = "SUCCESS" ] || [ "$STATUS" = "INFO" ]; then
      CARD_SUBTITLE="Pipeline build and deployment completed without errors."
    fi
  fi
fi

# 3. Resolve target channel webhook URLs (3 slots per environment + global fallback)
NORM_ENV=$(echo "$RESOURCE_NAME" | tr '[:upper:]' '[:lower:]' | sed -e 's/[^a-z0-9]//g')
TARGET_WEBHOOKS=()
case "$NORM_ENV" in
  "ais02"|"asintais02")
    [ -n "$TEAMS_WEBHOOK_AIS02_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_1")
    [ -n "$TEAMS_WEBHOOK_AIS02_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_2")
    [ -n "$TEAMS_WEBHOOK_AIS02_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_3")
    ;;
  "apm01"|"asintapm01")
    [ -n "$TEAMS_WEBHOOK_APM01_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM01_1")
    [ -n "$TEAMS_WEBHOOK_APM01_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM01_2")
    [ -n "$TEAMS_WEBHOOK_APM01_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM01_3")
    ;;
  "apm02"|"asintapm02")
    [ -n "$TEAMS_WEBHOOK_APM02_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM02_1")
    [ -n "$TEAMS_WEBHOOK_APM02_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM02_2")
    [ -n "$TEAMS_WEBHOOK_APM02_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APM02_3")
    ;;
  "apmeiot"|"asintapmeiot")
    [ -n "$TEAMS_WEBHOOK_APMEIOT_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APMEIOT_1")
    [ -n "$TEAMS_WEBHOOK_APMEIOT_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APMEIOT_2")
    [ -n "$TEAMS_WEBHOOK_APMEIOT_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_APMEIOT_3")
    ;;
  "demo"|"asintdemo")
    [ -n "$TEAMS_WEBHOOK_DEMO_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_DEMO_1")
    [ -n "$TEAMS_WEBHOOK_DEMO_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_DEMO_2")
    [ -n "$TEAMS_WEBHOOK_DEMO_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_DEMO_3")
    ;;
  "baystar"|"asintbaystar")
    [ -n "$TEAMS_WEBHOOK_BAYSTAR_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_BAYSTAR_1")
    [ -n "$TEAMS_WEBHOOK_BAYSTAR_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_BAYSTAR_2")
    [ -n "$TEAMS_WEBHOOK_BAYSTAR_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_BAYSTAR_3")
    ;;
  "hscnonprod"|"hemlocknonprod"|"asinthemlocknonprod")
    [ -n "$TEAMS_WEBHOOK_HSC_NON_PROD_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_NON_PROD_1")
    [ -n "$TEAMS_WEBHOOK_HSC_NON_PROD_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_NON_PROD_2")
    [ -n "$TEAMS_WEBHOOK_HSC_NON_PROD_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_NON_PROD_3")
    ;;
  "hscprod"|"hemlockprod"|"asinthemlockprod")
    [ -n "$TEAMS_WEBHOOK_HSC_PROD_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_PROD_1")
    [ -n "$TEAMS_WEBHOOK_HSC_PROD_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_PROD_2")
    [ -n "$TEAMS_WEBHOOK_HSC_PROD_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_HSC_PROD_3")
    ;;
  "indoramaprod900"|"asintindoramaprod900")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_900_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_900_1")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_900_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_900_2")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_900_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_900_3")
    ;;
  "indoramaprod933"|"asintindoramaprod933")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_933_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_933_1")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_933_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_933_2")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_PROD_933_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_PROD_933_3")
    ;;
  "indoramaqa233"|"asintindoramaqa233")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_233_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_233_1")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_233_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_233_2")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_233_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_233_3")
    ;;
  "indoramaqa234"|"asintindoramaqa234")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_234_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_234_1")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_234_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_234_2")
    [ -n "$TEAMS_WEBHOOK_INDORAMA_QA_234_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_INDORAMA_QA_234_3")
    ;;
  "irc"|"asintirc")
    [ -n "$TEAMS_WEBHOOK_IRC_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_IRC_1")
    [ -n "$TEAMS_WEBHOOK_IRC_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_IRC_2")
    [ -n "$TEAMS_WEBHOOK_IRC_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_IRC_3")
    ;;
  "stenv"|"asintst"|"st")
    [ -n "$TEAMS_WEBHOOK_ST_ENV_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_ST_ENV_1")
    [ -n "$TEAMS_WEBHOOK_ST_ENV_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_ST_ENV_2")
    [ -n "$TEAMS_WEBHOOK_ST_ENV_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_ST_ENV_3")
    ;;
  "vmos"|"asintvmos")
    [ -n "$TEAMS_WEBHOOK_VMOS_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_VMOS_1")
    [ -n "$TEAMS_WEBHOOK_VMOS_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_VMOS_2")
    [ -n "$TEAMS_WEBHOOK_VMOS_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_VMOS_3")
    ;;
  "asintais02dc"|"ais02dc")
    [ -n "$TEAMS_WEBHOOK_AIS02_DC_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_DC_1")
    [ -n "$TEAMS_WEBHOOK_AIS02_DC_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_DC_2")
    [ -n "$TEAMS_WEBHOOK_AIS02_DC_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_AIS02_DC_3")
    ;;
esac

# Always include Global Webhook URLs for universal notification broadcast
[ -n "$TEAMS_WEBHOOK_GLOBAL_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_GLOBAL_1")
[ -n "$TEAMS_WEBHOOK_GLOBAL_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_GLOBAL_2")
[ -n "$TEAMS_WEBHOOK_GLOBAL_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_GLOBAL_3")

if [ "${#TARGET_WEBHOOKS[@]}" -eq 0 ]; then
  echo "ℹ️ No specific or fallback Teams webhook configured for '$RESOURCE_NAME'. Skipping notification."
  exit 0
fi

# 4. Construct MS Teams Adaptive Card Payload
PAYLOAD=$(jq -n \
  --arg title "$CARD_TITLE" \
  --arg color "$CARD_COLOR" \
  --arg subtitle "$CARD_SUBTITLE" \
  --arg status "$STATUS_BADGE" \
  --arg job "$RESOURCE_NAME" \
  --arg env_name "$CLEAN_NAME" \
  --arg commit_id "$COMMIT_ID" \
  --arg time "$TIMESTAMP" \
  --arg dashboard "$DASHBOARD_URL" \
  --arg cf_app_status "$CF_APP_STATUS" \
  '{
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            size: "Large",
            weight: "Bolder",
            text: $title,
            wrap: true
          },
          {
            type: "TextBlock",
            text: $subtitle,
            size: "Small",
            isSubtle: true,
            wrap: true
          },
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [{
                  type: "TextBlock",
                  text: $status,
                  weight: "Bolder",
                  color: $color
                }]
              }
            ]
          },
          {
            type: "FactSet",
            facts: (
              [
                { title: "Environment", value: $env_name },
                { title: "SAP CI/CD Job", value: $job },
                { title: "CI/CD Commit ID", value: $commit_id },
                { title: "Timestamp", value: $time }
              ] +
              (if $cf_app_status != "" then [
                { title: "CF App Control", value: $cf_app_status }
              ] else [] end)
            )
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "Open SAP CI/CD Dashboard",
            url: $dashboard
          }
        ]
      }
    }]
  }')

# 5. Broadcast to target channel Teams Webhooks
for WEBHOOK_URL in "${TARGET_WEBHOOKS[@]}"; do
  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$WEBHOOK_URL" || true
  fi
done
