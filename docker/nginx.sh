#!/bin/bash
envsubst '$WORKER_PROCESSES $WORKER_CONNECTIONS $SERVER_NAME $UPSTREAM $PORT' < /etc/nginx/templ/nginx.conf > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'
