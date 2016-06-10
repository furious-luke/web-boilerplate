import logging

from django.test import TestCase
from django.core.urlresolvers import reverse
from supertest.clients import AjaxClient
from model_mommy import mommy
from db_mutex import db_mutex

from ..models import Action


class DeployApplicationTestCase(TestCase):

    def setUp(self):
        logging.disable(logging.CRITICAL)
        self.client = AjaxClient()
        self.app = mommy.make('Application')
        self.other_app = mommy.make('Application')

    def tearDown(self):
        logging.disable(logging.NOTSET)

    def test_db_mutex_accept(self):
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        self.assertNotEqual(resp['status'], 'blocked')

    def test_db_mutex_reject(self):
        with db_mutex.db_mutex('deploy'):
            resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        self.assertEqual(resp['status'], 'blocked')

    def test_uses_ongoing_deployment(self):
        deploy = mommy.make('main.Action', type=Action.DEPLOY_TYPE)
        deploy.apps.add(self.app)
        deploy.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        self.assertEqual(resp['status'], 'existing')

    def test_skips_ongoing_deployment_for_different_app(self):
        deploy = mommy.make('main.Action', type=Action.DEPLOY_TYPE)
        deploy.apps.add(self.other_app)
        deploy.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        self.assertNotEqual(resp['status'], 'existing')

    def test_uses_ongoing_build(self):
        build = mommy.make('main.Action', type=Action.BUILD_SLUG_TYPE)
        build.apps.add(self.app)
        build.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        deploy = Action.objects.get(pk=resp['deploy'])
        self.assertEqual(deploy.dependencies.all()[0], build)

    def test_uses_ongoing_build_for_different_app(self):
        build = mommy.make('main.Action', type=Action.BUILD_SLUG_TYPE)
        build.apps.add(self.other_app)
        build.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        deploy = Action.objects.get(pk=resp['deploy'])
        self.assertEqual(deploy.dependencies.all()[0], build)

    def test_creates_new_build(self):
        self.assertEqual(Action.objects.filter(type=Action.BUILD_SLUG_TYPE).exists(), False)
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        build = Action.objects.get(type=Action.BUILD_SLUG_TYPE)

    def test_new_build_is_launched(self):
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        build = Action.objects.get(type=Action.BUILD_SLUG_TYPE)
        self.assertEqual(build.status, Action.ACTIVE_STATUS)

    def test_new_build_depends_on_prior_action(self):
        prior = Action.objects.create(type=Action.MIGRATE_TYPE)
        prior.apps.add(self.app)
        prior.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        build = Action.objects.get(type=Action.BUILD_SLUG_TYPE)
        self.assertEqual(list(build.dependencies.all()), [prior])

    def test_new_deploy_depends_on_build(self):
        prior = Action.objects.create(type=Action.MIGRATE_TYPE)
        prior.apps.add(self.app)
        prior.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        build = Action.objects.get(type=Action.BUILD_SLUG_TYPE)
        deploy = Action.objects.get(type=Action.DEPLOY_TYPE)
        self.assertEqual(list(deploy.dependencies.all()), [build])

    def test_new_deploy_depends_on_prior_action_if_pre_existing_build(self):
        build = Action.objects.create(type=Action.BUILD_SLUG_TYPE)
        build.apps.add(self.app)
        build.save()
        prior = Action.objects.create(type=Action.MIGRATE_TYPE)
        prior.apps.add(self.app)
        prior.save()
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        deploy = Action.objects.get(type=Action.DEPLOY_TYPE)
        self.assertEqual(list(deploy.dependencies.all()), [build, prior])

    def test_migrate_depends_on_deploy(self):
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        deploy = Action.objects.get(type=Action.DEPLOY_TYPE)
        migrate = Action.objects.get(type=Action.MIGRATE_TYPE)
        self.assertEqual(list(migrate.dependencies.all()), [deploy])

    def test_refresh_depends_on_migrate(self):
        resp = self.client.post(reverse('application-deploy', args=(self.app.pk,)), {}, json=True)
        self.assertEqual(resp.status_code, 200)
        resp = self.client.content(resp)
        migrate = Action.objects.get(type=Action.MIGRATE_TYPE)
        refresh = Action.objects.get(type=Action.REFRESH_TYPE)
        self.assertEqual(list(refresh.dependencies.all()), [migrate])
