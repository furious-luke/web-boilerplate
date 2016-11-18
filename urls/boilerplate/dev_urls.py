from ..urls import *

urlpatterns += [
    url(r'^docs/', include('rest_framework_docs.urls'))
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
