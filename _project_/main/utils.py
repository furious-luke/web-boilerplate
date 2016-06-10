from datetime import timedelta

import django_rq
from django.utils import timezone
from django.utils.module_loading import import_string


def schedule_job(func, interval, queue='default', result_ttl=None):
    scheduler = django_rq.get_scheduler(queue)
    jobs = scheduler.get_jobs()

    # Remove any scheduled jobs corresponding to this function.
    [scheduler.cancel(x) for x in jobs if x.func == func]

    # Schedule.
    if result_ttl is None:
        result_ttl = 5*interval
    due = timezone.now() + timedelta(seconds=interval)
    scheduler.schedule(due, func, interval=interval, result_ttl=result_ttl)
