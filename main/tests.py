import logging


class SilentMixin(object):
    """ Hide logging output in tests.
    """
    def setUp(self):
        logging.disable(logging.CRITICAL)
        super().setUp()

    def tearDown(self):
        logging.disable(logging.NOTSET)
        super().tearDown()
