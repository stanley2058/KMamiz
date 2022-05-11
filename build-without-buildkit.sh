#!/usr/bin/env bash

# buildkit could break on selinux, so use plain docker build
docker build . -t kmamiz
