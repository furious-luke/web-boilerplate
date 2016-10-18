#!/bin/bash
openssl req -x509 -newkey rsa:2048 -keyout keys/privkey.key -out keys/cert.pem -nodes -subj '/CN=localhost'
cat keys/privkey.key keys/cert.pem > keys/fullchain.pem
