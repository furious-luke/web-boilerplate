#!/bin/bash
openssl req -x509 -newkey rsa:2048 -keyout keys/dev.key -out keys/dev.cert -nodes -subj '/CN=localhost'
