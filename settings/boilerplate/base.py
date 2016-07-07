import os
from os.path import dirname as dn

import dj_database_url

from ..settings import *
from ..project import PROJECT

BASE_DIR = dn(dn(dn(dn(os.path.abspath(__file__)))))

VAR_DIR = os.path.join(dn(BASE_DIR), 'var')


# Application definition

INSTALLED_APPS += [
    'main',
    'xauth',
    'jsdata',
    'rest_framework',
    'django_extensions',
    'webpack_loader',
    'django_rq',
    'django_hstore',
    'storages',
]

ROOT_URLCONF = PROJECT + '.urls.urls'

ROOT_ROUTERCONF = PROJECT + '.urls.router'

WSGI_APPLICATION = PROJECT + '.wsgi.application'


# Database

DATABASES = {
    'default': dj_database_url.config(default='postgres://postgres@db/postgres'),
}


# Internationalization

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)

STATIC_ROOT = os.path.join(VAR_DIR, 'static')

STATICFILES_DIRS = [
    os.path.join(VAR_DIR, 'build'),
]

MEDIA_URL = '/media/'

MEDIA_ROOT = os.path.join(VAR_DIR, 'media')

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'js/',
        'STATS_FILE': os.path.join(VAR_DIR, 'build', 'webpack-stats.json'),
        'CACHE': False,
    }
}


# Auth (logging in)

LOGIN_URL = '/'

LOGIN_REDIRECT_URL = '/'


# Django Rest Framework

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ]
}


# Django RQ/REDIS

REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

RQ_QUEUES = {
    'short': {
        'USE_REDIS_CACHE': 'default',
        'DEFAULT_TIMEOUT': '180',
    },
    'default': {
        'USE_REDIS_CACHE': 'default',
        'DEFAULT_TIMEOUT': '900',
    },
}


# S3

AWS_STORAGE_BUCKET_NAME = PROJECT + '-static'

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')

AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')


# Loggers

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'root': {
        'level': 'INFO',
        'handlers': ['console'],
    },
    'formatters': {
        'verbose': {
            'format': '%(levelname)s %(asctime)s %(module)s %(message)s'
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
        'null': {
            'level': 'INFO',
            'class': 'logging.NullHandler',
        },
    },
}


# Sensitive data.

try:
    from .local import *
except ImportError:
    pass
