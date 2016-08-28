#!/bin/bash -e
HEROKU=
DOCKER=
WEB_HASH=$(docker images | grep -E "^${DOCKER}_web" | awk '{ print $3 }')
WORKER_HASH=$(docker images | grep -E "^${DOCKER}_worker" | awk '{ print $3 }')
set -x
docker tag $WEB_HASH registry.heroku.com/${HEROKU}/web
docker tag $WORKER_HASH registry.heroku.com/${HEROKU}/worker
docker push registry.heroku.com/${HEROKU}/web
docker push registry.heroku.com/${HEROKU}/worker
