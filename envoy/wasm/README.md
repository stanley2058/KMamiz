# KMamiz-WASM

> KMamiz WASM Envoy filter plugin written in Go

## Deployment

1. Run the `build.sh`, the script will build a docker image named `kmamiz-wasm`.
2. Tag it and push to your registry.

```bash
YOUR_REGISTRY=
docker tag kmamiz-wasm $YOUR_REGISTRY/kmamiz-wasm
docker push $YOUR_REGISTRY/kmamiz-wasm
```

## Development

1. (Optional) Install TinyGo
2. Download the [proxy-wasm-go-sdk](https://github.com/tetratelabs/proxy-wasm-go-sdk)

```bash
go mod edit -require=github.com/tetratelabs/proxy-wasm-go-sdk@main
go mod download github.com/tetratelabs/proxy-wasm-go-sdk
```

3. Watch out for unimplemented functionalities
4. To try out locally, run:

```bash
docker run -it --rm -v "$PWD"/envoy.yaml:/etc/envoy/envoy.yaml -v "$PWD"/KMamizEnvoyFilter.wasm:/etc/envoy/optimized.wasm -p 9901:9901 -p 10000:10000 envoyproxy/envoy:v1.17.0
```

5. Poke the endpoint at `http://localhost:10000` to see actions in terminal.

```
curl -X POST localhost:10000 -H 'Content-Type: application/json' --data '{"id": "xxx", "token": "xxx"}'
```

```
curl -X POST localhost:10000 -H 'Content-Type: application/json' --data '{"fruits":{"a":"apple","b":"banana"},"colors":["red","green"],"obj":{"enabled":true,"count":123},"objects":[{"name":"a","num":1},{"name":"b","num":2},{"name":"c","num":3}],"weird":{"b":null}}'
```
