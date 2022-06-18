# Build

## Pre-build

To build KMamiz, you'll have to build [KMamiz-Web](https://github.com/stanley2058/KMamiz-Web) image first, then build the [KMAmiz WASM EnvoyFilter](./envoy/wasm/README.md).

## Build KMamiz

Build KMamiz with Docker BuildKit (with unit testing):

```bash
./build.sh
```

Build KMamiz with Docker BuildKit (skip unit testing):

```bash
./build-prod.sh
```

If your system does not support Docker BuildKit, or you are on SELinux based system:

```bash
./build-without-buildkit.sh
```

Remember to push it to your registry:

```bash
docker tag kmamiz <your-registry>/kmamiz:<tag>
docker push <your-registry>/kmamiz:<tag>
```
