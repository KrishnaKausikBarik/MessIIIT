import csv
import io
import os
import re
import secrets
import sqlite3
import time
from datetime import date, datetime, timedelta
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from flask import Flask, g, jsonify, make_response, request, send_from_directory

ROOT = Path(__file__).resolve().parent.parent
DB_FILE = Path(os.getenv("DB_FILE", ROOT / "data" / "mess.db"))
DB_FILE.parent.mkdir(parents=True, exist_ok=True)
FRONTEND = ROOT / "frontend"
TZ = ZoneInfo(os.getenv("MESS_TZ", "Asia/Kolkata"))
SECRET = os.getenv("JWT_SECRET")
HOSTELS = [x.strip() for x in os.getenv("HOSTELS", "Hostel A,Hostel B,Hostel C,Day scholar").split(",")]
MEALS = [
    {"id": "breakfast", "name": "Breakfast", "start": 7.5, "end": 9.5, "price": 30},
    {"id": "lunch", "name": "Lunch", "start": 12.5, "end": 14.5, "price": 55},
    {"id": "snacks", "name": "Snacks", "start": 17, "end": 18, "price": 15},
    {"id": "dinner", "name": "Dinner", "start": 19.5, "end": 21.5, "price": 55},
]
DEFAULT_MENU = {
    1: ['Poha, boiled egg, tea', 'Rajma, jeera rice, roti, salad', 'Samosa, chutney, tea', 'Paneer butter masala, roti, dal, kheer'],
    2: ['Idli, sambar, coconut chutney', 'Veg pulao, raita, dal tadka, papad', 'Bread pakoda, tea', 'Chicken curry or soya chunks, rice, roti'],
    3: ['Aloo paratha, curd, tea', 'Chole, bhature, onion salad', 'Masala corn, tea', 'Veg biryani, raita, gulab jamun'],
    4: ['Upma, banana, tea', 'Kadhi, rice, mixed veg, roti', 'Sandwich, ketchup, tea', 'Egg curry or mushroom masala, rice, roti'],
    5: ['Dosa, sambar, chutney', 'Dal makhani, jeera rice, roti, salad', 'Pav bhaji, tea', 'Fish curry or paneer tikka, rice, roti, ice cream'],
    6: ['Puri, aloo sabzi, tea', 'Veg thali, curd, papad', 'Maggi, tea', 'Fried rice, manchurian, soup'],
    0: ['Chole kulche, tea', 'Special lunch: pulao, paneer, dal, sweet', 'Biscuits, fruit, tea', 'Dal, rice, mix veg, roti, custard'],
}
app = Flask(__name__, static_folder=None)

