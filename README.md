# Notes App

A small Notes app: **Node.js + Express** web/API tier and a **PostgreSQL** database. It is built for practising
Kubernetes deployments of an app that needs a database (Secrets, ConfigMaps, PersistentVolume, probes, Services).

- Web page to add, list and delete notes (shows which pod served you and whether the database is up)
- REST API (JSON)
- Creates its own table at start-up (no migration step needed)
- Runs as a non-root user; image is hardened and scanned (no fixable HIGH/CRITICAL findings)

## What you need to deploy it

| Component | Image | Port | Notes |
|---|---|---|---|
| App | build from the `Dockerfile` in this repo | `3000` | stateless, safe to run several replicas |
| Database | `postgres:16-alpine` | `5432` | needs a PersistentVolume for `/var/lib/postgresql/data` |

### App environment variables

| Variable | Default | Meaning |
|---|---|---|
| `DB_HOST` | `localhost` | name of the PostgreSQL Service (for example `notes-db`) |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `notes` | must match `POSTGRES_DB` |
| `DB_USER` | `notes` | must match `POSTGRES_USER` |
| `DB_PASSWORD` | *(none)* | **put this in a Secret**; must match `POSTGRES_PASSWORD` |
| `DB_POOL_MAX` | `5` | connections per pod |
| `PORT` | `3000` | |
| `APP_VERSION` | `dev` | shown in the page header, handy to see rollouts |

### Database (PostgreSQL) environment variables
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (Secret), and `PGDATA=/var/lib/postgresql/data/pgdata`
when the volume is mounted at `/var/lib/postgresql/data` (avoids the "lost+found" start-up error).

### Probes
| Probe | Path | Behaviour |
|---|---|---|
| Liveness | `GET /live` | `200` while the process runs; never touches the database |
| Readiness | `GET /health` | `200` when the database answers, `503` while it is starting or down |
| Startup | `GET /live` | the app retries the database for about 60 seconds, so a startup probe is optional |

### Behaviour worth knowing
- The app listens immediately and **keeps retrying the database** at start-up, so it does not crash if it starts before PostgreSQL.
- If the database goes away the pod turns *not ready* (readiness 503) but is **not restarted** (liveness stays 200), then recovers by itself.
- On `SIGTERM` it finishes requests and closes the connection pool (use the default 30 second termination grace period).
- Notes are stored in table `notes (id, title, body, created_at)`. Without a PersistentVolume the data disappears when the DB pod is recreated.

## API

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/notes` | | list, newest first |
| POST | `/api/notes` | `{"title": "...", "body": "..."}` (`body` optional) | `201` created note, `400` if invalid |
| DELETE | `/api/notes/:id` | | `204`, or `404` if it does not exist |
| GET | `/api/info` | | pod name, DB host/name, version |
| GET | `/health`, `/live` | | readiness / liveness |

Limits: `title` 1 to 100 characters, `body` up to 2000 characters.

## Deploy to Kubernetes (`k8s/` folder)

| File | What it creates |
|---|---|
| `namespace.yaml` | namespace `notes` |
| `secret.yaml` | `notes-db-secret` with the database password (**committed on purpose for this lab, see the warning inside**) |
| `configmap.yaml` | `notes-config`: DB host/port/name/user and `APP_VERSION` |
| `db.yaml` | PostgreSQL Service `notes-db` + StatefulSet with a 1 Gi persistent volume |
| `deployment.yaml` | the app, 2 replicas, probes, settings from the ConfigMap and Secret |
| `service.yaml` | Service `notes-app` (port 80 to container port 3000) |

`argocd/application.yaml` is an Argo CD Application that syncs the `k8s/` folder (apply it once; it is not part of `k8s/`).

```bash
kubectl apply -f k8s/                                   # create everything
kubectl get pods -n notes -w                            # wait for 1/1 Running
kubectl port-forward -n notes svc/notes-app 8098:80     # open http://localhost:8098
```

Before the first deploy:
1. The image `localhost:30600/notes-app:1` must exist in the in-cluster registry (build and push it, or let Jenkins do it).
2. Change the password in `k8s/secret.yaml`. Anything committed to git is visible to everyone who can see the repo.

These manifests were tested on a kind cluster: the app waits for the database, load-balances across pods, and the notes survive deleting the database pod.

## Run it locally (Docker Compose)
```bash
docker compose up -d --build        # app on http://localhost:3300, PostgreSQL alongside
curl http://localhost:3300/health
docker compose down -v              # stop and delete the local database volume
```
The password in `docker-compose.yml` is for local testing only. Do not reuse it in the cluster.

## Build the image
```bash
docker build -t notes-app:1 .
```

## Tests
```bash
npm ci
npm test            # unit tests for input validation (no database needed)
```
