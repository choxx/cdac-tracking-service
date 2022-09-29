# CDAC Tracking Service

# Installation
- copy `.env.example` file to `.env` & configure all the variables as pe need
- Hit `docker-compose up -d` which will start the app on the configured port in `.env`
- If you want to host stand alone Hasura as well for this service, navigate to `hasura` directory:
    - copy `sample.config.yaml` to `config.yaml` & configure the endpoint & secret for the Hasura (as defined in `../.env`).
    - hit `docker-compose up -d`