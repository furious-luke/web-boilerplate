import os
import shutil
import tempfile
import datetime
import binascii
from string import Template

from fabric.api import run, task, local, shell_env
import boto3
from boto.s3.key import Key


BASE_CONFIG = {
    'compose': 'docker-compose -f $compose_file -f $compose_project_file -p $docker_project',
    'compose_project_file': 'docker-compose.project.yml',
    'run': '$compose run --rm --service-ports $service /sbin/my_init --skip-runit --',
    'service': 'worker'
}

DEV_CONFIG = {
    'docker_project': '${project}_dev',
    'compose_file': 'boilerplate/docker/docker-compose.development.yml',
    'manage': '$run python3 -W ignore manage.py',
    'coverage': '$run coverage run --source="$project" manage.py test',
    'covhtml': '$run coverage html'
}

PROD_CONFIG = {
    'docker_project': '$project',
    'compose_file': 'boilerplate/docker/docker-compose.cedar.yml',
    'run': '$compose run --rm --service-ports $service',
    'manage': '$run python3 -W ignore manage.py'
}


def merge_cfgs(*args):
    x = {}
    for a in args:
        x.update(a)
    while 1:
        done = True
        y = {}
        for k, v in x.items():
            y[k] = Template(v).safe_substitute(x)
            if y[k] != v:
                done = False
        x = y
        if done:
            break
    return x


def dev_cfg(*args):
    return merge_cfgs(BASE_CONFIG, DEV_CONFIG, *args)


def prod_cfg(*args):
    return merge_cfgs(BASE_CONFIG, PROD_CONFIG, *args)


def run_cfg(cmd, dev=True, capture=False, **kwargs):
    cfg = dev_cfg(kwargs) if dev else prod_cfg(kwargs)
    cmd = Template(cmd).substitute(cfg)
    # print(cmd)
    return local(cmd, capture=capture)


def get_aws_creds(profile):
    with open(os.path.expanduser('~/.aws/credentials')) as file:
        for line in file:
            if line.strip() != '[%s]' % profile:
                continue
            access = next(file).strip().replace(' ', '').split('=')
            secret = next(file).strip().replace(' ', '').split('=')
            return (access, secret)
    return (('', ''), ('', ''))


def aws_profile(profile):
    env = {}
    if profile:
        access, secret = get_aws_creds(profile)
        env[access[0].upper()] = access[1]
        env[secret[0].upper()] = secret[1]
    return env


@task
def build(no_cache=False, prod=False):
    """Build the docker containers.

    Need to use a shitty hack to get around symlinks. Use tar to
    convert symlinked directories into the actual data.
    """
    def _build(prod):
        opts = ''
        if no_cache:
            opts += ' --no-cache'
        run_cfg('$compose build{}'.format(opts), not prod)
    if prod:
        old_dir = os.getcwd()
        new_dir = tempfile.mkdtemp()
        os.system('tar ch . | tar xC {}'.format(new_dir))
        os.chdir(new_dir)
        try:
            _build(prod)
        finally:
            os.chdir(old_dir)
            shutil.rmtree(new_dir)
    else:
        _build(prod)

@task
def up(service=None, prod=False):
    """Launch the server.
    """
    cmd = '$compose up'
    if service:
        cmd += ' ' + service
    run_cfg(cmd, not prod)


@task
def logs():
    """
    """
    run_cfg('$compose logs', True)


@task(alias='ut')
def unit_test(module=''):
    """Run unit-tests.
    """
    run_cfg('$manage test {}'.format(module))


@task(alias='cov')
def coverage(module=''):
    """Run unit-tests.
    """
    run_cfg('$coverage {}'.format(module))
    run_cfg('$covhtml')


@task(alias='it')
def integration_test():
    run('{test} test --test=integration'.format(**CONFIG))


@task(alias='nt')
def node_test():
    run('{run} npm run test'.format(**CONFIG))


# @task
# def run(cmd):
#     run('{run} {}'.format(cmd, **CONFIG))


@task
def manage(cmd, prod=False):
    """Run a management command.
    """
    run_cfg('$manage {}'.format(cmd), not prod)


@task(alias='sp')
def shell_plus():
    manage('shell_plus')


@task
def migrate(prod=False):
    """Migrate the database.
    """
    run_cfg('$manage migrate', not prod)


@task(alias='mm')
def make_migrations():
    """Check for outdated models.
    """
    manage('makemigrations')


@task
def reset_db():
    """Reset the database.
    """
    manage('reset_db')


@task(alias='csu')
def create_superuser():
    """Create a super user.
    """
    manage('createsuperuser')


