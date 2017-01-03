#
# Initialise platform.
# Provision compute hardware.
#   TODO: Wait for AWS user data to finish running.
# Provision DB.
# Create log group. (AWS) TODO: Do this automatically
# Deploy code.
# Migrate.
#

import sys
import os
import stat
import shutil
import tempfile
import datetime
import binascii
import re
import json
import shlex
import random
import string
from string import Template

from fabric.api import run, task, local, shell_env, warn_only, hide, env
import boto3
try:
    import dotenv
except:
    pass


DEFAULT_SERVICE = {
    'develop': 'web',
    'atto': 'web',
    'pico': 'web'
}


BASE_CONFIG = {
    'app': '$project',
    'layout': 'develop',
    'platform': 'heroku',
    'compose': 'docker-compose -f $compose_file -f docker/docker-compose.$layout.yml -p $docker_project',
    'run': '$compose run --rm --service-ports $service /sbin/my_init --skip-runit --',
    'rundb': '$compose run --rm db',
    'aws': 'aws --profile $aws_profile --region $aws_region',
    'aws_region': 'ap-southeast-2'
}

DEV_CONFIG = {
    'docker_project': '${project}_dev',
    'layout': 'develop',
    'compose_file': 'boilerplate/docker/docker-compose.develop.yml',
    'manage': '$run python3 -W ignore manage.py',
    'coverage': '$run coverage run --source="$project" manage.py test',
    'covhtml': '$run coverage html'
}

PROD_CONFIG = {
    'docker_project': '$project',
    'compose_file': 'boilerplate/docker/docker-compose.$platform.$layout.yml',
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


def update_defaults(cfg):
    defaults = {}
    if 'service' not in cfg:
        defaults['service'] = DEFAULT_SERVICE[cfg['layout']]
    return merge_cfgs(cfg, defaults)


def subs(cmd, dev=True, extra={}):
    cfg = dev_cfg(extra) if dev else prod_cfg(extra)
    cfg = update_defaults(cfg)
    cmd = Template(cmd).substitute(cfg)
    return cmd


def run_cfg(cmd, dev=True, capture=False, remote=False, **kwargs):
    cmd = subs(cmd, dev, kwargs)
    if remote:
        return run(cmd, pty=True)
    else:
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


def aws_profile(profile=None, boto=False):
    profile = profile if profile is not None else BASE_CONFIG.get('aws_profile', None)
    env = {}
    if profile:
        access, secret = get_aws_creds(profile)
        env[access[0].lower() if boto else access[0].upper()] = access[1]
        env[secret[0].lower() if boto else secret[0].upper()] = secret[1]
    return env


def gen_secret(length=64):
    return ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(length))


def get_db_name():
    run_cfg('$compose up -d db')
    res = run_cfg('$compose ps | grep db | awk \'{{print $$1}}\' | head -n1',
                  capture=True)
    return res.strip()


@task
def pull():
    with warn_only():
        local('cd boilerplate')
        local('git checkout develop')
        local('git pull')
        local('cd ..')
        local('git pull')


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


@task(alias='csu')
def createsuperuser():
    manage('createsuperuser')


@task
def migrate(prod=False, remote=False):
    """Migrate the database.
    """
    if not remote:
        run_cfg('$manage migrate', not prod)
    else:
        remote_manage('migrate')


@task(alias='mm')
def make_migrations(app=None):
    """Check for outdated models.
    """
    cmd = 'makemigrations'
    if app:
        cmd += ' %s' % app
    manage(cmd)


@task
def reset_db(remote=False, db=None):
    """Reset the database.
    """
    if not remote:
        manage('reset_db')
    elif BASE_CONFIG['platform'] == 'aws':
        manage('reset_db', remote=True)
    else:
        if db is None:
            db = 'DATABASE_URL'
        heroku_run('pg:reset {} -a $app'.format(db))


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
def cli(service='web', cmd='bash', prod=False, remote=False):
    """ Open a terminal in the container.
    """
    if remote:
        remote_run('{}'.format(cmd))
    else:
        if service == 'db':
            run_cfg('$rundb {}'.format(cmd), not prod)
        else:
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
def heroku_download_db(filename=None):
    if filename is None:
        now = datetime.datetime.now()
        filename = 'db-{}.dump'.format(now.strftime('%Y%m%d%H%M'))
    dst = os.path.join('var', filename)
    heroku_run('pg:backups capture -a $app')
    run_cfg('curl -so %s $$(heroku pg:backups -a $app public-url)' % dst)
    return filename


