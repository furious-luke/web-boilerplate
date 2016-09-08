import importlib
import logging

from django.views.generic import TemplateView
from django.core.urlresolvers import reverse
from django.conf import settings
from jsdata.views import DRFViewMixin


logger = logging.getLogger(__name__)


class APIViewMixin(DRFViewMixin):
    api_prefix = '/api/v1/'

    def get_router(self, **kwargs):
        router = importlib.import_module(settings.ROOT_ROUTERCONF)
        return router.router

    def get_api(self, **kwargs):
        api = {
            'login': reverse('login'),
            'logout': reverse('logout'),
        }
        api.update(kwargs)
        return super(APIViewMixin, self).get_api(**api)


class IndexView(APIViewMixin, TemplateView):
    template_name = 'index.html'

    def get_jsdata(self):
        data = {
            'static': settings.STATIC_URL
        }
        if self.request.user.is_authenticated():
            user = self.request.user
            data['user'] = {
                'id': user.id,
                'email': user.email,
            }
            try:
                data['username'] = user.username
            except AttributeError:
                data['username'] = user.email
        return super().get_jsdata(**data)
