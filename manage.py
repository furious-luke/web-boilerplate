#!/usr/bin/env python
import os
import sys
import contextlib

@contextlib.contextmanager
def chdir(path):
    curdir = os.getcwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(curdir)

def manage(project):
    sys.path.insert(0, os.path.join(os.getcwd(), project))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '{}.settings.development'.format(project))

    with chdir(project):
        from django.core.management import execute_from_command_line
        execute_from_command_line(sys.argv)
