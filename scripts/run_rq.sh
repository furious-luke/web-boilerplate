#!/bin/sh

SHORT_WORKERS=1
DEFAULT_WORKERS=3
PYTHON=python3

$PYTHON manage.py rqscheduler --retry &

NEED_WORKERS=$SHORT_WORKERS
until [ $NEED_WORKERS -lt 1 ]; do 
    $PYTHON manage.py rqworker short --retry &
    NEED_WORKERS=$(($NEED_WORKERS - 1))
done

NEED_WORKERS=$DEFAULT_WORKERS
until [ $NEED_WORKERS -lt 1 ]; do 
    $PYTHON manage.py rqworker default --retry &
    NEED_WORKERS=$(($NEED_WORKERS - 1))
done

# Note: `sleep infinity` is not recognised in Alpine Linux.
# sleep infinity
while [ 1 ]; do
    sleep 60
done
