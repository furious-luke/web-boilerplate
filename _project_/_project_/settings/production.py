import os

from .base import *


DEBUG = os.environ.get('DEBUG', 'false') == 'true'

SECRET_KEY = os.environ.get('SECRET_KEY', '')

SESSION_COOKIE_SECURE = True

CSRF_COOKIE_SECURE = True

SECURE_SSL_REDIRECT = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

ADMINS = (
    'furious.luke@gmail.com',
)

ALLOWED_HOSTS = [
    '*'
]

STATICFILES_DIRS = [
    os.path.join(VAR_DIR, 'assets'),
]

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': 'js/',
        'STATS_FILE': os.path.join(os.path.dirname(BASE_DIR), 'webpack-stats.production.json'),
        'CACHE': True,
    }
}


# S3

AWS_S3_CUSTOM_DOMAIN = '%s.s3.amazonaws.com'%AWS_STORAGE_BUCKET_NAME

STATIC_URL = 'https://%s/'%AWS_S3_CUSTOM_DOMAIN

DEFAULT_FILE_STORAGE = 'storages.backends.s3boto.S3BotoStorage'

STATICFILES_STORAGE = 'storages.backends.s3boto.S3BotoStorage'


# Password validation
# https://docs.djangoproject.com/en/dev/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
