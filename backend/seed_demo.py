"""Add the optional demo student accounts and sample activity."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import DB_FILE, bcrypt, sqlite3

db = sqlite3.connect(DB_FILE)
for i in range(1, 9):
    roll = "B123076" if i == 1 else f"IIIT202400{i}"
    password = "iiit@123" if i == 1 else "Welcome@123"
    existing = db.execute("SELECT id FROM users WHERE roll=?", (roll,)).fetchone()
    if not existing and i == 1:
        existing = db.execute("SELECT id FROM users WHERE roll='IIIT2024001'").fetchone()
        if existing:
            db.execute("UPDATE users SET roll=?,pw=? WHERE id=?", (roll, bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(), existing[0]))
    if existing:
        continue
    cur = db.execute("INSERT INTO users(name,roll,hostel,role,pw) VALUES(?,?,?,'student',?)", (f"Student {i}", roll, f"Hostel {chr(65 + (i - 1) % 3)}", bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()))
    sid = cur.lastrowid
    if i % 3 == 0:
        db.execute("INSERT OR IGNORE INTO skips(user_id,date,meal) VALUES(?,?,?)", (sid, "2026-11-10", "dinner"))
    if i <= 4:
        db.execute("INSERT INTO feedback(user_id,date,meal,rating,text) VALUES(?,?,?,?,?)", (sid, "2026-11-09", "lunch", 3 + i % 3, "Sample feedback"))
db.commit(); db.close()
print("Demo account: B123076 / iiit@123")
print("Additional demo students use password: Welcome@123")
