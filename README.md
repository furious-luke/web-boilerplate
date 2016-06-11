# Web Boilerplate

## Quickstart

```
./scripts/setup_project.sh myproject
pip3 install invoke
inv build
inv migrate
inv up
```

Then go to `localhost:8000`.


## Production version

```
./scripts/gen_dev_ssc.sh
inv build -p
inv migrate -p
inv up -p
```

Then go to `https://localhost:8080`.


## Deployment

Requires a Heroku app of the same name as the project.

```
npm build:prod
inv cs
inv deploy
```
