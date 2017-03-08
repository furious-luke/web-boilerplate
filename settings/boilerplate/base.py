import os
from os.path import dirname as dn

import dj_database_url

from ..settings import *
from ..project import PROJECT

BASE_DIR = dn(dn(dn(dn(os.path.abspath(__file__)))))

VAR_DIR = os.path.join(dn(BASE_DIR), 'var')

CLIENT_ID = os.environ.get('CLIENT_ID', '')

SECRET_KEY = os.environ.get('SECRET_KEY', SECRET_KEY)


# Application definition

INSTALLED_APPS = [
    'main',
    'cq',
    'xauth',
    'jsdata',
    'rest_framework',
    'django_extensions',
    'webpack_loader',
    'storages',
    'django.contrib.postgres'
] + INSTALLED_APPS

INSTALLED_APPS = INSTALLED_APPS + [
    'channels'
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
        'BUNDLE_DIR_NAME': '',
        'STATS_FILE': os.path.join(VAR_DIR, 'build', 'webpack-stats.json'),
        'CACHE': False,
    }
}


# Auth (logging in)

LOGIN_URL = '/'

LOGIN_REDIRECT_URL = '/'

XAUTH_AJAX = True


# Django Rest Framework

REST_FRAMEWORK = {
    'PAGE_SIZE': 10,
    'EXCEPTION_HANDLER': 'rest_framework_json_api.exceptions.exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework_json_api.pagination.PageNumberPagination',
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework_json_api.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser'
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework_json_api.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_METADATA_CLASS': 'rest_framework_json_api.metadata.JSONAPIMetadata',
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
    ),
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    )
}


# Django REDIS

REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_CLASS': 'redis.connection.BlockingConnectionPool',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 7,
                'timeout': 5
            }
        }
    }
}


# S3

AWS_STORAGE_BUCKET_NAME = PROJECT + '-static'

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')

AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')


# Channels/CQ

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'redis_channel_layer.DjangoRedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
        },
        'ROUTING': PROJECT + '.urls.channels.channel_routing'
    },
    'long': {
        'BACKEND': 'redis_channel_layer.DjangoRedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
            'expiry': 1800,
            'channel_capacity': {
                'cq-tasks': 1000
            }
        },
        'ROUTING': PROJECT + '.urls.channels.channel_routing',
    },
}

CQ_CHANNEL_LAYER = 'long'


# Loggers

LOGGING = {
    'version': 1,
    # 'disable_existing_loggers': True,
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
    'loggers': {
        'django': {
            'handlers': ['console'],
            'filters': [],
            'propagate': True,
            'level': 'INFO',
        }
    }
}
