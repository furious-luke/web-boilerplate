#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# NOTE: Because we use Python's Template substitution on this file, all dollar signs
# must be escaped with another dollar sign: i.e. $$.

# Prepare some packages.
pacman -Syy
pacman --noconfirm -S docker unzip python-pip git

# Install awscli and credentials for various AWS purposes.
pip install awscli python-dotenv
pip install -e git+https://github.com/jtrh/python-dotenv@fix-dotenv-list-for-loop#egg=python-dotenv

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

# Setup some default keys to use before we have a DNS, and
# haven't run certbot yet.
mkdir -p /etc/letsencrypt/default
openssl req -x509 -newkey rsa:2048 -keyout /etc/letsencrypt/default/privkey.key -out /etc/letsencrypt/default/cert.pem -nodes -subj '/CN=localhost'
cat /etc/letsencrypt/default/privkey.key /etc/letsencrypt/default/cert.pem > /etc/letsencrypt/default/fullchain.pem

# Setup the base level application. This will eventually be
# replaced by something more intelligent that can launch and
# maintain multiple containers.
cat > /usr/bin/app <<EOF
#!/bin/bash
/usr/bin/docker run --rm --env-file /root/app.env app "\$$\@"
EOF
chmod u+x /usr/bin/app
cat > /etc/systemd/system/app.service <<EOF
[Unit]
Description=The App
Requires=docker.service
After=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/docker run --name app --rm --env-file /root/app.env -v /var/lib/letsencrypt:/var/lib/letsencrypt -v /etc/letsencrypt/default:/etc/nginx/keys -p 80:80 -p 443:443 app
ExecReload=/usr/bin/docker stop app

[Install]
WantedBy=multi-user.target
EOF
cat > /root/app.env <<EOF
SECRET_KEY=$secret_key
WEB_PROCESSES=1
WEB_THREADS=1
WORKER_PROCESSES=1
WORKER_THREADS=1
EOF
systemctl enable app.service
