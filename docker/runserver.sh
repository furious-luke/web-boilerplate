#!/bin/bash
cd /usr/local/app
# TARGET_GID=$(stat -c "%g" .)
# EXISTS=$(cat /etc/group | grep $TARGET_GID | wc -l)
# if [ $EXISTS == "0" ]; then
#     GROUP=tempgroup
#     groupadd -g $TARGET_GID $GROUP
#     usermod -a -G tempgroup nobody
# else
#     GROUP=$(getent group $TARGET_GID | cut -d: -f1)
#     usermod -a -G $GROUP nobody
# fi
umask 0002
exec python3 manage.py runserver 0.0.0.0:8000 #>> /var/log/runserver.log 2>&1
