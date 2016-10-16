import os
import shutil
import tempfile
import datetime
import binascii
import json
from string import Template

from fabric.api import run, task, local, shell_env, warn_only
import boto3
from boto.s3.key import Key


BASE_CONFIG = {
    'compose': 'docker-compose -f $compose_file -f $compose_project_file -p $docker_project',
    'compose_project_file': 'docker-compose.project.yml',
    'run': '$compose run --rm --service-ports $service /sbin/my_init --skip-runit --',
    'service': 'worker',
    'aws': 'aws --profile $aws_profile --region $aws_region'
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
    'compose_file': 'boilerplate/docker/docker-compose.aws.yml',
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
def manage(cmd, prod=False, remote=False):
    """Run a management command.
    """
    if not remote:
        run_cfg('$manage {}'.format(cmd), not prod)
    else:
        remote_manage(cmd)


@task(alias='sp')
def shell_plus():
    manage('shell_plus')


@task
def migrate(prod=False, remote=False):
    """Migrate the database.
    """
    if not remote:
        run_cfg('$manage migrate', not prod)
    else:
        remote_manage('migrate')


@task(alias='mm')
def make_migrations():
    """Check for outdated models.
    """
    manage('makemigrations')


@task
def reset_db(remote=False, db=None):
    """Reset the database.
    """
    if not remote:
        manage('reset_db')
    else:
        if db is None:
            db = 'DATABASE_URL'
        heroku('pg:reset {}'.format(db))


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
def heroku(cmd, app=None):
    app = app or BASE_CONFIG['app']
    local('heroku {} -a {}'.format(cmd, app))


@task
def remote(cmd, app=None):
    app = app or BASE_CONFIG['app']
    local('heroku run {} -a {}'.format(cmd, app))


@task(alias='rem')
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


@task
def setup_ssl(domains=None):
    domains = domains or BASE_CONFIG['domains']
    domains = domains.split(',')
    primary = domains[0]
    local('docker run --rm -it -p 443:443 -p 80:80 --name certbot '
          '-v "/etc/letsencrypt:/etc/letsencrypt" '
          '-v "/var/lib/letsencrypt:/var/lib/letsencrypt" '
          'quay.io/letsencrypt/letsencrypt:latest '
          'certonly --manual -d {} '
          ''.format(
              ' -d '.join(domains)
          ))
    heroku('sudo certs:add --type sni /etc/letsencrypt/live/{primary}-0001/fullchain.pem '
           '/etc/letsencrypt/live/{primary}-0001/privkey.pem'.format(primary=primary))


@task
def renew_ssl(domains=None):
    domains = domains or BASE_CONFIG['domains']
    domains = domains.split(',')
    primary = domains[0]
    local('docker run --rm -p 443:443 -p 80:80 --name certbot '
          '-v "/etc/letsencrypt:/etc/letsencrypt" '
          '-v "/var/lib/letsencrypt:/var/lib/letsencrypt" '
          'quay.io/letsencrypt/letsencrypt:latest '>
          'renew --non-interactive --agree-tos')
    heroku('sudo certs:update /etc/letsencrypt/live/{primary}-0001/fullchain.pem '
           '/etc/letsencrypt/live/{primary}-0001/privkey.pem'.format(primary=primary))


@task
def aws(cmd):
    run_cfg('$aws {}'.format(cmd))


@task
def aws_create_security_group():
    with warn_only():
        run_cfg('$aws ec2 create-security-group --group-name $app'
                ' --description "$project security group"')
        run_cfg('$aws ec2 authorize-security-group-ingress --group-name $app'
                ' --protocol tcp --port 22 --cidr 0.0.0.0/0')
        run_cfg('$aws ec2 authorize-security-group-ingress --group-name $app'
                ' --protocol tcp --port 80 --cidr 0.0.0.0/0')


@task
def aws_docker_login():
    res = run_cfg('$aws ecr get-login', capture=True)
    local(res)


@task
def aws_create_repository(repo=None):
    repo = '$app' if repo is None else repo
    with warn_only():
        run_cfg('$aws ecr create-repository --repository-name {}'.format(repo))


@task
def aws_register_task_definition(family, image, memory=None, env=None):
    memory = '256' if memory is None else memory
    port_mappings = {
        'web': 'portMappings=[{containerPort=80,hostPort=80,protocol="tcp"}]',
    }
    if env is not None:
        env = ['{name=%s,value=%s}' % tuple(e.split('=')) for e in env.split(',')]
        env = 'environment=[%s]' % ','.join(env)
    ctr_def = [
        'name="%s"' % family,
        'image="%s"' % image,
        'essential=true',
        'memoryReservation=%s' % memory,
        port_mappings.get(family, None),
        env
    ]
    ctr_def = ','.join([v for v in ctr_def if v is not None])
    run_cfg('$aws ecs register-task-definition'
            ' --family {}'
            ' --network-mode bridge'
            ' --container-definitions={}'.format(family, ctr_def))


@task
def aws_register_web_task(family, memory=None):
    aws_register_task_definition(
        family,
        '$app',
        env='RUN=%s' % family
    )


@task
def aws_setup():
    aws_create_security_group()
    aws_docker_login()
    aws_create_repository()
    aws_create_repository('nginx')
    with warn_only():
        aws_register_task_definition('web')
        aws_register_task_definition('worker')


@task
def aws_push(repo, ctr):
    res = run_cfg('$aws ecr describe-repositories --repository-names {}'.format(repo), capture=True)
    res = json.loads(res)
    uri = res['repositories'][0]['repositoryUri']
    run_cfg('docker tag {}:latest {}:latest'.format(ctr, uri))
    run_cfg('docker push {}:latest'.format(uri))
