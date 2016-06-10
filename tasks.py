from string import Template

from invoke import run, task


BASE_CONFIG = {
    'compose': 'docker-compose -f $compose_file -p $project',
    'run': '$compose run --rm --service-ports web /sbin/my_init --skip-runit --',
}

DEV_CONFIG = {
    'compose_file': 'docker/docker-compose.development.yml',
    'project': '_project_',
    'manage': '$run python3 -W ignore manage.py',
}

PROD_CONFIG = {
    'compose': 'docker-compose -p $project',
    'project': '_project_',
    'run': '$compose run --rm --service-ports web',
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


def dev_cfg():
    return merge_cfgs(BASE_CONFIG, DEV_CONFIG)


def prod_cfg():
    return merge_cfgs(BASE_CONFIG, PROD_CONFIG)


def run_cfg(cmd, dev=True, pty=False):
    cfg = dev_cfg() if dev else prod_cfg()
    cmd = Template(cmd).substitute(cfg)
    print(cmd)
    run(cmd, pty=pty)


@task(help={'no-cache': 'Disable docker cache.',
            'production': 'Build production version.'})
def build(ctx, no_cache=False, production=False):
    """Build the docker containers.
    """
    opts = ''
    if no_cache:
        opts += ' --no-cache'
    run_cfg('$compose build{}'.format(opts), not production)


@task(help={'production': 'Launch production version.'})
def up(ctx, production=False):
    """Launch the server.
    """
    run_cfg('$compose up', not production)


@task(aliases=['ut'])
def unit_test(ctx):
    """Run unit-tests.
    """
    run_cfg('$manage test')


@task(aliases=['it'])
def integration_test(ctx):
    run('{test} test --test=integration'.format(**CONFIG))


@task(aliases=['nt'])
def node_test(ctx):
    run('{run} npm run test'.format(**CONFIG))


# @task
# def run(cmd):
#     run('{run} {}'.format(cmd, **CONFIG))


@task(help={'production': 'Run command on production.'})
def manage(ctx, cmd, production=False):
    """Run a management command.
    """
    run_cfg('$manage {}'.format(cmd), not production, pty=True)


@task(aliases=['sp'])
def shell_plus(ctx):
    manage('shell_plus')


@task(help={'production': 'Migrate production database.'})
def migrate(ctx, production=False):
    """Migrate the database.
    """
    run_cfg('$manage migrate', not production)


@task(aliases=['mm'])
def make_migrations(ctx):
    """Check for outdated models.
    """
    manage('makemigrations')


@task
def pdb(ctx):
    run('{run} python3 manage.py runserver 0.0.0.0:8000'.format(**CONFIG))


@task(help={'production': 'Start command-line in production container.'})
def cli(ctx, production=False):
    """Open a terminal in the container.
    """
    run_cfg('$run bash', not production, pty=True)


@task(aliases=['cs'])
def collect_static(ctx):
    """Collect static files (usually to S3).
    """
    run_cfg('$run ./manage.py collectstatic', production=True)


@task
def deploy(ctx):
    """Deploy production to Heroku.
    """
    run('./scripts/release.sh')


@task(help={'production': 'Stop production containers.'})
def down(ctx, production=False):
    """Stop all running containers.
    """
    run_cfg('$compose stop', not production)


@task(help={'production': 'Remove production containers.'})
def kill(ctx, production=False):
    """Remove containers.
    """
    down()
    run_cfg('$compose rm -fv', not production)
