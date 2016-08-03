#!/bin/bash -e
WEB_HASH=$(docker images | grep -E '^${project}_web' | awk '{ print $3 }')
WORKER_HASH=$(docker images | grep -E '^${project}_worker' | awk '{ print $3 }')
set -x
docker tag $WEB_HASH registry.heroku.com/${project}/web
docker tag $WORKER_HASH registry.heroku.com/${project}/worker
docker push registry.heroku.com/${project}/web
docker push registry.heroku.com/${project}/worker
