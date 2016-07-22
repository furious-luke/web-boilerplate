#!/bin/bash
cd /usr/local/app
umask 0002
exec supervisord -c ./boilerplate/scripts/worker.conf  # >> /var/log/runworker.log 2>&1
