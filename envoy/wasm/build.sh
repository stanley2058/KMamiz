#!/usr/bin/env bash
rm -rf KMamizEnvoyFilter.wasm

docker run --rm \
  -v "$HOME"/go:/go \
  -v "$(pwd)":/src \
  -e "GOPATH=/go" \
  tinygo/tinygo:0.22.0 sh -c "cd /src && tinygo build -o KMamizEnvoyFilter.wasm -scheduler=none -target=wasi ./main.go"

# docker build . -t kmamiz-wasm-envoyfilter