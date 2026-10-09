# E-Form Standalone

Standalone BizPortal e-form application with a Vite + Stimulus frontend and a NestJS backend. The backend decrypts `q`, manages BizPortal authentication, and proxies form, OTP, and file requests.

## Local development

```sh
cp .env.example .env
yarn install
yarn dev
```

Set `Q_SECRET_KEY` and `Q_SECRET_IV` in `.env` before starting. The application runs at:

- Form: `http://127.0.0.1:5173/forms/A-BA001/?q=...`
- API health check: `http://127.0.0.1:3000/api/health`

`yarn dev` starts both Vite and NestJS. Use `yarn dev:web` or `yarn dev:api` to run either service separately.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_BIZPORTAL_API_URL` | BizPortal API base URL | Development API |
| `FORM_CALLBACK_URL` | Redirect URL after form completion | Optional |
| `DISCORD_WEBHOOK_URL` | Discord webhook notified with create-application payload and response after a successful submission | Optional |
| `Q_SECRET_KEY` | AES-256 key used to decrypt `q` (64 hex characters) | Required |
| `Q_SECRET_IV` | AES-CBC IV used to decrypt `q` (32 hex characters) | Required |
| `FORM_CONFIG_FILE` | JSON file for form configs | `form-configs.json` |
| `HOST` | NestJS bind address | `127.0.0.1` |
| `PORT` | NestJS port | `3000` |

## Form configuration

Each form loads its `applicationId`, plaintext `applicationKey`, `serviceNo`, and `version` directly from `FORM_CONFIG_FILE`. `FORM_CALLBACK_URL` is read at runtime; these values never come from `q`.
The file is loaded when NestJS starts, so restart the service after changing it.

```json
[
  {
    "formCode": "A-BA001",
    "applicationId": 734,
    "applicationKey": "secret",
    "serviceNo": "service-number",
    "version": "1"
  }
]
```

`form-configs.json` contains plaintext application keys and is ignored by Git.

The form code must match an HTML file in `forms/`, for example `forms/A-BA001.html` is served at `/forms/A-BA001/`.

## Production

```sh
yarn build
yarn start
```

NestJS serves the built frontend and API at `http://127.0.0.1:3000`. Set `HOST=0.0.0.0` when running in a container.

## Docker Compose

```sh
cp .env.example .env
docker compose up --build
```

The service is available at `http://127.0.0.1:3001`. Compose bind-mounts `form-configs.json` to `/data/form-configs.json`; the container exits if the configured JSON file is missing, then sets its permissions to `0600` before starting as the unprivileged `node` user.

## Stored data

Form configuration is read from `FORM_CONFIG_FILE`. Authentication sessions are kept only in server memory and reset on every startup.
"# e-form-biz" 
