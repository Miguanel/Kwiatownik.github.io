from flask import Blueprint, jsonify, request
from sqlalchemy import select, text
from . import SessionLocal
from .models import Plant, PlantName

bp = Blueprint("api", __name__)

@bp.get("/plants")
def list_plants():
    q = request.args.get("q")
    with SessionLocal() as s:
        if q:
            # LIKE na start; później FTS (GIN/tsvector) – patrz db/000_init.sql
            stmt = select(Plant).where(Plant.common_pl.ilike(f"{q}%")).limit(50)
        else:
            stmt = select(Plant).limit(50)
        rows = s.execute(stmt).scalars().all()
        return jsonify([{"id": p.id, "common": p.common_pl, "latin": p.latin_binominal} for p in rows])

@bp.get("/suggest")
def suggest():
    q = request.args.get("q", "")
    with SessionLocal() as s:
        stmt = text("""
            SELECT name FROM plant_names
            WHERE name ILIKE :p
            ORDER BY name ASC
            LIMIT 5
        """)
        rows = s.execute(stmt, {"p": f"{q}%"}).all()
        return jsonify([r[0] for r in rows])
