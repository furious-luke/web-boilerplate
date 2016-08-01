#!/usr/bin/env python
import os
import stat
import shutil
import argparse
import subprocess
from string import Template


def copy_file(src, dst, data=None):
    if not os.path.exists(dst):
        if data:
            with open(src, 'r') as in_f:
                content = in_f.read()
            content = Template(content).substitute(**data)
            with open(dst, 'w') as out_f:
                out_f.write(content)
        elif os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copyfile(src, dst)
    else:
        print('skipping {}'.format(src))

def copy_files(files, data=None):
    for info in files:
        if isinstance(info, tuple):
            src, dst = info
        else:
            src = info
            dst = os.path.basename(src)
        src = os.path.join('boilerplate', src)
        copy_file(src, dst, data)

def symlink_files(files):
    for info in files:
        if isinstance(info, tuple):
            src, dst = info
        else:
            src = info
            dst = os.path.basename(src)
        if not os.path.exists(dst):
            os.symlink(src, dst)
        else:
            print('skipping {}'.format(src))

def update_settings(args):
    path = os.path.join(args.project, args.project, 'settings')
    if os.path.exists(path):
        print('skipping settings')
        return
    data = {
        'project': args.project,
    }
    os.mkdir(path)
    shutil.move(os.path.join(path, '..', 'settings.py'), path)
    os.symlink('../../../boilerplate/settings/boilerplate', os.path.join(path, 'boilerplate'))
    copy_file('boilerplate/settings/project.py', os.path.join(path, 'project.py'), data)
    shutil.copyfile('boilerplate/settings/base.py', os.path.join(path, 'base.py'))
    shutil.copyfile('boilerplate/settings/development.py', os.path.join(path, 'development.py'))
    shutil.copyfile('boilerplate/settings/production.py', os.path.join(path, 'production.py'))
    with open(os.path.join(path, '__init__.py'), 'w') as file:
        pass

def update_urls(args):
    path = os.path.join(args.project, args.project, 'urls')
    if os.path.exists(path):
        print('skipping urls')
        return
    os.mkdir(path)
    os.symlink('../../../boilerplate/urls/boilerplate', os.path.join(path, 'boilerplate'))
    shutil.copyfile('boilerplate/urls/urls.py', os.path.join(path, 'urls.py'))
    shutil.copyfile('boilerplate/urls/router.py', os.path.join(path, 'router.py'))
    shutil.copyfile('boilerplate/urls/__init__.py', os.path.join(path, '__init__.py'))
    os.remove(os.path.join(path, '..', 'urls.py'))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('project')
    args = parser.parse_args()
    data = {
        'project': args.project,
    }
    if not os.path.exists('requirements'):
        os.mkdir('requirements')
    if not os.path.exists('frontend'):
        os.mkdir('frontend')
    symlink_files([
        'boilerplate/.babelrc',
        'boilerplate/webpack',
        'boilerplate/.dockerignore',
        ('../boilerplate/frontend/boilerplate', 'frontend/boilerplate'),
        ('../boilerplate/main', os.path.join(args.project, 'main')),
    ])
    copy_files([
        'package.json',
        ('requirements/base.txt', 'requirements/base.txt'),
        ('requirements/development.txt', 'requirements/development.txt'),
        ('requirements/production.txt', 'requirements/production.txt'),
        ('frontend/components', 'frontend/components'),
        ('frontend/actions', 'frontend/actions'),
        ('frontend/reducers', 'frontend/reducers'),
        ('frontend/routes.jsx', 'frontend/routes.jsx'),
    ])
    copy_files([
        ('local_fabfile.py', 'fabfile.py'),
        'docker/docker-compose.project.yml',
        ('local_manage.py', 'manage.py'),
        '.dockerignore',
        '.gitignore',
    ], data)
    update_settings(args)
    update_urls(args)
    # TODO: Keep existing permissions.
    os.chmod('.', 02775)

    os.chdir('boilerplate')
    try:
        os.mkdir('keys')
    except:
        pass
    subprocess.check_call('./scripts/gen_dev_ssc.sh')
    os.chdir('..')
