#!/bin/bash

# Connect to the cluster.
echo ECS_CLUSTER=$app >> /etc/ecs/ecs.config

# # Bind to non-local IP address.
# echo net.ipv4.ip_nonlocal_bind = 1 >> /etc/sysctl.conf

# Install letsencrypt.
curl https://bootstrap.pypa.io/get-pip.py | python
yum -y install git
git clone https://github.com/letsencrypt/letsencrypt /opt/letsencrypt

# # Enable logging. Note: Not needed for ECS.
# curl https://s3.amazonaws.com/aws-cloudwatch/downloads/latest/awslogs-agent-setup.py -O
# chmod +x ./awslogs-agent-setup.py
# ./awslogs-agent-setup.py -n -r $aws_region -c s3://$aws_config_bucket/log-agent.cfg
