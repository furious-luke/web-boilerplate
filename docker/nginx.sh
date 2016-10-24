#!/bin/bash

# Generate our upstream string.
WEB_PROCESSES=3
UPSTREAM=
for ii in $(seq 0 $(($WEB_PROCESSES - 1))); do
    x=$(printf "80%02d" $ii)
    UPSTREAM="$UPSTREAM server 0.0.0.0:$x;"
done
export UPSTREAM

envsubst '$WORKER_PROCESSES $WORKER_CONNECTIONS $SERVER_NAME $UPSTREAM $PORT' < /etc/nginx/templ/nginx.conf > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'
