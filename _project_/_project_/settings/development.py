from .base import *


# Application definition

INSTALLED_APPS.append('supertest')


# Email support

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# Testing

SELENIUM_DRIVER = os.environ.get('SELENIUM_DRIVER', 'firefox')

SELENIUM_REMOTE = 'http://selenium:4444/wd/hub/'

TEST_RUNNER = 'supertest.runner.SuperTestRunner'


try:
    from .local import *
except:
    pass