@task
def load_db(filename):
    src = os.path.join('/share', filename)
    db_name = get_db_name()
    cmd = (
        'pg_restore --verbose --clean --no-acl --no-owner'
        ' -h 0.0.0.0 -U postgres -d postgres {}'.format(src)
    )
    fullcmd = 'docker exec {container_name} sh -c "{cmd}"'.format(
        container_name=db_name, cmd=cmd
    )
    with warn_only():
        local(fullcmd)
    run_cfg('$compose stop db')


@task
def pull_db():
    fn = heroku_download_db()
    load_db(fn)


@task
def psql():
    db_name = get_db_name()
    cmd = 'psql -h 0.0.0.0 -U postgres -d postgres'
    fullcmd = 'docker exec -it {container_name} sh -c "{cmd}"'.format(
        container_name=db_name, cmd=cmd
    )
    with warn_only():
        local(fullcmd)
    run_cfg('$compose stop db')


@task
def dump_db(filename):
    db_name = get_db_name()
    cmd = ('pg_dump -Fc --no-acl --no-owner -h 0.0.0.0 -U postgres postgres > '
           '/share/{filename}').format(filename=filename)
    fullcmd = 'docker exec {container_name} sh -c "{cmd}"'.format(
        container_name=db_name, cmd=cmd
    )
    local(fullcmd, capture=True)
    run_cfg('$compose stop db')


@task
def upload_s3(filename, bucket_name, remote_key):
    env = aws_profile(boto=True)
    s3 = boto3.client('s3', **env)
    s3.upload_file(filename, bucket_name, remote_key)
    url = s3.generate_presigned_url('get_object', Params={
        'Bucket': bucket_name, 'Key': remote_key
    })
    return url


@task
def heroku_deploy_db(bucket_name):
    now = datetime.datetime.now()
    filename = 'db-{}.dump'.format(now.strftime('%Y%m%d%H%M'))
    dump_db(filename)
    remote_key = 'imports/{}.dump'.format(now.strftime('%Y%m%d%h%i'))
    filename = 'var/{}'.format(filename)
    s3path = upload_s3(filename, bucket_name, remote_key)
    heroku_run('pg:backups -a $app restore "{filename}" DATABASE_URL'.format(
        filename=s3path,
    ))


@task
def aws_deploy_db(filename):
    if filename is None:
        now = datetime.datetime.now()
        filename = 'var/db-{}.dump'.format(now.strftime('%Y%m%d%H%M'))
        dump_db(filename)
    endpoint = aws_get_db_endpoint()
    with shell_env(PGPASSFILE='pgpass'):
        with warn_only():
            run_cfg(
                'pg_restore --verbose --clean --no-acl --no-owner'
                ' -w -h {} -U $project -d $project {}'.format(
                    endpoint['Address'], filename
                )
            )


@task
def heroku_run(cmd, sudo=False):
    cmd = 'heroku {}'.format(cmd)
    if sudo:
        cmd = 'sudo ' + cmd
    run_cfg(cmd, dev=False)


@task
def remote_run(cmd):
    if BASE_CONFIG['platform'] == 'heroku':
        heroku_run('run {} -a $app'.format(cmd))
    elif BASE_CONFIG['platform'] == 'aws':
        aws_run(cmd)


@task(alias='rem')
def remote_manage(cmd):
    remote_run('python3 manage.py {}'.format(cmd))


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
    cmd = (
        '"letsencrypt certonly --email=$email --agree-tos --non-interactive'
        ' -w /var/lib/letsencrypt -d {}"'
    ).format(' -d '.join(domains))
    remote_run(cmd)

    # primary = domains[0]
    # local('docker run --rm -it -p 443:443 -p 80:80 --name certbot '
    #       '-v "/etc/letsencrypt:/etc/letsencrypt" '
    #       '-v "/var/lib/letsencrypt:/var/lib/letsencrypt" '
    #       'quay.io/letsencrypt/letsencrypt:latest '
    #       'certonly --manual -d {} '
    #       ''.format(
    #           ' -d '.join(domains)
    #       ))
    # heroku('certs:add --type sni /etc/letsencrypt/live/{primary}-0001/fullchain.pem '
    #        '/etc/letsencrypt/live/{primary}-0001/privkey.pem'.format(primary=primary),
    #        sudo=True)


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
def aws_create_user(name=None):
    name = name if name is not None else '$project'
    run_cfg('iam create-user --user-name {}'.format(name))