@task
def pdb(prod=False):
    """Run with options to support pdb.
    """
    run_cfg('$run python3 manage.py runserver 0.0.0.0:8000', not prod, service='web')


@task
def cli(service='web', prod=False):
    """Open a terminal in the container.
    """
    run_cfg('$run bash', not prod, service=service)


@task(alias='sb')
def setup_bucket():
    """Prepare an S3 bucket.
    """
    input('Warning: Please set your default AWS account appropriately. '
          'Press enter to continue...')

    s3 = boto3.resource('s3')
    bucket_name = '{}-static'.format(BASE_CONFIG['project'])
    bucket = s3.create_bucket(Bucket=bucket_name)

    cors = bucket.Cors()
    cors.put(CORSConfiguration={
        'CORSRules': [{
            'AllowedMethods': ['GET'],
            'AllowedOrigins': ['*'],
            'MaxAgeSeconds': 3000,
            'AllowedHeaders': ['Authorization'],
        }]
    })
    cors.delete()

    with open('boilerplate/scripts/bucket-policy-public.json', 'r') as inf:
        data = Template(inf.read()).substitute(bucket_name=bucket_name)
    policy = bucket.Policy()
    policy.put(Policy=data)
    policy.delete()


@task(alias='cs')
def collect_static(profile=None):
    """Collect static files (usually to S3).
    """
    profile = profile or BASE_CONFIG['aws_profile']
    env = aws_profile(profile)
    with shell_env(**env):
        run_cfg('$manage collectstatic', False, service='web')


@task
def deploy():
    """Deploy production to Heroku.
    """
    run('./scripts/release.sh')


@task
def down(prod=False):
    """Stop all running containers.
    """
    run_cfg('$compose stop', not prod)


@task
def kill(prod=False):
    """Remove containers.
    """
    down()
    run_cfg('$compose rm -fv', not prod)


@task
def dump_db(filename):
    run_cfg('$compose up -d db')
    res = run_cfg('$compose ps | grep db | awk \'{{print $$1}}\' | head -n1',
                  capture=True)
    db_name = res.strip()
    cmd = ('pg_dump -Fc --no-acl --no-owner -h 0.0.0.0 -U postgres postgres > '
           '/share/{filename}').format(filename=filename)
    fullcmd = 'docker exec {container_name} sh -c "{cmd}"'.format(
        container_name=db_name, cmd=cmd
    )
    res = local(fullcmd, capture=True)
    run_cfg('$compose stop db')


@task
def upload_s3(filename, bucket_name, remote_key):
    s3 = boto3.client('s3')
    s3.upload_file(filename, bucket_name, remote_key)
    url = s3.generate_presigned_url('get_object', Params={
        'Bucket': bucket_name, 'Key': remote_key
    })
    return url


@task
def deploy_db(app, bucket_name):
    now = datetime.datetime.now()
    filename = 'db-{}.dump'.format(now.strftime('%Y%m%d%H%M'))
    dump_db(filename)
    remote_key = 'imports/{}.dump'.format(now.strftime('%Y%m%d%h%i'))
    filename = 'var/{}'.format(filename)
    s3path = upload_s3(filename, bucket_name, remote_key)
    local('heroku pg:backups -a {app} restore "{filename}" DATABASE_URL'.format(filename=s3path, app=app))


@task
def remote(cmd, app=None):
    app = app or BASE_CONFIG['app']
    local('heroku run {} -a {}'.format(cmd, app))


@task(alias='rman')
def remote_manage(cmd, app=None):
    app = app or BASE_CONFIG['app']
    local('heroku run python3 manage.py {} -a {}'.format(cmd, app))


@task
def init_addons(app=None):
    app = app or BASE_CONFIG['app']
    local('heroku addons:create heroku-postgresql:hobby-dev -a {}'.format(app))
    local('heroku addons:create heroku-redis:hobby-dev -a {}'.format(app))


@task
def init_config(app=None, profile=None):
    profile = profile or BASE_CONFIG['aws_profile']
    app = app or BASE_CONFIG['app']
    access, secret = get_aws_creds(profile)
    cfg = [
        'WEB_THREADS=2',
        'WORKER_PROCESSES=1',
        'WORKER_THREADS=0',
        'SECRET_KEY={}'.format(binascii.hexlify(os.urandom(24)).decode()),
        'AWS_ACCESS_KEY_ID={}'.format(access[1]),
        'AWS_SECRET_ACCESS_KEY={}'.format(secret[1])
    ]
    local('heroku config:set {} -a {}'.format(' '.join(cfg), app))


@task
def create_app(app=None):
    app = app or BASE_CONFIG['app']
    local('heroku create {}'.format(app))
    init_addons(app)
    init_config(app)
