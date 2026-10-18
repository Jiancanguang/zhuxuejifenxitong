#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" != 1 || ( "$1" != "--deploy" && "$1" != "--rollback" ) ]]; then
  echo 'Manual deployment only: bash /www/auto-deploy.sh --deploy|--rollback' >&2
  exit 64
fi
exec 9>"${POINTS_DEPLOY_LOCK:-/var/lock/zhuxue-points-deploy.lock}"
flock -n 9 || { echo 'Points deployment already running' >&2; exit 75; }
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ ! -s "$NVM_DIR/nvm.sh" ]] || . "$NVM_DIR/nvm.sh"
exec python3 "$(cd "$(dirname "$0")" && pwd)/deploy-points.py" "$1"
