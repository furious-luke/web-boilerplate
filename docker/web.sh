#!/bin/bash
cd /usr/local/app
OPTS=("-b 0.0.0.0:$PORT" "--workers=$WEB_CONCURRENCY")
if [ -n ${KEYFILE+x} ]; then
    OPTS+=("--keyfile=$KEYFILE")
fi
if [ -n ${CERTFILE+x} ]; then
    OPTS+=("--certfile=$CERTFILE")
fi
OPTS=$(printf " %s" "${OPTS[@]}")
OPTS=${OPTS:1}
exec gunicorn abas.wsgi:application $OPTS  #>> /var/log/runserver.log 2>&1
