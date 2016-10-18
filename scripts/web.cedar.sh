#!/bin/sh
daphne $ASGI_APP -b 0.0.0.0 -p $PORT
