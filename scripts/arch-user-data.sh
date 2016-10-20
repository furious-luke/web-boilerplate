#!/bin/bash
pacman -Syy
pacman --noconfirm -S docker
systemctl enable docker
systemctl start docker
