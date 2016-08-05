#!/bin/bash -e
PROJECT=
WEB_HASH=$(docker images | grep -E "^${PROJECT}_web" | awk '{ print $3 }')
WORKER_HASH=$(docker images | grep -E "^${PROJECT}_worker" | awk '{ print $3 }')
set -x
docker tag $WEB_HASH registry.heroku.com/${PROJECT}/web
docker tag $WORKER_HASH registry.heroku.com/${PROJECT}/worker
docker push registry.heroku.com/${PROJECT}/web
docker push registry.heroku.com/${PROJECT}/worker
