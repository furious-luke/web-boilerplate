#!/bin/sh

# For AWS
# supervisord -c scripts/web.conf

# For Heroku
daphne $ASGI_APP -b 0.0.0.0 -p $PORT
