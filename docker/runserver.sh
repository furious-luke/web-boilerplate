#!/bin/sh
# export HOME=/usr/local/app
# cd $HOME
cd /usr/local/app
exec python3 manage.py runserver 0.0.0.0:8000 #>> /var/log/runserver.log 2>&1
