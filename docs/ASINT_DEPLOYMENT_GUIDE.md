# AsInt SAP CI/CD Deployment Architecture — Technical Guide

**Document Title:** AsInt SAP CI/CD Deployment Architecture — Technical Guide  
**Version:** 1.0  
**Date:** October 2026  
**Prepared By:** DevOps / Platform Engineering Team  
**Audience:** Developers, Lead Developers, DevOps Engineers, New Team Members  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Repository & Branch Structure](#4-repository--branch-structure)
5. [Deployment Pipeline Types](#5-deployment-pipeline-types)
   - 5.1 [Snapshot-Based Pipeline (APM-02 Family)](#51-snapshot-based-pipeline-apm-02-family)
   - 5.2 [Direct Auto-Merge Pipeline (Standard Tenants)](#52-direct-auto-merge-pipeline-standard-tenants)
6. [Tenant Environment Catalogue](#6-tenant-environment-catalogue)
7. [Workflow File Reference](#7-workflow-file-reference)
8. [Notification & Alerting System](#8-notification--alerting-system)
9. [Jarvis Bot Command Reference](#9-jarvis-bot-command-reference)
10. [Deployment State Management](#10-deployment-state-management)
11. [Operational Procedures & Rules](#11-operational-procedures--rules)

---

## 1. Executive Summary

This document describes the end-to-end CI/CD deployment architecture used by AsInt to deploy SAP Business Technology Platform (BTP) applications across multiple client tenant environments.

The system is built on **GitHub Actions** and integrates with **SAP CI/CD Service**, **SAP BTP Cloud Foundry**, **Google Cloud Platform (GCP)**, and **Microsoft Teams** to provide a fully automated, event-driven deployment pipeline with real-time notifications, self-healing capabilities, and concurrency safety guards.

### Key Capabilities

- **Fully automated** deployment triggered by commands from Microsoft Teams (via Jarvis Bot).
- **Two pipeline architectures** supporting both high-frequency snapshot deployments (APM-02 family) and direct auto-merge deployments (all other tenants).
- **45 active deployment pipelines** (15 tenants x 3 module variants: Core, DC, DC AddIn).
- **Real-time MS Teams notifications** for all deployment events (start, progress, success, failure, conflict).
- **Self-healing recovery** for failed SAP CI/CD builds without manual intervention.
- **Concurrency safety** preventing multiple simultaneous deployments to the same environment.

---

## 2. Technology Stack

| Category | Tool / Service | Purpose |
| :--- | :--- | :--- |
| **Source Control** | GitHub (GitHub Repository) | Central code repository, branch management, PR tracking |
| **CI/CD Orchestration** | GitHub Actions | Workflow automation, deployment coordination, event handling |
| **SAP Build & Deploy** | SAP CI/CD Service (Cloud Foundry) | Builds and deploys MTA (Multi-Target Application) packages to SAP BTP |
| **SAP Runtime** | SAP BTP Cloud Foundry | Hosts deployed SAP applications (HTML5 Apps, approuters, backend services) |
| **SAP Launchpad** | SAP Build Work Zone (Standard Edition) | Serves the end-user Fiori Launchpad; content channel refreshed post-deployment |
| **Event Notifications** | SAP Alert Notification Service (ANS) | Fires webhook events to GitHub on SAP CI/CD job status changes |
| **Bot Platform** | Google Cloud Platform (GCP) — Cloud Run | Hosts the "Jarvis" chatbot that interprets MS Teams commands and dispatches GitHub Actions |
| **Team Communication** | Microsoft Teams (Adaptive Cards via Incoming Webhooks) | Sends deployment status cards with interactive buttons for all environment channels |
| **Scripting Language** | Bash (Shell Scripts) | Custom scripts for notification routing, webhook resolution, SAP event processing |
| **Script Runtime** | Node.js 20 | Wiki update scripts (update_wiki.js, update_wiki_global.js) |
| **Secret Management** | GitHub Repository Secrets | Stores MS Teams webhook URLs, CF credentials, and service credentials |
| **Wiki** | GitHub Wiki | Auto-updated deployment history and tracking log |

---

## 3. System Architecture Overview

The deployment system operates as a closed-loop event-driven pipeline connecting five major systems:

```
  Developer (MS Teams)
        |
        | Sends "@Jarvis deploy" command
        v
  Microsoft Teams Channel
        |
        | Teams Outgoing Webhook
        v
  GCP Cloud Run (Jarvis Bot)
  - Parses the command
  - Validates the environment
  - Issues repository_dispatch event
        |
        | repository_dispatch event
        v
  GitHub Actions Workflows
  - Snapshot creation / Auto-merge
  - PR management
  - Label-based state tracking
        |
        | Push to tenant branch
        v
  SAP CI/CD Service
  - MTA Build
  - Cloud Foundry Deploy to BTP
        |
        | SAP ANS Webhook (build result)
        v
  GitHub Actions (Finalize / Notify)
  - Process result
  - Sync-back to main (APM-02)
  - Refresh SAP Build Work Zone
        |
        | Adaptive Card
        v
  Microsoft Teams Channel (Environment-specific)
```

---

## 4. Repository & Branch Structure

### 4.1 Branch Types

The repository uses a carefully structured branching model to support multiple tenants and environments simultaneously without cross-contamination.

| Branch Type | Naming Pattern | Purpose |
| :--- | :--- | :--- |
| **Development Branch** | `dev` | Active development branch. All feature development and hotfixes are merged here first. |
| **Core Base Branch** | `main` | Stable, release-ready code for Core module (used by all tenants). |
| **DC Base Branch** | `main-dc` | Stable code for Data Collection (DC) module. |
| **DC AddIn Base Branch** | `main-dc-addin` | Stable code for DC AddIn module. |
| **Tenant Branch** | `tenant/<env-name>` | Per-tenant, per-module deployment branches. SAP CI/CD monitors these branches. Pushing to a tenant branch triggers the SAP build and deploy process. |
| **Snapshot Branch** | `snapshot/main-YYMMDD-HHMM` | Temporary branch (APM-02 only). Cut from the base branch at the start of each deployment cycle. Deleted after successful merge-back. |

### 4.2 Code Flow Direction

**APM-02 Family (Snapshot-Based):**
```
dev  -->  main / main-dc / main-dc-addin  -->  snapshot/*  -->  tenant/*
```

**All Other Tenants (Direct Auto-Merge):**
```
dev  -->  tenant/*
```

> **Important Rule:** Code is NEVER committed directly to a tenant branch. Tenant branches receive code only through automated merge processes triggered by GitHub Actions workflows.

---

## 5. Deployment Pipeline Types

There are two distinct pipeline architectures used across the tenant environments.

---

### 5.1 Snapshot-Based Pipeline (APM-02 Family)

This is an advanced, high-safety pipeline used exclusively for the APM-02 family (APM-02 Core, APM-02 DC, APM-02 DC AddIn). It introduces a "cherry-pick window" between code freeze and deployment, allowing developers to selectively include emergency fixes.

#### 5.1.1 Workflow Stages

**STAGE 1: TRIGGER**
Developer types "@Jarvis deploy" in the APM-02 Teams channel. Jarvis Bot (GCP Cloud Run) receives the message and issues a `repository_dispatch` event of type `trigger_apm02_deployment` to the GitHub repository.

**STAGE 2: GUARD CHECK** (apm02_1_create_and_wait.yml)
GitHub Actions checks for concurrent deployments. If any PR with labels [Active / Deploying / Failed / Blocked] exists → BLOCKS the new deployment and alerts Teams. If state is IDLE → proceeds.

**STAGE 3: SNAPSHOT CREATION**
Creates a timestamped branch from the base branch (e.g., `snapshot/main-261013-1430` from `main`). Creates a Tracking Pull Request against `main`. Labels the PR: `APM-02 Active`. Posts a "Deployment Window Open" card to Teams with a countdown.

**STAGE 4: CHERRY-PICK WINDOW** (default: 180 minutes)
Developers have the configured window to cherry-pick specific commits from `dev` into the snapshot branch for last-minute fixes. The window can be extended by typing "@Jarvis extend `<minutes>`" in Teams.

**STAGE 5: TENANT MERGE AND SAP TRIGGER**
When the window expires (or Jarvis triggers early): Creates a PR from snapshot to tenant branch. Merges snapshot into `tenant/asint-apm-02-v2`. Updates Tracking PR label to `APM-02 Deploying`. The push to the tenant branch triggers SAP CI/CD job `AsInt-APM-02`.

**STAGE 6: SAP CI/CD EXECUTION**
SAP CI/CD Service runs the MTA build pipeline: source checkout from tenant branch, MTA build (package compilation, dependency resolution), Cloud Foundry deployment to the target BTP subaccount.

**STAGE 7: ANS NOTIFICATION TO GITHUB**
SAP Alert Notification Service (ANS) sends a webhook event to GitHub with the build result (STARTED / SUCCESS / FAILURE).

**STAGE 8A: ON FAILURE**
`sap_cicd_notifier.yml` processes the event: updates label to `APM-02 Failed`, sends a detailed failure card to Teams with "@Jarvis retrigger" button. If retriggered via Jarvis or SAP dashboard: detects the re-trigger event, resets label back to `APM-02 Deploying`, resumes monitoring automatically (Self-Healing).

**STAGE 8B: ON SUCCESS**
`apm02_3_finalize_cycle.yml` is triggered:
1. Merges snapshot branch back into `main` (sync-back to preserve any hotfixes).
2. Closes the Tracking PR with label `APM-02 Deployed`.
3. Deletes the snapshot branch.
4. Refreshes SAP Build Work Zone content channel (saas_approuter) so users see updated HTML5 apps.
5. Sends final success card to Teams.
6. Resets state to IDLE.

**STAGE 8C: ON MERGE CONFLICT**
If sync-back merge fails due to conflicts: labels PR as `APM-02 Blocked`, sends conflict alert to Teams, blocks new deployments until resolved.

#### 5.1.2 Label State Machine

```
[IDLE]
  |
  | @Jarvis deploy
  v
[APM-02 Active]  <-- Cherry-pick window open
  |
  | Window expires / @Jarvis trigger
  v
[APM-02 Deploying]  <-- SAP CI/CD running
  |
  |-- FAILED --> [APM-02 Failed] --(@Jarvis retrigger)--> [APM-02 Deploying]
  |
  |-- CONFLICT --> [APM-02 Blocked] --(resolved manually)--> [APM-02 Deployed]
  |
  | SAP success + main sync-back success
  v
[APM-02 Deployed] --> [IDLE]
```

#### 5.1.3 APM-02 Family Branch Mapping

| Component | Base Branch | Tenant Branch | SAP CI/CD Job | Label Prefix |
| :--- | :--- | :--- | :--- | :--- |
| **APM-02 Core** | `main` | `tenant/asint-apm-02-v2` | `AsInt-APM-02` | `APM-02` |
| **APM-02 DC** | `main-dc` | `tenant/asint-apm-02-dc` | `AsInt-APM-02-DC` | `APM-02 DC` |
| **APM-02 DC AddIn** | `main-dc-addin` | `tenant/asint-apm-02-dc-addin` | `AsInt-APM-02-DC-AddIn` | `APM-02 DC AddIn` |

---

### 5.2 Direct Auto-Merge Pipeline (Standard Tenants)

All other tenant environments use a simpler, faster pipeline that directly merges `dev` into the tenant branch without a snapshot or cherry-pick window.

#### 5.2.1 Workflow Stages

**STAGE 1: TRIGGER**
Developer types "@Jarvis deploy" in the tenant's Teams channel. Jarvis Bot issues a `repository_dispatch` event specific to that tenant (e.g., `trigger_ais02_dc_deployment`).

**STAGE 2: AUTO-MERGE** (_auto_merge.yml)
GitHub Actions receives the event and calls the reusable `_auto_merge.yml` workflow with environment-specific parameters: source branch (`dev`), target branch (tenant branch), deployment name, dashboard URL.

**STAGE 3: BRANCH COMPARISON AND MERGE**
Checks if `dev` and the tenant branch have diverged. If identical ("Already Synced") → sends notification and exits. If different → creates a PR and auto-merges `dev` into tenant branch. Includes CF app stop/restart logic if configured (e.g., APM-01 stops `crawler-layer-backend` before deploy).

**STAGE 4: SAP CI/CD EXECUTION**
The push to the tenant branch triggers the SAP CI/CD build. SAP builds and deploys the MTA to the BTP subaccount.

**STAGE 5: ANS NOTIFICATION TO GITHUB**
SAP ANS sends a webhook event to GitHub with the build result.

**STAGE 6: NOTIFICATION**
`sap_cicd_notifier.yml` processes the event and sends Adaptive Card notifications to the dedicated Teams channel.

**STAGE 7: CONFLICT HANDLING** (if applicable)
If the merge to the tenant branch results in a conflict: GitHub detects the conflict automatically, Conflict Resolver workflow (`auto_merge_conflict_resolver.yml`) engages, sends conflict alert to Teams with manual resolution instructions. Once resolved and PR merged, `auto_merge_approval_handler.yml` closes the loop.

---

## 6. Tenant Environment Catalogue

Below is the complete list of all 15 tenant environments managed by this system, each supporting 3 module variants (Core, DC, DC AddIn), for a total of **45 deployment pipelines**.

### 6.1 Environment Overview Table

| # | Tenant Name | Pipeline Type | Total Variants |
| :---: | :--- | :--- | :---: |
| 1 | **AIS-02** | Direct Auto-Merge | 3 |
| 2 | **APM-01** | Direct Auto-Merge | 3 |
| 3 | **APM-02** | Snapshot-Based | 3 |
| 4 | **APM-EIOT** | Direct Auto-Merge | 3 |
| 5 | **AsInt Demo** | Direct Auto-Merge | 3 |
| 6 | **IRC** | Direct Auto-Merge | 3 |
| 7 | **ST (Staging)** | Direct Auto-Merge | 3 |
| 8 | **Baystar** | Direct Auto-Merge | 3 |
| 9 | **HSC Non-Prod** | Direct Auto-Merge | 3 |
| 10 | **HSC Prod** | Direct Auto-Merge | 3 |
| 11 | **Indorama Prod-900** | Direct Auto-Merge | 3 |
| 12 | **Indorama Prod-933** | Direct Auto-Merge | 3 |
| 13 | **Indorama QA-233** | Direct Auto-Merge | 3 |
| 14 | **Indorama QA-234** | Direct Auto-Merge | 3 |
| 15 | **VMOS** | Direct Auto-Merge | 3 |
| | **TOTAL** | | **45** |

---

### 6.2 Detailed Tenant Branch & Job Mapping

#### AIS-02

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/asint-ais-02` | `AsInt-AIS-02` | `deploy_ais02_dc.yml` |
| DC | `tenant/asint-ais-02-dc` | `AsInt-AIS-02-DC` | `deploy_ais02_dc.yml` |
| DC AddIn | `tenant/asint-ais-02-dc-addin` | `AsInt-AIS-02-DC-AddIn` | `deploy_ais02_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### APM-01

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow | Special |
| :--- | :--- | :--- | :--- | :--- |
| Core | `tenant/asint-apm-01-new` | `AsInt-APM-01` | `deploy_apm01.yml` | Stops/restarts `crawler-layer-backend` CF app |
| DC | `tenant/asint-apm-01-dc` | `AsInt-APM-01-DC` | `deploy_apm01_dc.yml` | |
| DC AddIn | `tenant/asint-apm-01-dc-addin` | `AsInt-APM-01-DC-AddIn` | `deploy_apm01_dc_addin.yml` | |
| **Source Branch** | `dev` (Core: `main`) | | via `_auto_merge.yml` | |

#### APM-02 (SNAPSHOT-BASED PIPELINE)

| Module | Base Branch | Tenant Branch | SAP CI/CD Job | Snapshot Pattern |
| :--- | :--- | :--- | :--- | :--- |
| Core | `main` | `tenant/asint-apm-02-v2` | `AsInt-APM-02` | `snapshot/main-YYMMDD-HHMM` |
| DC | `main-dc` | `tenant/asint-apm-02-dc` | `AsInt-APM-02-DC` | `snapshot/main-dc-YYMMDD-HHMM` |
| DC AddIn | `main-dc-addin` | `tenant/asint-apm-02-dc-addin` | `AsInt-APM-02-DC-AddIn` | `snapshot/main-dc-addin-YYMMDD-HHMM` |
| **Orchestration** | via `apm02_1_create_and_wait.yml` → `apm02_3_finalize_cycle.yml` | | | |

#### APM-EIOT

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `apm-eiot-temp-copy` | `AsInt-APM-EIOT` | `deploy_apm_eiot.yml` |
| DC | `tenant/asint-apm-eiot-dc` | `AsInt-APM-EIOT-DC` | `deploy_apm_eiot_dc.yml` |
| DC AddIn | `tenant/asint-apm-eiot-dc-addin` | `AsInt-APM-EIOT-DC-AddIn` | `deploy_apm_eiot_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### AsInt Demo

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/asint-demo` | `AsInt-DEMO` | `deploy_asint_demo.yml` |
| DC | `tenant/asint-demo-dc` | `AsInt-DEMO-DC` | `deploy_asint_demo_dc.yml` |
| DC AddIn | `tenant/asint-demo-dc-addin` | `AsInt-DEMO-DC-AddIn` | `deploy_asint_demo_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### IRC

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/asint-irc-temp` | `AsInt-IRC` / `IRC` | `deploy_irc.yml` |
| DC | `tenant/irc-dc` | `IRC-DC` | `deploy_irc_dc.yml` |
| DC AddIn | `tenant/irc-dc-addin` | `IRC-DC-AddIn` | `deploy_irc_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### ST Environment (Staging)

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `st-env-for-contentfederation` | `AsInt-ST` | `deploy_st_env.yml` |
| DC | `tenant/asint-st-env-dc` | `AsInt-ST-DC` | `deploy_st_env_dc.yml` |
| DC AddIn | `tenant/asint-st-env-dc-addin` | `AsInt-ST-DC-AddIn` | `deploy_st_env_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### Baystar

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/baystar` | `BAYSTAR` / `Baystar` | `deploy_baystar.yml` |
| DC | `tenant/baystar-dc` | `Baystar-DC` | `deploy_baystar_dc.yml` |
| DC AddIn | `tenant/baystar-dc-addin` | `Baystar-DC-AddIn` | `deploy_baystar_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### HSC Non-Prod (Hemlock Semiconductor)

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/hemlock-non-prod` | `Hemlock-NON-PROD` | `deploy_hsc_non_prod.yml` |
| DC | `tenant/hemlock-non-prod-dc` | `Hemlock-NON-PROD-DC` | `deploy_hsc_non_prod_dc.yml` |
| DC AddIn | `tenant/hemlock-non-prod-dc-addin` | `Hemlock-NON-PROD-DC-AddIn` | `deploy_hsc_non_prod_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### HSC Prod (Hemlock Semiconductor)

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/hemlock-prod` | `Hemlock-PROD` | `deploy_hsc_prod.yml` |
| DC | `tenant/hemlock-prod-dc` | `Hemlock-PROD-DC` | `deploy_hsc_prod_dc.yml` |
| DC AddIn | `tenant/hemlock-prod-dc-addin` | `Hemlock-PROD-DC-AddIn` | `deploy_hsc_prod_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### Indorama Prod-900

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/indorama-prod-900` | `Indorama-PROD-900` | `deploy_indorama_prod_900.yml` |
| DC | `tenant/indorama-prod-900-dc` | `Indorama-PROD-900-DC` | `deploy_indorama_prod_900_dc.yml` |
| DC AddIn | `tenant/indorama-prod-900-dc-addin` | `Indorama-PROD-900-DC-AddIn` | `deploy_indorama_prod_900_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### Indorama Prod-933

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/indorama-prod-933` | `Indorama-PROD-933` | `deploy_indorama_prod_933.yml` |
| DC | `tenant/indorama-prod-933-dc` | `Indorama-PROD-933-DC` | `deploy_indorama_prod_933_dc.yml` |
| DC AddIn | `tenant/indorama-prod-933-dc-addin` | `Indorama-PROD-933-DC-AddIn` | `deploy_indorama_prod_933_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### Indorama QA-233

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/indorama-qa-233` | `Indorama-QA-233` | `deploy_indorama_qa_233.yml` |
| DC | `tenant/indorama-qa-233-dc` | `Indorama-QA-233-DC` | `deploy_indorama_qa_233_dc.yml` |
| DC AddIn | `tenant/indorama-qa-233-dc-addin` | `Indorama-QA-233-DC-AddIn` | `deploy_indorama_qa_233_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### Indorama QA-234

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/indorama-qa-234` | `Indorama-QA-234` | `deploy_indorama_qa_234.yml` |
| DC | `tenant/indorama-qa-234-dc` | `Indorama-QA-234-DC` | `deploy_indorama_qa_234_dc.yml` |
| DC AddIn | `tenant/indorama-qa-234-dc-addin` | `Indorama-QA-234-DC-AddIn` | `deploy_indorama_qa_234_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

#### VMOS

| Module | Tenant Branch | SAP CI/CD Job | Deploy Workflow |
| :--- | :--- | :--- | :--- |
| Core | `tenant/vmos-dev` | `VMOS` | `deploy_vmos.yml` |
| DC | `tenant/vmos-dc` | `VMOS-DC` | `deploy_vmos_dc.yml` |
| DC AddIn | `tenant/vmos-dc-addin` | `VMOS-DC-AddIn` | `deploy_vmos_dc_addin.yml` |
| **Source Branch** | `dev` | | via `_auto_merge.yml` |

---

## 7. Workflow File Reference

### 7.1 Core Reusable Workflows

| File | Type | Purpose |
| :--- | :--- | :--- |
| `_auto_merge.yml` | Reusable (called) | Core logic for direct auto-merge: branch comparison, PR creation, merge, conflict detection |
| `_apm02_notify.yml` | Reusable (called) | APM-02 Teams notification dispatcher — routes Adaptive Cards to the correct channel |
| `_cf_app_control.yml` | Reusable (called) | Cloud Foundry app lifecycle management (stop / start / status) — used by APM-01 |

### 7.2 APM-02 Family Workflows

| File | Stage | Description |
| :--- | :--- | :--- |
| `apm02_1_create_and_wait.yml` | 1 & 2 | Guard check, snapshot creation, cherry-pick window, tenant merge trigger |
| `apm02_2_extend_wait.yml` | 1 (extension) | Extends the active cherry-pick window when "@Jarvis extend" is issued |
| `apm02_3_finalize_cycle.yml` | 3 (success path) | Merge-back to main, snapshot deletion, BWZ refresh, success notification |
| `apm02_4_conflict_monitor.yml` | 3 (conflict path) | Monitors tenant branch for merge conflicts after push |
| `apm02_5_apm02_conflict_monitor.yml` | 3 (conflict path) | Secondary conflict detection layer for APM-02 specifically |
| `apm02_6_recovery.yml` | Recovery | Manual recovery workflow for failed or stuck deployments |

### 7.3 SAP CI/CD Notification Workflows

| File | Trigger | Description |
| :--- | :--- | :--- |
| `sap_cicd_notifier.yml` | `repository_dispatch: sap_cicd_*` | Processes SAP ANS webhook events; routes notifications to the correct Teams channel based on SAP job name |
| `simulate_sap_webhook.yml` | `workflow_dispatch` | Testing utility — simulates SAP CI/CD webhook events without a real build |

### 7.4 Auto-Merge Support Workflows

| File | Trigger | Description |
| :--- | :--- | :--- |
| `auto_merge_conflict_resolver.yml` | `pull_request` events | Detects conflicts in tenant branch PRs; sends conflict alert to Teams |
| `auto_merge_approval_handler.yml` | PR approval / merge | Handles post-conflict merge approval flow |

### 7.5 Tenant Dispatch Workflows (45 total)

Each tenant has up to 3 dispatch workflow files (Core, DC, DC AddIn) following the naming pattern `deploy_<tenant>_<variant>.yml`. Each workflow file simply receives the dispatch event and calls `_auto_merge.yml` with environment-specific parameters (target branch, deployment name, dashboard URL, CF app name if applicable).

### 7.6 Supporting Scripts (in `.github/scripts/`)

| Script | Language | Purpose |
| :--- | :--- | :--- |
| `notify_sap_event.sh` | Bash | Processes SAP CI/CD ANS events; validates job names against a 45-job whitelist; builds and sends Adaptive Card payloads to Teams |
| `resolve_teams_webhooks.sh` | Bash | Centralized webhook URL resolver — maps environment names to the correct `TEAMS_WEBHOOK_*` secret(s). All auto-merge workflows source this single script. |
| `notify_auto_merge.sh` | Bash | Builds Teams notification cards for auto-merge events (started, success, conflict, already-synced) |
| `notify_approval_handler.sh` | Bash | Builds Teams cards for conflict approval workflow notifications |
| `notify_conflict_resolved.sh` | Bash | Builds Teams cards for conflict resolution confirmation |
| `update_wiki.js` | Node.js | Updates per-environment GitHub Wiki pages with deployment history |
| `update_wiki_global.js` | Node.js | Updates the global deployment history Wiki page across all environments |

---

## 8. Notification & Alerting System

### 8.1 Microsoft Teams Integration

Every deployment event generates an Adaptive Card notification posted to the dedicated MS Teams channel for that environment. Notifications are delivered via Incoming Webhook URLs stored as GitHub Repository Secrets.

Each environment supports up to **3 webhook URLs** (`TEAMS_WEBHOOK_<ENV>_1`, `_2`, `_3`), allowing notifications to be broadcast to multiple Teams channels simultaneously (e.g., a dev channel and a client-facing channel).

### 8.2 Notification Events

| Event | When Triggered | Card Content |
| :--- | :--- | :--- |
| **Deployment Window Open** | Snapshot created (APM-02) | Environment name, snapshot branch, scheduled deploy time, cherry-pick instructions |
| **SAP CI/CD Started** | SAP build begins | Job name, environment, trigger commit ID, SAP dashboard link |
| **SAP CI/CD Succeeded** | SAP build completes successfully | Environment, commit ID, build duration, SAP dashboard link |
| **SAP CI/CD Failed** | SAP build fails | Failure reason, error details, "@Jarvis retrigger" and "@Jarvis cancel" action buttons |
| **Deployment Cycle Complete** | Full cycle finishes (APM-02) | Snapshot branch (deleted), PR link, cycle duration |
| **Merge Conflict Detected** | Auto-merge fails due to conflicts | Conflicting files, resolution instructions, PR link |
| **Already Synced** | dev and tenant branch are identical | No-op notification confirming no deployment was needed |
| **Window Extended** | "@Jarvis extend" issued | New scheduled deploy time |
| **Recovery Complete** | Recovery workflow succeeds | Recovery details, new deployment status |

### 8.3 SAP Alert Notification Service (ANS) Integration

SAP CI/CD Service sends real-time events to GitHub via SAP ANS (Alert Notification Service). The webhook endpoint is configured in the ANS service to call GitHub's `repository_dispatch` API. Events received include:

- `sap_cicd_started` — build has started
- `sap_cicd_finished` — build has completed (with status SUCCESS or FAILURE)

The `sap_cicd_notifier.yml` workflow validates the incoming SAP job name against a whitelist of **45 allowed jobs** before processing any notification. Unrecognized jobs are silently ignored.

---

## 9. Jarvis Bot Command Reference

Jarvis is a Google Cloud Run-based chatbot that interprets natural language commands from MS Teams and dispatches the appropriate GitHub Actions workflows.

| Command | Channel | Action |
| :--- | :--- | :--- |
| `@Jarvis deploy` | Any tenant channel | Triggers a new deployment for that environment |
| `@Jarvis extend <minutes>` | APM-02 channel (during active window) | Extends the cherry-pick window by the specified number of minutes |
| `@Jarvis retrigger` | APM-02 channel (after failure) | Re-triggers the failed SAP CI/CD build and resumes automatic tracking |
| `@Jarvis cancel` | APM-02 channel (before tenant merge) | Cancels an active snapshot before it is merged to the tenant branch |
| `@Jarvis status` | Any tenant channel | Reports the current deployment state of that environment |

---

## 10. Deployment State Management

### 10.1 Concurrency Control via GitHub PR Labels

The system uses GitHub Pull Request labels as a distributed state machine to prevent race conditions and duplicate deployments. The guard job at the start of every pipeline checks for active labels before allowing a new deployment to proceed.

| Label | Meaning | Blocks New Deployment? |
| :--- | :--- | :--- |
| `<ENV> Active` | Snapshot created; cherry-pick window open | YES |
| `<ENV> Deploying` | SAP CI/CD build in progress | YES |
| `<ENV> Failed` | SAP build failed; awaiting action | YES |
| `<ENV> Blocked` | Merge conflict detected; awaiting resolution | YES |
| `<ENV> Deployed` | Successful deployment, cycle closing | YES (briefly) |
| (No label / closed PR) | IDLE — ready for new deployment | NO |

### 10.2 GitHub Wiki — Deployment History

After every deployment cycle, the `update_wiki.js` and `update_wiki_global.js` scripts automatically update the repository's GitHub Wiki with:

- Deployment timestamp (IST timezone)
- Snapshot branch name
- PR number and link
- Deployment result (Success / Failed)
- Commit ID deployed

---

## 11. Operational Procedures & Rules

### 11.1 Golden Rules

1. **Never commit directly to a tenant branch.** Code enters tenant branches only via automated GitHub Actions merge processes.

2. **Never leave a deployment in a Failed or Active state indefinitely.** The concurrency guard prevents any new deployment until the stuck state is resolved via the Recovery workflow or by manually closing the PR.

3. **Always keep base branches (`main`, `main-dc`, `main-dc-addin`) in sync** with the latest `.github/workflows` files from `dev`. If base branches are out of date, snapshot branches created from them will run outdated workflow definitions.

4. **Always push workflow changes to both `dev` AND `main`** before triggering a deployment via Jarvis. GitHub Actions `repository_dispatch` events run workflows from the default branch only.

### 11.2 Onboarding a New Environment

When onboarding a new tenant environment, ALL of the following components must be updated simultaneously. Partial updates cause silent failures.

| Step | Component | File / Location |
| :---: | :--- | :--- |
| 1 | GCP Jarvis Bot configuration | `gcp/environments.js` |
| 2 | GitHub Secrets | `TEAMS_WEBHOOK_<ENV>_1`, `_2`, `_3` in repo settings |
| 3 | SAP CI/CD Notifier whitelist | `sap_cicd_notifier.yml` + `notify_sap_event.sh` |
| 4 | Webhook resolver | `resolve_teams_webhooks.sh` |
| 5 | Deploy workflow files | `deploy_<env>.yml`, `deploy_<env>_dc.yml`, `deploy_<env>_dc_addin.yml` |
| 6 | APM-02 notify routing (if APM-02 family) | `_apm02_notify.yml` |
| 7 | Simulate webhook testing | `simulate_sap_webhook.yml` |
| 8 | Push to both `dev` and `main` | Git push both branches |

> Refer to `.github/NEW_ENVIRONMENT_CHECKLIST.md` for the complete step-by-step checklist with code snippets.

### 11.3 Pre-Go-Live Testing Procedure

Before declaring any new environment onboarding complete:

1. Run `[Test] Simulate SAP Webhook` workflow with event type `sap_cicd_started` → verify the "SAP CI/CD Started" Adaptive Card appears in the dedicated Teams channel (not just the Global channel).
2. Run `[Test] Simulate SAP Webhook` with `sap_cicd_finished` (Status: SUCCESS) → verify the "Succeeded" card appears in the correct channel.
3. Type `@Jarvis deploy` in the dedicated Teams channel → verify: snapshot branch is created with correct labels, Tracking PR appears with correct environment name, Teams notification posts to the correct channel.

### 11.4 Known Pitfalls & Prevention

| # | Issue | Root Cause | Prevention |
| :---: | :--- | :--- | :--- |
| 1 | Notification goes to Global channel only | Secret omitted from `sap_cicd_notifier.yml` env block OR case missing in `notify_sap_event.sh` | Update BOTH files simultaneously |
| 2 | `jq` crashes with undefined variable | Used `\($env_name)` in jq template but only passed `--arg env_name` to one of multiple jq calls | Pass `--arg env_name "$ENV_NAME"` to every `jq -n` call that references the variable |
| 3 | Notification job silently skipped | Used bare `if: success()` — fails when sibling jobs skip | Always use `if: always() && needs.<job>.result == 'success'` |
| 4 | Snapshot closes immediately as "Already Synced" | Base branch and tenant branch are identical at the time of snapshot | Ensure at least one real code change exists in the snapshot branch for testing |
| 5 | Workflow not triggering after config change | `repository_dispatch` runs from default branch (`main` or `dev`) — unpushed changes are invisible | Always push to `dev` AND `main` before triggering via Jarvis |
| 6 | CRLF line ending errors on Linux runners | `.sh` scripts edited on Windows saved with CRLF endings | `.gitattributes` enforces `*.sh text eol=lf`. Always use LF endings. |
| 7 | Recovery workflow targets wrong failed PR | Hardcoded label `APM-02 Failed` instead of dynamic label | Always use `"${LABEL_PREFIX} Failed"` — never hardcode environment names in query strings |
| 8 | Script not found: `chmod: cannot access '.github/scripts/...'` | Workflow checked out a tenant/snapshot branch that does not contain `.github/scripts/` | Add an "Ensure Workflow Automation Scripts" step that fetches scripts from the default branch |

---

*End of Document*

---

**Document Classification:** Internal — DevOps / Engineering Team  
**Last Updated:** October 2026
