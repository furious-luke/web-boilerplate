#!/bin/bash
cd /usr/local/app
umask 0002
exec supervisord -c scripts/worker.conf  # 2>&1 | logger  # >> /var/log/worker.log 2>&1
