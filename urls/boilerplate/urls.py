from django.conf.urls import url, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

from ..router import router


urlpatterns = [
    url(r'^', include('main.urls')),
    url(r'^api/v1/', include(router.urls)),
    url(r'^', include('xauth.login_ajax_urls')),
    url(r'^admin/', admin.site.urls),
]