@task
def aws_create_role(name=None, policies=[]):
    name = name if name is not None else '$project'

    # Create the role.
    run_cfg('$aws iam create-role --role-name %s'
            ' --assume-role-policy-document'
            ' file://boilerplate/scripts/ecs-assume-role.json' % name)

    # Add policies to the role.
    for policy in policies:
        with tempfile.NamedTemporaryFile() as outf:
            with open('./scripts/%s.json' % policy) as inf:
                data = Template(inf.read()).substitute(prod_cfg(), name=name)
            outf.write(data.encode())
            outf.flush()
            print(data)
            run_cfg('$aws iam put-role-policy --role-name %s'
                    ' --policy-name %s'
                    ' --policy-document file://%s' %
                    (name, policy, outf.name))


@task
def aws_create_ec2_role(prefix='ec2'):
    role_name = prefix + '-role'
    inst_name = prefix + '-profile'
    aws_create_role(role_name, ['aws-logging-policy'])
    run_cfg('$aws iam create-instance-profile --instance-profile-name %s'
            % inst_name)
    run_cfg('$aws iam add-role-to-instance-profile --instance-profile-name %s'
            ' --role-name %s' % (inst_name, role_name))


@task
def aws_create_security_group():
    run_cfg('$aws ec2 create-security-group --group-name $project'
            ' --description "$project security group"')
    run_cfg('$aws ec2 authorize-security-group-ingress --group-name $project'
            ' --protocol tcp --port 22 --cidr 0.0.0.0/0')
    run_cfg('$aws ec2 authorize-security-group-ingress --group-name $project'
            ' --protocol tcp --port 80 --cidr 0.0.0.0/0')
    run_cfg('$aws ec2 authorize-security-group-ingress --group-name $project'
            ' --protocol tcp --port 443 --cidr 0.0.0.0/0')
    run_cfg('$aws ec2 authorize-security-group-ingress --group-name $project'
            ' --protocol tcp --port 6379 --cidr 0.0.0.0/0')
    run_cfg('$aws ec2 authorize-security-group-ingress --group-name $project'
            ' --protocol tcp --port 5432 --cidr 0.0.0.0/0')


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
    repo = '$project' if repo is None else repo
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
    run_cfg('$aws ecs create-cluster --cluster-name $project')


@task
def aws_create_key_pair():
    res = run_cfg('$aws ec2 create-key-pair'
                  ' --key-name $project', capture=True)
    try:
        res = json.loads(res)
    except:
        return
    fn = '{}.pem'.format(res['KeyName'])
    with open(fn, 'w') as keyf:
        keyf.write(res['KeyMaterial'])
    os.chmod(fn, stat.S_IRUSR | stat.S_IWUSR)


# Note: Not needed for ECS logging.
# @task
# def aws_create_config_bucket():
#     run_cfg('$aws s3api create-bucket --bucket $aws_config_bucket')
#     run_cfg('$aws s3 cp boilerplate/scripts/log-agent.cfg'
#             ' s3://$aws_config_bucket/log-agent.cfg')


@task
def aws_get_security_group_id(name=None):
    name = '$project' if name is None else name
    grps = run_cfg('$aws ec2 describe-security-groups'
                   ' --group-name {}'.format(name), capture=True)
    grps = json.loads(grps)
    try:
        id = grps['SecurityGroups'][0]['GroupId']
    except:
        id = None
    return id


@task
def aws_run_instance():

    # TODO: * IAM role cannot be set.

    ami_map = {
        # 'ap-southeast-2': 'ami-862211e5',  # docker enabled amazon
        'ap-southeast-2': 'ami-5c8fb13f',  # arch linux
    }
    image = ami_map[BASE_CONFIG['aws_region']]
    sg_id = aws_get_security_group_id()
    # creds = aws_profile()
    secret_key = gen_secret()
    with tempfile.NamedTemporaryFile() as outf:
        with open('boilerplate/scripts/arch-user-data.sh') as inf:
            data = Template(inf.read()).substitute(
                prod_cfg(),
                # **creds,
                secret_key=secret_key
            )
        outf.write(data.encode())
        outf.flush()
        res = run_cfg('$aws ec2 run-instances'
                      ' --image-id $image'
                      ' --key-name $project'
                      ' --security-group-ids "{sg_id}"'
                      ' --user-data file://{user_data}'
                      ' --instance-type t2.micro'
                      ' --iam-instance-profile Name=ec2-profile'
                      ' --associate-public-ip-address'
                      ' --count 1'.format(user_data=outf.name, sg_id=sg_id),
                      image=image, capture=True, dev=False)
        res = json.loads(res)
        return res['Instances'][0]['InstanceId']
        # return json.loads(res)


