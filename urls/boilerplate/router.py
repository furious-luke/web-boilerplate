import importlib

from rest_framework import routers

router = routers.DefaultRouter()


def get_router(rt):
    global router
    if rt is not None:
        return rt
    else:
        return router


def register(module_name, router=None):
    router = get_router(router)
    importlib.import_module(module_name).register(router)
