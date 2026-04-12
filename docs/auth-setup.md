# Auth & Supabase setup

TRIBE UX Analyzer uses [Supabase](https://supabase.com) for three things:

1. **Authentication** — Google OAuth, GitHub OAuth, and email/password.
2. **Database** — persistent storage for `projects` and `runs` (Postgres with Row-Level Security).
3. **JWT issuance** — Supabase signs access tokens; the FastAPI backend validates them with the shared JWT secret.

This document walks through the one-time setup so a new contributor can get auth working locally.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → pick any org, name it `tribe-uiux-dev`, pick the nearest region, pick a strong DB password, and wait ~2 minutes for it to provision.
3. Under **Project Settings → API**, copy these values into the project-root `.env` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (and `SUPABASE_URL` for the backend — see below)
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(backend only — never expose to the browser)*
4. Under **Project Settings → API → JWT Settings**, copy the **JWT Secret** → `SUPABASE_JWT_SECRET`.

The `.env` at the project root should look like this:

```
# Supabase — paste real values from dashboard
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
SUPABASE_JWT_SECRET="super-secret-string"
AUTH_REQUIRED=true

# Optional
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="eyJhbGci..."

# Anthropic API (for real LLM analysis)
ANTHROPIC_API_KEY="sk-ant-..."
```

> `NEXT_PUBLIC_*` vars are bundled into the client by Next.js. The backend also reads `SUPABASE_URL` / `SUPABASE_ANON_KEY` (no prefix) — `docker-compose.yml` maps the public vars onto those names automatically so you only have to set them once.

---

## 2. Enable auth providers

In the Supabase dashboard → **Authentication → Providers**:

### Email

- Already enabled. For local dev, **disable "Confirm email"** so you can sign in immediately with a freshly-created password account. Re-enable before production.

### Google

1. Head to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create OAuth client ID** → **Web application**.
3. Under **Authorized redirect URIs**, add:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client secret** back into Supabase's Google provider form, then hit **Save**.

### GitHub

1. Head to [GitHub → Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/developers).
2. **Homepage URL**: `http://localhost:3000`
3. **Authorization callback URL**:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Generate a client secret, then paste the **Client ID** + **Client secret** into Supabase's GitHub provider form and **Save**.

---

## 3. Allow the local frontend origin

Supabase **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000` (and any other origins you plan to use).

Without this, OAuth redirects from Google/GitHub will bounce back to an "invalid redirect URL" error.

---

## 4. Run the database migration

Open **SQL editor → New query**, paste the contents of `backend/migrations/001_auth_projects_runs.sql`, and hit **Run**. This creates the `projects` and `runs` tables, indexes, and RLS policies.

You can verify with:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('projects','runs');
```

---

## 5. Start the app

```bash
docker compose up --build
```

- Backend: http://localhost:9100
- Frontend: http://localhost:3000

When `AUTH_REQUIRED=true`, landing on the frontend will show the **LoginView**. Sign up with email/password, or click "Continue with Google" / "Continue with GitHub".

To verify the backend is validating tokens correctly, open DevTools → Application → LocalStorage on `localhost:3000`, find the `sb-<project-ref>-auth-token` entry, copy the `access_token` field, and run:

```bash
curl -s http://localhost:9100/api/projects \
  -H "Authorization: Bearer <access_token>"
```

You should see `[]` (no projects yet) rather than a 401.

---

## Troubleshooting

| Symptom                                                  | Likely cause                                                        |
|----------------------------------------------------------|----------------------------------------------------------------------|
| Frontend stuck on login screen, no errors                 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` missing |
| Backend 401s on every authed request                     | `SUPABASE_JWT_SECRET` mismatched with the project's JWT secret       |
| OAuth "redirect URL not allowed"                          | Missing `http://localhost:3000` in Supabase URL Configuration        |
| `POST /api/projects` returns 503 "Supabase not configured"| `SUPABASE_SERVICE_ROLE_KEY` is empty                                 |
| RLS "permission denied" on a query                        | Using anon key instead of service-role key in the backend           |

---

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` only appears in backend env — search the frontend with `rg SERVICE_ROLE frontend-next/` and expect zero hits.
- [ ] `.env` is gitignored (it is, in the repo root `.gitignore`).
- [ ] CORS `cors_origins` in `backend/app/config.py` does not contain `"*"`.
- [ ] RLS is enabled on `projects` and `runs` (verify in Supabase: **Database → Policies** — both tables show 4 policies each).
- [ ] Before production: re-enable email confirmation in Supabase.
