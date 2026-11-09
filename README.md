# IIIT Mess Management System

College mess portal for menus, meal skipping, billing, feedback and administration.

## Project layout

```text
backend/
  app.py             Flask API and static frontend server
  requirements.txt   Python dependencies
  seed_demo.py       Optional demo data
frontend/
  index.html
  style.css
  app.js
data/
  mess.db            Created on first run
```

## Run

Requires Python 3.10 or newer.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\app.py
```

Open http://localhost:3000. On first start, the app creates the SQLite database and loads the weekly menu. The default admin login is `admin` / `admin@123` (`ADMIN` is stored internally; login is case-insensitive). Change the default password after signing in. Set `ADMIN_PASSWORD` before the first run to choose a different initial admin password.

Optional demo accounts:

- Student: `B123076` / `iiit@123`
- Additional demo students: `IIIT2024002` to `IIIT2024008` / `Welcome@123`

```powershell
python backend\seed_demo.py
```

## Deploy on Vercel

This repository is configured for Vercel. The build command copies `frontend/` into `public/` so Vercel serves the page and assets from its CDN; Vercel detects the Flask app in `backend/app.py` and runs the API as a Python Function. Python 3.12 is pinned in `.python-version`.

Import the repository into Vercel and use the repository root as **Root Directory**. Let Vercel detect Flask (or select the Flask preset if prompted). The checked-in `vercel.json` supplies the asset build command.

The app uses local SQLite for local development. Vercel functions do not provide persistent local storage, so provision a hosted PostgreSQL database (for example, through the Vercel Marketplace) and add its connection string as `DATABASE_URL` in the Vercel project settings. Set the variables for Production and Preview as needed, then redeploy:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Hosted PostgreSQL connection string |
| `JWT_SECRET` | Long, random key used to sign login tokens. Generate a unique value and keep it private. |
| `ADMIN_PASSWORD` | Strong password for the first admin created in the hosted database |

The schema, default menu, and admin account are created on the first API request. Sign in as `ADMIN` with the `ADMIN_PASSWORD` value, then add student accounts from the admin dashboard. The local SQLite database and demo accounts are not copied to production. Keep `DATABASE_URL` and `JWT_SECRET` stable across deployments so data and existing login tokens continue to work.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MESS_TZ` | `Asia/Kolkata` | Timezone for meal times and cutoffs |
| `ADMIN_PASSWORD` | `admin@123` locally; required on Vercel | Initial admin password |
| `JWT_SECRET` | Stored in SQLite locally; required on Vercel | Token signing key |
| `DB_FILE` | `data/mess.db` | SQLite database path |
| `DATABASE_URL` | Unset | PostgreSQL URL; use this for Vercel or hosted databases |
| `HOSTELS` | Hostel A, Hostel B, Hostel C, Day scholar | Comma-separated hostel list |

Meal timings and prices, plus the default menu, are configured near the top of `backend/app.py`. The API paths and JSON payloads remain compatible with the existing frontend.

Students can view menus and bills, skip meals before service starts, send feedback and change passwords. Admins can manage students and menus, resolve feedback and export the monthly billing CSV.
