#!/bin/bash
cd /usr/local/app
exec ./scripts/run_rq.sh #>> /var/log/runworker.log 2>&1
