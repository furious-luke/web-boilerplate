from django.conf.urls import include, url
from _project_.router import router

from .views import IndexView


# router.register(r'', )

urlpatterns = [
    url(r'^$', IndexView.as_view(), name='index'),
    url(r'^apps/$', IndexView.as_view(), name='index'),
    url(r'^', include('xauth.urls')),
]
