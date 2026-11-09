"""Copy the frontend source into Vercel's public CDN directory at build time."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "frontend"
DESTINATION = ROOT / "public"
DESTINATION.mkdir(exist_ok=True)

for filename in ("index.html", "style.css", "app.js"):
    shutil.copy2(SOURCE / filename, DESTINATION / filename)

print("Frontend assets copied to public/ for Vercel.")
