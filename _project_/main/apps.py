from django.apps import AppConfig

from .utils import schedule_job


class MainConfig(AppConfig):
    name = 'main'

    def ready(self):
        pass
#         from .tasks import some_task
#         schedule_job(some_task, 60, 'short')
