from sqlalchemy import text
from . import SessionLocal

def fulltext_plants(query: str, limit: int = 50):
    sql = text("""
        SELECT id, common_pl, latin_binominal,
               ts_rank_cd(search_vector, plainto_tsquery('simple', :q)) AS score
        FROM plants
        WHERE search_vector @@ plainto_tsquery('simple', :q)
        ORDER BY score DESC
        LIMIT :lim
    """)
    with SessionLocal() as s:
        return s.execute(sql, {"q": query, "lim": limit}).mappings().all()
