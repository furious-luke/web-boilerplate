#!/bin/bash -e
WEB_HASH=$(docker images | grep -E '^agent_web' | awk '{ print $3 }')
WORKER_HASH=$(docker images | grep -E '^agent_worker' | awk '{ print $3 }')
BACKUPWORKER_HASH=$(docker images | grep -E '^agent_backupworker' | awk '{ print $3 }')
set -x
docker tag $WEB_HASH registry.heroku.com/abas-agent/web
docker tag $WORKER_HASH registry.heroku.com/abas-agent/worker
docker tag $BACKUPWORKER_HASH registry.heroku.com/abas-agent/backupworker
docker push registry.heroku.com/abas-agent/web
docker push registry.heroku.com/abas-agent/worker
docker push registry.heroku.com/abas-agent/backupworker
