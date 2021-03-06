FROM heroku/cedar:14
MAINTAINER Luke Hodkinson <furious.luke@gmail.com>

ENV PORT 3000
ENV PYTHON_VERSION python-3.5.1
ENV PATH /app/.heroku/python/bin/:$PATH

RUN mkdir -p /app/.heroku/python /app/.profile.d \
    /app/user/requirements/boilerplate \
    /app/user/keys /app/user/var /app/user/boilerplate
WORKDIR /app/user

RUN curl -s https://lang-python.s3.amazonaws.com/cedar-14/runtimes/$PYTHON_VERSION.tar.gz | tar zx -C /app/.heroku/python
RUN curl -s https://bootstrap.pypa.io/get-pip.py | /app/.heroku/python/bin/python

RUN echo 'export PATH=$HOME/.heroku/python/bin:$PATH PYTHONUNBUFFERED=true PYTHONHOME=/app/.heroku/python LIBRARY_PATH=/app/.heroku/vendor/lib:/app/.heroku/python/lib:$LIBRARY_PATH LD_LIBRARY_PATH=/app/.heroku/vendor/lib:/app/.heroku/python/lib:$LD_LIBRARY_PATH LANG=${LANG:-en_US.UTF-8} PYTHONHASHSEED=${PYTHONHASHSEED:-random} PYTHONPATH=${PYTHONPATH:-/app/user/}' > /app/.profile.d/python.sh
RUN chmod +x /app/.profile.d/python.sh

ADD boilerplate/requirements/boilerplate /app/user/requirements/boilerplate
ADD requirements /app/user/requirements
RUN /app/.heroku/python/bin/pip install -r requirements/production.txt

ADD manage.py /app/user/
ADD webpack-stats.production.json /app/user/
ADD scripts/*.sh /app/user/scripts/
ADD scripts/*.conf /app/user/scripts/

ARG project
ADD ${project} /app/user/${project}/
ADD boilerplate/__init__.py /app/user/boilerplate
ADD boilerplate/manage.py /app/user/boilerplate
ENV PYTHONPATH=/app/user/${project}:$PYTHONPATH
ENV DJANGO_SETTINGS_MODULE=${project}.settings.production
ENV ASGI_APP=${project}.asgi:channel_layer
RUN echo 'export PYTHONPATH=/app/user/${project}/:$PYTHONPATH' >> /app/.profile.d/python.sh

ARG run
ENV RUN=${run}
CMD ./scripts/${RUN}.sh
