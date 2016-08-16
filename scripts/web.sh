#!/bin/sh
# gunicorn --workers 1 $WSGI_APP
daphne $ASGI_APP
