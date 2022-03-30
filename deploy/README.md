# Deployment

First change the missing fields in `kmamiz-sample.yaml`, mainly `image` and `MONGODB_URI`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kmamiz
  namespace: kmamiz-system
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: kmamiz
    spec:
      containers:
        - name: kmamiz
          image: "{your-image}" # <--- here
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: 3000
            - name: MONGODB_URI
              value: "{your-mongodb-uri}" # <--- and here
            - name: ZIPKIN_URL
              value: "http://zipkin.istio-system:9411"
            - name: LOG_LEVEL
              value: "info"
            - name: IS_RUNNING_IN_K8S
              value: true
            - name: ENVOY_LOG_LEVEL
              value: "warning" # accept: info | warning | error
            - name: READ_ONLY_MODE
              value: false
            - name: ENABLE_TESTING_ENDPOINTS
              value: false
  selector:
    matchLabels:
      app: kmamiz
```

To enable envoy logging, deploy one of the EnvoyFilter in the [envoy directory](../envoy/). Don't forget to adjust the `ENVOY_LOG_LEVEL` accordingly.
