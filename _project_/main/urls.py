from django.conf.urls import include, url
from _project_.router import router

from .views import IndexView, ActionViewSet


router.register(r'actions', ActionViewSet)

urlpatterns = [
    url(r'^$', IndexView.as_view(), name='index'),
    url(r'^apps/$', IndexView.as_view(), name='index'),
    url(r'^', include('xauth.urls')),
]
