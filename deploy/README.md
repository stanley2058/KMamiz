# Deployment

To deploy KMamiz in your Kubernetes cluster, follow the steps below.

## Pre-requirements

1. [Istio](https://istio.io/latest/docs/setup/getting-started/) is installed in your cluster.
2. [Zipkin](https://istio.io/latest/docs/ops/integrations/zipkin/) is set up and enabled in Istio.
3. An available MongoDB instance (doesn't necessarily need to be local).

If you don't have a MongoDB instance or don't bother to set one up, you can use a [free MongoDB Atlas](https://www.mongodb.com/atlas/database) instance.

## Change the deployment template

Copy the `kmamiz-sample.yaml` file to `kmamiz.yaml` and edit it.

```bash
cp kmamiz-sample.yaml kmamiz.yaml
```

Change the missing fields in the `kmamiz.yaml` file, mainly `MONGODB_URI`. If you want to change the service port, change the `SERVICE_PORT` field in Deployment and the `port` field in Service.

If you plan to access KMamiz by assigning external IP to Service, you will probably want to change the `SERVICE_PORT` field in Deployment and the `port` field in Service to something other than `80`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kmamiz
  namespace: kmamiz-system
spec:
  replicas: 1 # KMamiz currently only supports one replica
  template:
    metadata:
      labels:
        app: kmamiz
    spec:
      serviceAccountName: kmamiz-reader
      containers:
        - name: kmamiz
          # if built your own image, swap this out
          image: "reg.stw.tw/kmamiz:latest"
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
              # SERVICE_PORT needs to match port set in Service
            - name: SERVICE_PORT
              value: "80"
            - name: MONGODB_URI
              value: "{your-mongodb-uri}" # <-- change this
              # ZIPKIN_URL should match the setting in global Envoy configuration
            - name: ZIPKIN_URL
              value: "http://zipkin.istio-system:9411"
              # KMamiz log level
            - name: LOG_LEVEL
              value: "info" # accept: verbose | info | warn | error
            - name: IS_RUNNING_IN_K8S
              value: "true"
              # needs to match global Envoy logging level
              # default value (warning) should always work
            - name: ENVOY_LOG_LEVEL
              value: "warning" # accept: info | warning | error
            - name: READ_ONLY_MODE
              value: "false"
            - name: ENABLE_TESTING_ENDPOINTS
              value: "false"
  selector:
    matchLabels:
      app: kmamiz
```

## Deploy KMamiz

```bash
kubectl create ns kmamiz-system
kubectl apply -f kmamiz-rbac.yaml
kubectl apply -f kmamiz.yaml
```

Check the status of your deployment. It should look like this:

```
❯ kubectl -n kmamiz-system get po
NAME                     READY   STATUS    RESTARTS   AGE
kmamiz-859465ddd-jwhmb   1/1     Running   0          7s
```

To access the webpage, you'll have to set up an Ingress route to KMamiz or assign an external IP to the Service.

To add an external IP to the Service:

```bash
kubectl -n kmamiz-system edit svc kmamiz
```

Find the `spec` section and add an `externalIPs` field. It should look something like this:

```yaml
spec:
  clusterIP: 10.108.106.175
  clusterIPs:
    - 10.108.106.175
  externalIPs: # <-- add this
    - 192.168.100.105 # <-- and this
```

Now you can access KMamiz at `http://<external-ip>:<service-port>`.

If you encounter any problem, try switching the `LOG_LEVEL` to `verbose` for more information.

## Deploy EnvoyFilter

NOTICE: This step is essential and can only be done after KMamiz is up and running.

Follow instructions [here](../envoy/README.md).

## Update KMamiz

KMamiz will notify all running instances to sync to the database before starting a new one. So you can update KMamiz by simply rolling out the deployment.

```bash
kubectl -n kmamiz-system rollout restart deploy/kmamiz
```