def connect():
    if "db" not in g:
        g.db = sqlite3.connect(DB_FILE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(_=None):
    db = g.pop("db", None)
    if db:
        db.close()

def init_db():
    db = sqlite3.connect(DB_FILE)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,roll TEXT NOT NULL UNIQUE,hostel TEXT NOT NULL DEFAULT '',role TEXT NOT NULL CHECK(role IN ('student','admin')),pw TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS menu(day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6),meal INTEGER NOT NULL CHECK(meal BETWEEN 0 AND 3),items TEXT NOT NULL,PRIMARY KEY(day,meal));
    CREATE TABLE IF NOT EXISTS skips(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,date TEXT NOT NULL,meal TEXT NOT NULL,PRIMARY KEY(user_id,date,meal));
    CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,date TEXT NOT NULL,meal TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL DEFAULT '',resolved INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY,v TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_skips_date ON skips(date);
    """)
    if not db.execute("SELECT 1 FROM menu LIMIT 1").fetchone():
        db.executemany("INSERT INTO menu(day,meal,items) VALUES(?,?,?)", [(d, i, v) for d, values in DEFAULT_MENU.items() for i, v in enumerate(values)])
    if not db.execute("SELECT 1 FROM users WHERE role='admin' LIMIT 1").fetchone():
        pw = os.getenv("ADMIN_PASSWORD") or "admin@123"
        hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
        db.execute("INSERT INTO users(name,roll,hostel,role,pw) VALUES('Mess Office','ADMIN','Office','admin',?)", (hashed,))
        print(f"\nCreated admin account\nRoll number: ADMIN\nPassword: {pw}\nChange this password after signing in.\n")
    db.commit()
    db.close()

def now_parts():
    n = datetime.now(TZ)
    return {"date": n.date().isoformat(), "hour": n.hour + n.minute / 60}

def clean(v, maximum):
    return re.sub(r"[\x00-\x1f]", " ", str(v or "")).strip()[:maximum]

def public_user(u):
    return {k: u[k] for k in ("id", "name", "roll", "hostel", "role")}

def error(code, message):
    return jsonify(error=message), code

def body():
    if not request.is_json:
        return {}
    return request.get_json(silent=True) or {}

def auth(role=None):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            try:
                token = request.headers.get("Authorization", "").removeprefix("Bearer ")
                # Older Node tokens stored the numeric user id in `sub`; allow
                # that legacy claim while validating and converting it below.
                payload = jwt.decode(token, SECRET, algorithms=["HS256"], options={"verify_sub": False})
                user_id = int(payload["sub"])
                user = connect().execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
                if not user:
                    raise ValueError()
                if role and user["role"] != role:
                    return error(403, "You do not have access to this")
                g.user = user
            except Exception as exc:
                app.logger.warning("Authentication rejected: %s", exc)
                return error(401, "Please sign in again")
            return fn(*args, **kwargs)
        return wrapped
    return decorator

@app.before_request
def security_headers():
    if request.content_length and request.content_length > 10 * 1024:
        return error(400, "Invalid request body")

@app.after_request
def headers(response):
    response.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin", "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'"})
    return response

@app.errorhandler(404)
def not_found(_):
    return error(404, "Not found")

@app.post("/api/login")
def login():
    # In-memory per-IP throttle: 20 attempts per 15 minute window.
    ip = request.remote_addr or "unknown"
    attempts = app.config.setdefault("login_attempts", {})
    now = time.time()
    attempts[ip] = [t for t in attempts.get(ip, []) if now - t < 900]
    if len(attempts[ip]) >= 20:
        return error(429, "Too many attempts. Try again in a few minutes.")
    attempts[ip].append(now)
    data = body()
    requested_role = data.get("role")
    if requested_role not in (None, "student", "admin"):
        return error(400, "Choose Student or Admin")
    u = connect().execute("SELECT * FROM users WHERE roll=?", (clean(data.get("roll"), 40).upper(),)).fetchone()
    try:
        valid = u and bcrypt.checkpw(str(data.get("password") or "").encode(), u["pw"].encode())
    except ValueError:
        valid = False
    if not valid or (requested_role and u["role"] != requested_role):
        return error(401, "Roll number or password is incorrect")
    # JWT's subject claim must be a string (PyJWT 2.10+ enforces this).
    token = jwt.encode({"sub": str(u["id"]), "exp": datetime.now(TZ) + timedelta(hours=12)}, SECRET, algorithm="HS256")
    return jsonify(token=token, user=public_user(u))

@app.post("/api/password")
@auth()
def password():
    data = body()
    if not bcrypt.checkpw(str(data.get("current") or "").encode(), g.user["pw"].encode()):
        return error(400, "Current password is incorrect")
    new = str(data.get("next") or "")
    if len(new) < 8:
        return error(400, "New password must be at least 8 characters")
    connect().execute("UPDATE users SET pw=? WHERE id=?", (bcrypt.hashpw(new.encode(), bcrypt.gensalt()).decode(), g.user["id"]))
    return "", 204

def hour_label(hour):
    h = int(hour); m = round((hour - h) * 60)
    return f"{((h + 11) % 12) + 1}:{m:02d} {'pm' if h >= 12 else 'am'}"

@app.get("/api/bootstrap")
@auth()
def bootstrap():
    db, u = connect(), g.user
    admin = u["role"] == "admin"
    month_start = now_parts()["date"][:7] + "-01"
    menu = {}
    for r in db.execute("SELECT day,meal,items FROM menu"):
        menu.setdefault(str(r["day"]), [None] * 4)[r["meal"]] = r["items"]
    params = () if admin else (u["id"],)
    clause = "" if admin else " AND id=?"
    students = [dict(r) for r in db.execute("SELECT id,name,roll,hostel FROM users WHERE role='student'" + clause + " ORDER BY roll", params)]
    skips = {}
    sql = "SELECT user_id,date,meal FROM skips WHERE date>=?" + ("" if admin else " AND user_id=?")
    for r in db.execute(sql, (month_start,) + params):
        skips.setdefault(str(r["user_id"]), {})[r["date"] + "|" + r["meal"]] = 1
    fs = db.execute("SELECT f.id,f.user_id AS sid,f.date,f.meal,f.rating,f.text,f.resolved,u.name AS author,u.hostel FROM feedback f JOIN users u ON u.id=f.user_id " + ("" if admin else "WHERE f.user_id=? ") + "ORDER BY f.id DESC LIMIT 300", params)
    feedback = [{**dict(r), "resolved": bool(r["resolved"])} for r in fs]
    meals = [{**m, "label": f"{hour_label(m['start'])}–{hour_label(m['end'])}"} for m in MEALS]
    return jsonify(user=public_user(u), hostels=HOSTELS, now=now_parts(), menu=menu, students=students, skips=skips, fb=feedback, meals=meals)

def check_skip(ds, meal):
    try:
        d = date.fromisoformat(ds)
        if d.isoformat() != ds:
            raise ValueError()
    except (TypeError, ValueError):
        return "Invalid meal or date"
    m = next((x for x in MEALS if x["id"] == meal), None)
    if not m:
        return "Invalid meal or date"
    t = now_parts(); today = date.fromisoformat(t["date"])
    if d < today or (d == today and t["hour"] >= m["start"]):
        return "This meal has already started"
    if d > today + timedelta(days=45):
        return "You can only skip meals up to 45 days ahead"
    return None

@app.post("/api/skips")
@auth("student")
def add_skip():
    d = body(); msg = check_skip(d.get("date"), d.get("meal"))
    if msg: return error(400, msg)
    connect().execute("INSERT OR IGNORE INTO skips(user_id,date,meal) VALUES(?,?,?)", (g.user["id"], d["date"], d["meal"]))
    return "", 204

@app.delete("/api/skips/<ds>/<meal>")
@auth("student")
def remove_skip(ds, meal):
    msg = check_skip(ds, meal)
    if msg: return error(400, msg)
    connect().execute("DELETE FROM skips WHERE user_id=? AND date=? AND meal=?", (g.user["id"], ds, meal))
    return "", 204

@app.post("/api/feedback")
@auth("student")
def add_feedback():
    d = body(); meal, text = d.get("meal"), clean(d.get("text"), 500)
    try: rating = int(d.get("rating"))
    except (ValueError, TypeError): rating = 0
    if meal not in [m["id"] for m in MEALS]: return error(400, "Choose a meal")
    if rating < 1 or rating > 5: return error(400, "Rating must be 1 to 5")
    today = now_parts()["date"]
    cur = connect().execute("INSERT INTO feedback(user_id,date,meal,rating,text) VALUES(?,?,?,?,?)", (g.user["id"], today, meal, rating, text))
    return jsonify(id=cur.lastrowid, sid=g.user["id"], date=today, meal=meal, rating=rating, text=text, resolved=False, author=g.user["name"], hostel=g.user["hostel"]), 201

@app.patch("/api/feedback/<int:fid>")
@auth("admin")
def resolve_feedback(fid):
    cur = connect().execute("UPDATE feedback SET resolved=? WHERE id=?", (int(bool(body().get("resolved"))), fid))
    return ("", 204) if cur.rowcount else error(404, "Feedback not found")

@app.put("/api/menu")
@auth("admin")
def update_menu():
    d = body()
    try: day, meal = int(d.get("day")), int(d.get("meal"))
    except (TypeError, ValueError): return error(400, "Invalid day or meal")
    items = clean(d.get("items"), 300)
    if day < 0 or day > 6 or meal < 0 or meal >= len(MEALS): return error(400, "Invalid day or meal")
    if not items: return error(400, "Add at least one dish")
    connect().execute("INSERT INTO menu(day,meal,items) VALUES(?,?,?) ON CONFLICT(day,meal) DO UPDATE SET items=excluded.items", (day, meal, items))
    return jsonify(day=day, meal=meal, items=items)

@app.post("/api/students")
@auth("admin")
def add_student():
    d = body(); name, roll, hostel, pw = clean(d.get("name"), 80), clean(d.get("roll"), 40).upper(), clean(d.get("hostel"), 40), str(d.get("password") or "")
    if not name or not roll: return error(400, "Name and roll number are required")
    if not re.fullmatch(r"[A-Z0-9_-]+", roll): return error(400, "Roll number can use letters, digits, - and _ only")
    if len(pw) < 8: return error(400, "Temporary password must be at least 8 characters")
    db = connect()
    if db.execute("SELECT 1 FROM users WHERE roll=?", (roll,)).fetchone(): return error(409, "That roll number is already registered")
    cur = db.execute("INSERT INTO users(name,roll,hostel,role,pw) VALUES(?,?,?,'student',?)", (name, roll, hostel, bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()))
    return jsonify(id=cur.lastrowid, name=name, roll=roll, hostel=hostel), 201

@app.delete("/api/students/<int:sid>")
@auth("admin")
def delete_student(sid):
    cur = connect().execute("DELETE FROM users WHERE id=? AND role='student'", (sid,))
    return ("", 204) if cur.rowcount else error(404, "Student not found")

def csv_cell(value):
    value = str(value)
    return "'" + value if value.startswith(("=", "+", "-", "@")) else value

@app.get("/api/report.csv")
@auth("admin")
def report():
    month = request.args.get("month", "")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month): month = now_parts()["date"][:7]
    y, mo = map(int, month.split("-")); days = (date(y + (mo == 12), mo % 12 + 1, 1) - timedelta(days=1)).day
    db = connect(); students = db.execute("SELECT id,name,roll,hostel FROM users WHERE role='student' ORDER BY roll")
    skipped = {r["k"] for r in db.execute("SELECT user_id||'|'||date||'|'||meal AS k FROM skips WHERE date LIKE ?", (month + "-%",))}
    output = io.StringIO(newline=""); writer = csv.writer(output)
    writer.writerow(["Roll no", "Name", "Hostel", *[m["name"] + " eaten" for m in MEALS], "Meals skipped", "Total (INR)"])
    t = now_parts()
    for u in students:
        eaten = [0] * len(MEALS); skips = total = 0
        for daynum in range(1, days + 1):
            ds = f"{month}-{daynum:02d}"
            for i, m in enumerate(MEALS):
                if not (ds < t["date"] or (ds == t["date"] and t["hour"] >= m["end"])): continue
                if f"{u['id']}|{ds}|{m['id']}" in skipped: skips += 1
                else: eaten[i] += 1; total += m["price"]
        writer.writerow([csv_cell(u["roll"]), csv_cell(u["name"]), csv_cell(u["hostel"]), *eaten, skips, total])
    response = make_response(output.getvalue()); response.headers["Content-Type"] = "text/csv; charset=utf-8"; response.headers["Content-Disposition"] = f'attachment; filename="mess-billing-{month}.csv"'
    return response

@app.get("/")
def index():
    return send_from_directory(FRONTEND, "index.html")

@app.get("/<path:filename>")
def static_files(filename):
    if filename.startswith("api/"):
        return error(404, "Not found")
    return send_from_directory(FRONTEND, filename)

if __name__ == "__main__":
    init_db()
    if not SECRET:
        db = sqlite3.connect(DB_FILE)
        row = db.execute("SELECT v FROM settings WHERE k='jwt_secret'").fetchone()
        if row: SECRET = row[0]
        else:
            SECRET = secrets.token_hex(48)
            db.execute("INSERT INTO settings(k,v) VALUES('jwt_secret',?)", (SECRET,)); db.commit()
        db.close()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")), debug=False)
