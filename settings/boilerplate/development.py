from ..base import *


# Application definition

INSTALLED_APPS.append('supertest')


# Password validation

AUTH_PASSWORD_VALIDATORS = []


# Email support

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# Testing

SELENIUM_DRIVER = os.environ.get('SELENIUM_DRIVER', 'firefox')

SELENIUM_REMOTE = 'http://selenium:4444/wd/hub/'

TEST_RUNNER = 'supertest.runner.SuperTestRunner'


# Loggers

LOGGING['root']['level'] = 'DEBUG'

LOGGING['loggers'] = {
    'django.request': {
        'handlers': ['console'],
        'level': 'DEBUG',
    }
}


try:
    from .local import *
except:
    pass
