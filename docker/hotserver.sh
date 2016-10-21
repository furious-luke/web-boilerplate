#!/bin/bash
cd /app
umask 0002
exec npm run hot  # 2>&1 >> /var/log/hotserver.log 2>&1
