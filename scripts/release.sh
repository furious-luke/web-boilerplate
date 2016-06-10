#!/bin/bash -e
WEB_HASH=$(docker images | grep -E '^_project__web' | awk '{ print $3 }')
WORKER_HASH=$(docker images | grep -E '^_project__worker' | awk '{ print $3 }')
set -x
docker tag $WEB_HASH registry.heroku.com/_project_/web
docker tag $WORKER_HASH registry.heroku.com/_project_/worker
docker push registry.heroku.com/_project_/web
docker push registry.heroku.com/_project_/worker
