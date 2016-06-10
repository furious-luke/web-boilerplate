#!/bin/sh
# export HOME=/usr/local/app
# cd $HOME
cd /usr/local/app
exec npm run hot #>> /var/log/hotserver.log 2>&1
