from .boilerplate.urls import *


urlpatterns += [
    url(r'^', include('xauth.login_ajax_urls')),
    # url(r'^', include('xauth.password_urls')),
]
