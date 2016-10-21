#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Prepare some packages.
pacman -Syy
pacman --noconfirm -S docker unzip python-pip

# Install awscli and credentials for various AWS purposes.
pip install awscli

# Configure docker and launch.
sed -i 's/dockerd/dockerd --log-driver=journald/g' /usr/lib/systemd/system/docker.service
systemctl enable docker
systemctl start docker

# Install AWS logging from journald.
curl -sOL https://github.com/saymedia/journald-cloudwatch-logs/releases/download/v0.0.1/journald-cloudwatch-logs-linux.zip && unzip journald-cloudwatch-logs-linux.zip
cp journald-cloudwatch-logs/journald-cloudwatch-logs /usr/bin/
mkdir -p /var/lib/journald-cloudwatch-logs
rm -rf journald-cloudwatch-logs
cat > /etc/journald-cloudwatch-logs.conf <<EOF
log_group = "$project-$layout"
log_priority = "info"
state_file = "/var/lib/journald-cloudwatch-logs/state"
EOF
cat > /etc/systemd/system/journald-cloudwatch-logs.service <<EOF
[Unit]
Description=journald-cloudwatch-logs
Wants=basic.target
After=basic.target network.target

[Service]
ExecStart=/usr/bin/journald-cloudwatch-logs /etc/journald-cloudwatch-logs.conf
KillMode=process
Restart=on-failure
RestartSec=42s

[Install]
WantedBy=multi-user.target
EOF
systemctl enable journald-cloudwatch-logs.service
systemctl start journald-cloudwatch-logs.service

# Setup the base level application. This will eventually be
# replaced by something more intelligent that can launch and
# maintain multiple containers.
touch /root/app.env
cat > /etc/systemd/system/app.service <<EOF
[Unit]
Description=The App
Requires=docker.service
After=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/docker run --rm --name app --env-file /root/app.env -p 80:80 -p 443:443 app
ExecReload=/usr/bin/docker stop app

[Install]
WantedBy=multi-user.target
EOF
systemctl enable app.service
