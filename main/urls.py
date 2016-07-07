from django.conf.urls import include, url

from .views import IndexView


urlpatterns = [
    url(r'^$', IndexView.as_view(), name='index'),
    url(r'^', include('xauth.urls')),
]
