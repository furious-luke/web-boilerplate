#!/bin/sh

gunicorn --workers 1 abas.wsgi:application
