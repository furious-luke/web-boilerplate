#!/bin/bash

# Wait for at least one of the Daphne servers to come online.
echo Waiting for Daphne ...
while ! timeout 1 bash -c "echo > /dev/tcp/localhost/8000"; do
    sleep 5
done
echo Daphne server responding at 8000.

# Generate our upstream string.
UPSTREAM=
for ii in $(seq 0 $(($WEB_PROCESSES - 1))); do
    x=$(printf "80%02d" $ii)
    UPSTREAM="$UPSTREAM server 0.0.0.0:$x;"
done
export UPSTREAM

envsubst '$SERVER_NAME $UPSTREAM $PORT' < /etc/nginx/templ/nginx.conf > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'
