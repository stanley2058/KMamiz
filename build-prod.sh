#!/usr/bin/env bash

DOCKER_BUILDKIT=1 docker build . -t kmamiz --build-arg APP_ENV=prod
