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

if __name__ == "__main__":
    sys.path.insert(0, os.path.join(os.getcwd(), '_project_'))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "_project_.settings.development")

    with chdir('_project_'):
        from django.core.management import execute_from_command_line
        execute_from_command_line(sys.argv)
