#!/usr/bin/env bash
set -euo pipefail

# Deploy this repository's existing Dockerfile directly to Cloud Run.
# This bypasses AI Studio's publish configuration and explicitly requests 1 vCPU.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${CLOUD_RUN_REGION:-europe-west2}"
SERVICE="${CLOUD_RUN_SERVICE:-financial-platform}"
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Google Cloud CLI (gcloud) is required. Run this from Google Cloud Shell or install the CLI." >&2
  exit 1
fi

if [[ -z "${PROJECT}" || "${PROJECT}" == "(unset)" ]]; then
  echo "No Google Cloud project is selected. Set GOOGLE_CLOUD_PROJECT or run: gcloud config set project PROJECT_ID" >&2
  exit 1
fi

echo "Deploying ${SERVICE} to project ${PROJECT}, region ${REGION}, with 1 vCPU."

gcloud run deploy "${SERVICE}" \
  --source "${ROOT_DIR}" \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --cpu 1 \
  --memory 512Mi \
  --port 8080
