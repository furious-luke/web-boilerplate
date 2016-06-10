import logging

from django.views.generic import TemplateView
from django.core.urlresolvers import reverse
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import detail_route
from jsdata.views import DRFViewMixin


logger = logging.getLogger(__name__)


class APIViewMixin(DRFViewMixin):
    api_prefix = '/api/v1/'

    def get_router(self, **kwargs):
        from _project_.router import router
        return router

    def get_api(self, **kwargs):
        api = {
            'login': reverse('login'),
            'logout': reverse('logout'),
        }
        api.update(kwargs)
        return super(APIViewMixin, self).get_api(**api)


class IndexView(APIViewMixin, TemplateView):
    template_name = 'base.html'

    def get_jsdata(self):
        data = {}
        if self.request.user.is_authenticated():
            data['user'] = {
                'user': self.request.user.id
            }
        return super().get_jsdata(**data)