@task
def aws_allocate_address(inst_id):
    res = run_cfg('$aws ec2 allocate-address --domain vpc', capture=True,
                  dev=False)
    alloc_id = json.loads(res)['AllocationId']
    run_cfg('$aws ec2 associate-address --instance-id {}'
            ' --allocation-id {}'.format(inst_id, alloc_id), dev=False)


@task
def aws_tag_instance(inst_id, **tags):
    tags = ['Key=%s,Value=%s' % (k, v) for k, v in tags.items()]
    run_cfg('$aws ec2 create-tags --resources {}'
            ' --tags {}'.format(inst_id, ' '.join(tags)), dev=False)


@task
def aws_create_server():
    # Currently only works for atto layout.
    inst_id = aws_run_instance()
    run_cfg('$aws ec2 wait instance-running --instance-ids "{}"'.format(
        inst_id
    ), dev=False)
    aws_tag_instance(inst_id, project='$project', layout='$layout')
    aws_allocate_address(inst_id)


@task
def aws_init():
    """ One-off preparation for the project.
    """
    with warn_only():
        aws_create_key_pair()
        with warn_only():
            aws_create_security_group()
        aws_create_ec2_role()
        aws_docker_login()
    cfg = prod_cfg()
    if cfg['layout'] == 'atto':
        with warn_only():
            aws_create_repository('${project}_atto')


@task
def aws_repository_uri(name):
    res = run_cfg('$aws ecr describe-repositories'
                  ' --repository-names {}'.format(name), capture=True,
                  dev=False)
    res = json.loads(res)
    uri = res['repositories'][0]['repositoryUri']
    print(uri)
    return uri


@task
def aws_push(ctr, repo):
    uri = aws_repository_uri(repo)
    run_cfg('docker tag {}:latest {}:latest'.format(ctr, uri), dev=False)
    run_cfg('docker push {}:latest'.format(uri), dev=False)


@task
def aws_list_tasks():
    tasks = run_cfg('$aws ecs list-tasks --cluster $project', capture=True,
                    dev=False)
    return json.loads(tasks)['taskArns']


@task
def aws_describe_tasks():
    tasks = ' '.join(['"%s"' % t for t in aws_list_tasks()])
    tasks = run_cfg('$aws ecs describe-tasks --cluster $project'
                    ' --tasks {}'.format(tasks), capture=True,
                    dev=False)
    return json.loads(tasks)


# @task
# def aws_list_containers():
#     ctrs = run_cfg('$aws ecs list-container-instances --cluster $app',
#                    capture=True)
#     return json.loads(ctrs)


@task
def aws_describe_containers(arns):
    arns = ' '.join(['"%s"' % t for t in arns])
    ctrs = run_cfg('$aws ecs describe-container-instances --cluster $project'
                   ' --container-instances {}'.format(arns), capture=True,
                   dev=False)
    return json.loads(ctrs)


@task
def aws_describe_instances(ids):
    ids = ' '.join(['"%s"' % i for i in ids])
    insts = run_cfg('$aws ec2 describe-instances --instance-ids {}'.format(ids),
                    capture=True, dev=False)
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
def aws_scp(family, src, dst):
    dns = aws_public_dns(family)
    if dns:
        run_cfg('scp -i "${project}.pem" %s ec2-user@%s:%s' % (src, dns[0], dst),
                dev=False)


@task
def aws_get_db_endpoint():
    cmd = (
        '$aws rds describe-db-instances'
        ' --db-instance-identifier $project'
    )
    res = json.loads(run_cfg(cmd, capture=True))
    endpoint = res['DBInstances'][0]['Endpoint']
    return endpoint


@task
def aws_get_db_password():
    res = aws_config('get', 'DATABASE_URL')
    match = re.search(r'postgres://.*?:(.*?)@.*', res)
    pw = match.group(1)
    return pw


