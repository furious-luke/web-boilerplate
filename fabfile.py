import os
import shutil
import tempfile
import datetime
from string import Template

from fabric.api import run, task, local
import boto3
from boto.s3.key import Key


BASE_CONFIG = {
    'compose': 'docker-compose -f $compose_file -f $compose_project_file -p $docker_project',
    'compose_project_file': 'docker-compose.project.yml',
    'run': '$compose run --rm --service-ports $service /sbin/my_init --skip-runit --',
    'service': 'web',
}

DEV_CONFIG = {
    'docker_project': '${project}_dev',
    'compose_file': 'boilerplate/docker/docker-compose.development.yml',
    'manage': '$run python3 -W ignore manage.py',
}

PROD_CONFIG = {
    'docker_project': '$project',
    'compose_file': 'boilerplate/docker/docker-compose.cedar.yml',
    'run': '$compose run --rm --service-ports $service',
    'manage': '$run python3 -W ignore manage.py',
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


@task
def build(no_cache=False, production=False):
    """Build the docker containers.

    Need to use a shitty hack to get around symlinks. Use tar to
    convert symlinked directories into the actual data.
    """
    def _build(production):
        opts = ''
        if no_cache:
            opts += ' --no-cache'
        run_cfg('$compose build{}'.format(opts), not production)
    if production:
        old_dir = os.getcwd()
        new_dir = tempfile.mkdtemp()
        os.system('tar ch . | tar xC {}'.format(new_dir))
        os.chdir(new_dir)
        try:
            _build(production)
        finally:
            os.chdir(old_dir)
            shutil.rmtree(new_dir)
    else:
        _build(production)

@task
def up(service=None, production=False):
    """Launch the server.
    """
    cmd = '$compose up'
    if service:
        cmd += ' ' + service
    run_cfg(cmd, not production)


@task
def logs():
    """
    """
    run_cfg('$compose logs', True)


@task(alias='ut')
def unit_test():
    """Run unit-tests.
    """
    run_cfg('$manage test')


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
def manage(cmd, production=False):
    """Run a management command.
    """
    run_cfg('$manage {}'.format(cmd), not production)


@task(alias='sp')
def shell_plus():
    manage('shell_plus')


@task
def migrate(production=False):
    """Migrate the database.
    """
    run_cfg('$manage migrate', not production)


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


@task
def pdb(production=False):
    """Run with options to support pdb.
    """
    run_cfg('$run python3 manage.py runserver 0.0.0.0:8000', not production)


@task
def cli(service='web', production=False):
    """Open a terminal in the container.
    """
    run_cfg('$run bash', not production, service=service)


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
def collect_static():
    """Collect static files (usually to S3).
    """
    run_cfg('$manage collectstatic', False)


@task
def deploy():
    """Deploy production to Heroku.
    """
    run('./scripts/release.sh')


@task
def down(production=False):
    """Stop all running containers.
    """
    run_cfg('$compose stop', not production)


@task
def kill(production=False):
    """Remove containers.
    """
    down()
    run_cfg('$compose rm -fv', not production)


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
