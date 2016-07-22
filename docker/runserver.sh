#!/bin/bash
cd /usr/local/app
umask 0002
exec python3 manage.py runserver 0.0.0.0:8000  # 2>&1 | logger  # >> /var/log/runserver.log 2>&1