@task
def aws_create_db():

    # Create the database and wait for it to be ready.
    sgid = aws_get_security_group_id()
    cmd = (
        '$aws rds create-db-instance'
        ' --db-name $project'
        ' --db-instance-identifier $project'
        ' --db-instance-class db.t2.micro'
        ' --engine postgres'
        ' --allocated-storage 5'
        ' --master-username $project'
        ' --master-user-password $password'
        ' --backup-retention-period 0'
        ' --vpc-security-group-ids $sgid'
    )
    password = gen_secret(16)
    res = run_cfg(cmd, capture=True, password=password, sgid=sgid)
    res = json.loads(res)
    run_cfg('$aws rds wait db-instance-available --db-instance-identifier $project')

    # Set the database URL in the environment.
    endpoint = aws_get_db_endpoint()
    url = 'postgres://$project:$password@$address:$port/$project'
    url = subs(url, dev=False, extra={
        'password': password,
        'address': endpoint['Address'],
        'port': str(endpoint['Port'])
    })
    aws_config('set', 'DATABASE_URL', url)

    # Generate/add to the pgpass file.
    with open('pgpass', 'w') as ff:
        os.chmod('pgpass', 0o600)
        ff.write('{}:{}:{}:{}:{}'.format(
            endpoint['Address'], endpoint['Port'],
            BASE_CONFIG['project'],
            BASE_CONFIG['project'], password
        ))


@task
def aws_public_ip():
    res = run_cfg('$aws ec2 describe-instances --filters Name=tag:project,'
                  'Values=$project Name=tag:layout,Values=atto'
                  ' Name=instance-state-name,Values=running',
                  capture=True)
    res = json.loads(res)
    if not res['Reservations']:
        print('No EC2 reservations active!')
    for rsrv in res['Reservations']:
        try:
            ip = rsrv['Instances'][0]['PublicIpAddress']
        except:
            pass
        else:
            break
    print(ip)
    return ip


def aws_add_env():
    cfg = prod_cfg()
    env.hosts = [aws_public_ip()]
    env.host_string = env.hosts[0]
    env.user = 'root'
    env.key_filename = [os.path.join(os.getcwd(), cfg['project'] + '.pem')]


@task
def aws_reload():
    aws_add_env()
    uri = aws_repository_uri('${project}_atto')
    cmd = [
        '`aws --region $aws_region ecr get-login`',
        'docker pull %s' % uri,
        'docker tag %s app' % uri,
        'systemctl restart app.service'
    ]
    cmd = ' && '.join(cmd)
    run_cfg(cmd, remote=True)


@task
def aws_config(action=None, key=None, value=None):
    aws_add_env()
    if value is not None:
        value = shlex.quote(value)
    cmd = dotenv.get_cli_string('/root/app.env', action, key, value)
    cmd = cmd.split()
    cmd = cmd[0] + ' -q never ' + ' '.join(cmd[1:])
    res = run_cfg(cmd, remote=True, capture=(action == 'get'))
    return res


@task
def aws_ec2_run(cmd):
    aws_add_env()
    run_cfg(cmd, dev=False, remote=True)


@task
def aws_run(cmd):
    cmd = '/usr/bin/app {}'.format(cmd)
    aws_ec2_run(cmd)


@task
def aws_ssh(family=None):
    with hide('running'):
        ip = aws_public_ip()
    run_cfg('ssh -i "${project}.pem" root@%s' % ip, dev=False)


@task
def aws_start():
    aws_add_env()
    run_cfg('systemctl start app.service', remote=True)


@task
def aws_restart():
    aws_add_env()
    run_cfg('systemctl restart app.service', remote=True)


@task
def aws_stop():
    aws_add_env()
    run_cfg('systemctl stop app.service', remote=True)


@task
def deploy():
    cfg = prod_cfg()
    if cfg['platform'] == 'heroku':
        if cfg['layout'] == 'atto':
            ctr = '{project}_web'.format(**cfg)
            heroku_push(ctr, 'web')
        elif cfg['layout'] == 'pico':
            ctr = '{project}_web'.format(**cfg)
            heroku_push(ctr, 'web')
            ctr = '{project}_worker'.format(**cfg)
            heroku_push(ctr, 'worker')
    elif cfg['platform'] == 'aws':
        aws_docker_login()
        if cfg['layout'] == 'atto':
            ctr = '{project}_web'.format(**cfg)
            aws_push(ctr, '${project}_atto')
            aws_reload()


@task
def upgrade_js():
    with open('package.json') as file:
        data = json.load(file)
    deps = data['dependencies']
    dev_deps = data['devDependencies']
    data['dependencies'] = {}
    data['devDependencies'] = {}
    with open('package.json', 'w') as file:
        json.dump(data, file, indent=2, sort_keys=True)
    local('yarn add {}'.format(' '.join(deps)))
    local('yarn add -D {}'.format(' '.join(dev_deps)))


@task
def go():
    pull()
    build()
    local('yarn install')
    reset_db()
    migrate()
    manage('demo')
