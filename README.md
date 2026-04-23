# Your Chat MVP

A minimalist 1-on-1 chat application built with Flask, SQLAlchemy, Flask-SocketIO, and a pluggable storage/auth architecture.

## What is included

- Phone-based OTP sign-in with a dev-mode OTP provider
- Server-side session records with HTTP-only cookies
- Profile bootstrap flow for new users
- 1-on-1 conversation lookup by phone number
- Real-time text messaging with Socket.IO events
- Attachment uploads for images, video, PDF, Word, PowerPoint, and Excel
- Shared-files gallery per conversation
- Local storage fallback and Microsoft Graph storage abstraction
- Settings persistence for profile and user preferences
- Demo data seeding for fast local validation

## Quick start

1. Install dependencies:

```powershell
python -m pip install -r requirements.txt
```

2. Copy environment defaults if needed:

```powershell
Copy-Item .env.example .env
```

3. Start the app:

```powershell
python run.py
```

4. Open the app at [http://127.0.0.1:5000](http://127.0.0.1:5000)

## GitHub Codespaces

If you want to share a live demo without setting up paid hosting first, GitHub Codespaces is the easiest path for this repo.

1. Open the GitHub repo and create a new Codespace on `main`.
2. Wait for the dev container to finish setup. The repo includes a `.devcontainer/devcontainer.json` file that installs Python dependencies automatically.
3. In the Codespaces terminal, start the app:

```bash
python run.py
```

4. Open the `PORTS` tab and find port `5000`.
5. Right-click port `5000` and change visibility to `Public`.
6. Copy the `https://...app.github.dev` URL and send it to your friend.

Notes:

- The port must stay on `HTTP`. GitHub notes that if you switch a public forwarded port to `HTTPS`, its visibility changes back to private.
- Codespaces is good for demos, but it is not permanent hosting. If the codespace stops, the app goes offline.
- This repo uses dev OTP mode by default, so the OTP code is shown in the UI for testing.

## Internet deployment

The app can be deployed publicly so another person can use it from a different network, but there is one important auth caveat:

- `OTP_PROVIDER_MODE=dev` works for demos, but it is not secure for a public app because the OTP is exposed in the UI.
- For real private use, you should integrate a real SMS OTP provider before sharing the URL broadly.

### Recommended simplest path: Render

This repo now includes:

- `render.yaml` for a Render web service + managed Postgres
- `Procfile` for generic process-based platforms
- `gunicorn` and `psycopg` in `requirements.txt`
- `PORT`/`HOST` aware startup in `run.py`

### Render deployment steps

1. Push this project to GitHub.
2. Create a new [Render Blueprint](https://render.com/docs/blueprint-spec) from the repo.
3. Let Render create:
   - the web service
   - the managed Postgres database
4. After the first deploy, open the service settings and verify these values:
   - `SESSION_COOKIE_SECURE=true`
   - `AUTO_SEED_DEMO=false`
   - `OTP_PROVIDER_MODE=dev` only if you are okay with demo-only auth
5. Share the Render app URL with your friend.

### Storage note

- The included `render.yaml` mounts a persistent disk for local file storage.
- If you want durable shared file storage across environments and cleaner long-term behavior, configure Microsoft Graph and switch `STORAGE_MODE=graph`.

### Production auth note

If you want this to be safe for real-world use, the next step should be implementing an actual SMS provider behind `SmsOtpProvider`.

## Local development defaults

- Database: SQLite at `instance/chat_app.db`
- OTP mode: `dev`
- Storage mode: `auto`
  - Uses Microsoft Graph if credentials are configured
  - Falls back to local storage otherwise
- Demo users are automatically seeded by default:
  - `+15550000001`
  - `+15550000002`

In dev OTP mode, the OTP is shown on screen after requesting it and also logged to the server console.

## Useful commands

Create missing tables:

```powershell
flask --app run.py init-db
```

Refresh demo data:

```powershell
flask --app run.py seed-demo
```

Run tests:

```powershell
pytest
```

## Environment variables

### Core

- `SECRET_KEY`
- `DATABASE_URL`
- `SESSION_COOKIE_SECURE`
- `SESSION_LIFETIME_DAYS`

### OTP

- `OTP_PROVIDER_MODE=dev|sms`
- `DEV_OTP_EXPOSE_CODE=true|false`
- `OTP_LENGTH`
- `OTP_EXPIRY_SECONDS`
- `OTP_RATE_LIMIT_WINDOW_SECONDS`
- `OTP_MAX_REQUESTS_PER_WINDOW`
- `OTP_MAX_VERIFY_ATTEMPTS`

### Storage

- `STORAGE_MODE=auto|local|graph`
- `LOCAL_STORAGE_ROOT`
- `MAX_UPLOAD_SIZE_MB`

### Microsoft Graph / Entra ID

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_SHARE_LINK`
- `GRAPH_SITE_ID`
- `GRAPH_DRIVE_ID`
- `GRAPH_ROOT_ITEM_ID`
- `GRAPH_SIMPLE_UPLOAD_MAX_BYTES`

## Microsoft Graph setup

1. Register an application in Microsoft Entra ID.
2. Grant the least-privilege Microsoft Graph permissions required for the target document library or shared drive location.
3. Capture:
   - tenant ID
   - client ID
   - client secret or certificate flow equivalent
4. Set `GRAPH_SHARE_LINK` to the shared OneDrive/SharePoint folder entry point.
5. Optionally set `GRAPH_SITE_ID`, `GRAPH_DRIVE_ID`, and `GRAPH_ROOT_ITEM_ID` directly if you already resolved them.
6. Set `STORAGE_MODE=graph` to force Graph in environments where local fallback should be disabled.

## Project layout

- `app/__init__.py`: app factory, startup hooks, CLI, database initialization
- `app/models.py`: SQLAlchemy models
- `app/auth`, `app/users`, `app/conversations`, `app/messages`, `app/files`, `app/settings`: blueprints
- `app/services`: OTP, sessions, conversations, messaging, file handling, storage, serialization, demo seed data
- `app/templates`: Jinja templates using the existing minimalist visual direction
- `app/static/js`: page-level JavaScript for OTP, messaging, uploads, gallery filtering, and settings persistence
- `tests`: pytest coverage for major flows

## Notes

- The Graph storage provider is implemented and ready for real credentials, but local storage remains the default fallback for unconfigured environments.
- The `sms` OTP provider mode is intentionally a production placeholder. In local development, use `OTP_PROVIDER_MODE=dev`.
