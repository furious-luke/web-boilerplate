from django.db import migrations
from django.contrib.postgres.operations import (
    HStoreExtension, TrigramExtension
)


class Migration(migrations.Migration):
    initial = True
    operations = [
        HStoreExtension(),
        TrigramExtension(),
    ]
