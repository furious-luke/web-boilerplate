#!/bin/sh
# gunicorn --workers 1 $WSGI_APP
daphne $ASGI_APP -b 0.0.0.0 -p $PORT
