# EnvoyFilter

## Deploy EnvoyFilter

First, copy the example:

```bash
cp EnvoyFilter-WASM.example.yaml EnvoyFilter-WASM.yaml
```

If you changed the service port or namespace, you would need to address the binary URI accordingly.

```
Default: http://kmamiz.kmamiz-system.svc:80/wasm/KMamizEnvoyFilter.wasm
Spec: http(s)://<service>.<namespace>.svc:<port>/wasm/KMamizEnvoyFilter.wasm
```

```yaml
spec:
  configPatches:
    - applyTo: EXTENSION_CONFIG
      patch:
        operation: ADD
        value:
          name: kmamiz-wasm-envoyfilter
          typed_config:
            "@type": type.googleapis.com/envoy.extensions.filters.http.wasm.v3.Wasm
            config:
              root_id: kmamiz-wasm-envoyfilter
              vm_config:
                vm_id: kmamiz-wasm-envoyfilter
                runtime: envoy.wasm.runtime.v8
                code:
                  remote:
                    http_uri:
                      # <-- change this if your configuration is different -->
                      uri: http://kmamiz.kmamiz-system.svc:80/wasm/KMamizEnvoyFilter.wasm
```

And deploy the config:

```bash
kubectl -n istio-system apply -f EnvoyFilter-WASM.yaml
```

You would probably need to wait a bit for the setting to apply to the Envoy proxy. Once it is ready, you can verify it's working by examining logs from the `istio-proxy`. It should look something like this:

This is an example from Istio's Bookinfo demo.

```
kubectl -n book logs deploy/reviews-v2 istio-proxy
```

```
2022-06-18T11:00:33.680561Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Request e2feaf51-ab88-976e-867a-8225a154cb84/24da1b0f6b313a1421cdf28553101f4c/3a0fe95767efd767/NO_ID] [GET /ratings/0]
2022-06-18T11:00:33.680585Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Response e2feaf51-ab88-976e-867a-8225a154cb84/24da1b0f6b313a1421cdf28553101f4c/NO_ID/NO_ID] [Status] 200 [ContentType application/json] [Body] {"id": 0, "ratings": {"Reviewer1": 0, "Reviewer2": 0}}
2022-06-18T11:00:33.682196Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Request e2feaf51-ab88-976e-867a-8225a154cb84/24da1b0f6b313a1421cdf28553101f4c/d5b926a3e7d1fe6e/709d6491ac19f0bb] [GET /reviews/0]
2022-06-18T11:00:33.682226Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Response e2feaf51-ab88-976e-867a-8225a154cb84/24da1b0f6b313a1421cdf28553101f4c/NO_ID/NO_ID] [Status] 200 [ContentType application/json] [Body] {"id": "", "reviews": [{"reviewer": "", "text": "", "rating": {"stars": 0, "color": ""}}, {"reviewer": "", "text": "", "rating": {"stars": 0, "color": ""}}]}
2022-06-18T11:00:33.843446Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Request 9534c176-6f0f-9df5-80b5-75c8b2f10caa/54d067035e02bcac6c1c0cc969c809fb/a700c3b02f7d5752/NO_ID] [GET /ratings/0]
2022-06-18T11:00:33.843471Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Response 9534c176-6f0f-9df5-80b5-75c8b2f10caa/54d067035e02bcac6c1c0cc969c809fb/NO_ID/NO_ID] [Status] 200 [ContentType application/json] [Body] {"id": 0, "ratings": {"Reviewer1": 0, "Reviewer2": 0}}
2022-06-18T11:00:33.844887Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Request 9534c176-6f0f-9df5-80b5-75c8b2f10caa/54d067035e02bcac6c1c0cc969c809fb/79a7f4b31e9fff55/45e9a91eee0639a4] [GET /reviews/0]
2022-06-18T11:00:33.844905Z	warning	envoy wasm	wasm log kmamiz-wasm-envoyfilter kmamiz-wasm-envoyfilter: [Response 9534c176-6f0f-9df5-80b5-75c8b2f10caa/54d067035e02bcac6c1c0cc969c809fb/NO_ID/NO_ID] [Status] 200 [ContentType application/json] [Body] {"id": "", "reviews": [{"reviewer": "", "text": "", "rating": {"stars": 0, "color": ""}}, {"reviewer": "", "text": "", "rating": {"stars": 0, "color": ""}}]}
```

## Build EnvoyFilter

If you want to build KMamiz yourself, you'll have to build the EnvoyFilter first.

_See [here](./wasm/README.md)._
