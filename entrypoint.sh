#!/bin/sh
set -e

# Map GitHub Action inputs (passed as env vars by the action runtime)
export OPENROUTER_API_KEY="${INPUT_OPENROUTER_API_KEY}"
export GITHUB_TOKEN="${INPUT_GITHUB_TOKEN}"

if [ -n "${INPUT_OPENROUTER_MODEL}" ]; then
  export OPENROUTER_MODEL="${INPUT_OPENROUTER_MODEL}"
fi

# Install the checked-out project's dependencies
if [ -f "package-lock.json" ]; then
  npm ci
elif [ -f "yarn.lock" ]; then
  yarn install --frozen-lockfile
elif [ -f "pnpm-lock.yaml" ]; then
  npx pnpm install --frozen-lockfile
else
  npm install
fi

# Run prdemo
if [ "${INPUT_POST}" = "true" ]; then
  prdemo run --post
else
  prdemo run
fi
