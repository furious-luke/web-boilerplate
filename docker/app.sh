#!/bin/bash
cd /app
umask 0002
exec supervisord -c /etc/service/app/app.conf  # 2>&1 | logger  # >> /var/log/worker.log 2>&1
