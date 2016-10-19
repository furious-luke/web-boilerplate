import sys
import os
import shutil
import tempfile
import datetime
import binascii
import re
import json
from string import Template

from fabric.api import run, task, local, shell_env, warn_only, hide
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
    'compose_file': 'boilerplate/docker/docker-compose.$platform.yml',
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
def cli(service='web', cmd=None, prod=False):
    """Open a terminal in the container.
    """
    if cmd is None:
        cmd = 'bash'
    run_cfg('$run {}'.format(cmd), not prod, service=service)


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
def heroku_push(ctr, repo):
    uri = 'registry.heroku.com/$app/{}'.format(repo)
    run_cfg('docker tag {}:latest {}:latest'.format(ctr, uri))
    run_cfg('docker push {}:latest'.format(uri))


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
        run_cfg('$aws ec2 authorize-security-group-ingress --group-name $app'
                ' --protocol tcp --port 443 --cidr 0.0.0.0/0')
        run_cfg('$aws ec2 authorize-security-group-ingress --group-name $app'
                ' --protocol tcp --port 6379 --cidr 0.0.0.0/0')


@task
def aws_create_ecs_roles():
    print('*** Do this from the console, this doesn\'t work.')
    sys.exit(1)
    run_cfg('$aws iam create-role --role-name ecsInstanceRole'
            ' --assume-role-policy-document'
            ' file://boilerplate/scripts/ecs-assume-role.json')
    run_cfg('$aws iam put-role-policy --role-name ecsInstanceRole'
            ' --policy-name AmazonEC2ContainerServiceforEC2Role'
            ' --policy-document'
            ' file://boilerplate/scripts/ecs-instance-role.json')
    run_cfg('$aws iam create-role --role-name ecsServiceRole'
            ' --assume-role-policy-document'
            ' file://boilerplate/scripts/ecs-assume-role.json')
    run_cfg('$aws iam put-role-policy --role-name ecsServiceRole'
            ' --policy-name AmazonEC2ContainerServiceRole'
            ' --policy-document'
            ' file://boilerplate/scripts/ecs-service-role.json')


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
def aws_create_log_group():
    run_cfg('$aws logs create-log-group --log-group-name $project')


@task
def aws_register_task_definition(family):

    # TODO: Check if secret key is already set, if not, generate one.

    with tempfile.NamedTemporaryFile() as outf:
        with open('./scripts/{}-task-definition.json'.format(family)) as inf:
            data = Template(inf.read()).substitute(prod_cfg())
        outf.write(data.encode())
        outf.flush()
        run_cfg('$aws ecs register-task-definition'
                ' --cli-input-json file://{}'.format(outf.name))


@task
def aws_create_cluster():
    run_cfg('$aws ecs create-cluster --cluster-name $app')


@task
def aws_create_key_pair():
    res = run_cfg('$aws ec2 create-key-pair'
                  ' --key-name $app', capture=True)
    print(res)
    res = json.loads(res)
    with open('{}.pem'.format(res['KeyName'])) as keyf:
        keyf.write(res['KeyMaterial'])


# Note: Not needed for ECS logging.
# @task
# def aws_create_config_bucket():
#     run_cfg('$aws s3api create-bucket --bucket $aws_config_bucket')
#     run_cfg('$aws s3 cp boilerplate/scripts/log-agent.cfg'
#             ' s3://$aws_config_bucket/log-agent.cfg')


@task
def aws_run_instance():

    # TODO: * Auto-assign public IP not set to enabled.
    #       * IAM role cannot be set.

    ami_map = {
        'ap-southeast-2': 'ami-862211e5'
    }
    image = ami_map[BASE_CONFIG['aws_region']]
    with tempfile.NamedTemporaryFile() as outf:
        with open('boilerplate/scripts/user-data.sh') as inf:
            data = Template(inf.read()).substitute(prod_cfg())
        outf.write(data.encode())
        outf.flush()
        run_cfg('$aws ec2 run-instances'
                ' --image-id $image'
                ' --key-name $app'
                ' --security-groups "$app"'
                ' --user-data file://{}'
                ' --instance-type t2.micro'
                ' --count 1'.format(outf.name),
                image=image)


@task
def aws_setup():
    aws_create_security_group()
    aws_create_ecs_roles()
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


@task
def aws_list_tasks():
    tasks = run_cfg('$aws ecs list-tasks --cluster $app', capture=True)
    return json.loads(tasks)['taskArns']


@task
def aws_describe_tasks():
    tasks = ' '.join(['"%s"' % t for t in aws_list_tasks()])
    tasks = run_cfg('$aws ecs describe-tasks --cluster $app'
                    ' --tasks {}'.format(tasks), capture=True)
    return json.loads(tasks)


# @task
# def aws_list_containers():
#     ctrs = run_cfg('$aws ecs list-container-instances --cluster $app',
#                    capture=True)
#     return json.loads(ctrs)


@task
def aws_describe_containers(arns):
    arns = ' '.join(['"%s"' % t for t in arns])
    ctrs = run_cfg('$aws ecs describe-container-instances --cluster $app'
                   ' --container-instances {}'.format(arns), capture=True)
    return json.loads(ctrs)


@task
def aws_describe_instances(ids):
    ids = ' '.join(['"%s"' % i for i in ids])
    insts = run_cfg('$aws ec2 describe-instances --instance-ids {}'.format(ids),
                    capture=True)
    return json.loads(insts)


@task
def aws_public_dns(family):
    with hide('running'):
        tasks = aws_describe_tasks()
        if family:
            prog = re.compile(r'^.*:task-definition/{}:\d+'.format(family))
        else:
            prog = None
        arns = [t['containerInstanceArn'] for t in tasks['tasks']
                if prog is None or prog.match(t['taskDefinitionArn'])]
        if not arns:
            return
        ctrs = aws_describe_containers(arns)
        ids = [c['ec2InstanceId'] for c in ctrs['containerInstances']]
        insts = aws_describe_instances(ids)
        dns = []
        for res in insts['Reservations']:
            for ins in res['Instances']:
                dns.append(ins['PublicDnsName'])
    return dns


@task
def aws_ssh(family):
    dns = aws_public_dns(family)
    if dns:
        run_cfg('ssh -i "${app}.pem" ec2-user@%s' % dns[0])


@task
def aws_scp(family, src, dst):
    dns = aws_public_dns(family)
    if dns:
        run_cfg('scp -i "${app}.pem" %s ec2-user@%s:%s' % (src, dns[0], dst))


# @task
# def aws_login():
    
