#!/bin/sh
supervisord -c scripts/web.conf
# daphne $ASGI_APP -b 0.0.0.0 -p $PORT
