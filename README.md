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

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `MESS_TZ` | `Asia/Kolkata` | Timezone for meal times and cutoffs |
| `ADMIN_PASSWORD` | Generated | Initial admin password |
| `JWT_SECRET` | Stored in SQLite | Override token signing key |
| `DB_FILE` | `data/mess.db` | SQLite database path |
| `HOSTELS` | Hostel A, Hostel B, Hostel C, Day scholar | Comma-separated hostel list |

Meal timings and prices, plus the default menu, are configured near the top of `backend/app.py`. The API paths and JSON payloads remain compatible with the existing frontend.

Students can view menus and bills, skip meals before service starts, send feedback and change passwords. Admins can manage students and menus, resolve feedback and export the monthly billing CSV.
