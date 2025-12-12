from __future__ import annotations


import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]  # katalog projektu (tam gdzie folder "app")
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import argparse, json, os, re, sys, uuid, dataclasses
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

import yaml
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session, sessionmaker

# === Import modeli projektu (zgodnych z wcześniej dostarczonym app/models.py) ===
from app.models import (
    Plant, PlantName, Part, Tag, Use, Image, Source,
    PlantPart, PlantTag, PlantUse,
    Recipe, RecipeType, RecipeIngredient, RecipeLink
)

# ---------- Pomocnicze ----------

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s]+", "-", s.strip())
    return s[:80]

def norm(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = str(s).strip()
    return s or None

def deep_get(obj: Dict[str, Any], dotted: str) -> Any:
    cur = obj
    for k in dotted.split("."):
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return None
    return cur

def ensure_list(v: Any) -> List[Any]:
    if v is None: return []
    if isinstance(v, (list, tuple)): return list(v)
    return [v]

def add_zrodlo(arr: Optional[List[Dict[str, Any]]], z: Dict[str, Any]) -> List[Dict[str, Any]]:
    arr = arr or []
    key = (z.get("typ"), z.get("tytul"), z.get("url"), z.get("rok"))
    seen = {(i.get("typ"), i.get("tytul"), i.get("url"), i.get("rok")) for i in arr}
    if key not in seen:
        arr.append(z)
    return arr

_QTY_RE = re.compile(
    r"(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>g|kg|ml|l|łyżeczka|łyżka|szklanka|garść|krople|kropla|szt|kwiat|liść|gałązka|pęczek|torebka|kapsułka|kropli)\b",
    flags=re.IGNORECASE
)
def parse_qty(s: Optional[str]) -> Tuple[Optional[float], Optional[str]]:
    if not s: return None, None
    m = _QTY_RE.search(s)
    if not m: return None, None
    val = m.group("value").replace(",", ".")
    try: v = float(val)
    except ValueError: v = None
    return v, m.group("unit").lower()

# ---------- Konfiguracja ----------

@dataclass
class Config:
    plant_map: Dict[str, List[str]] = field(default_factory=dict)
    recipe_types: Dict[str, str] = field(default_factory=dict)
    default_source: Dict[str, Any] = field(default_factory=dict)
    parts_map: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def load(cls, path: Union[str, Path]) -> "Config":
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        return cls(
            plant_map=data.get("plant", {}),
            recipe_types=data.get("recipe_types", {}),
            default_source=data.get("default_source", {}),
            parts_map=data.get("parts_map", {}),
        )

# ---------- Normalizacja 1 rekordu rośliny ----------

@dataclass
class PlantIn:
    common_pl: Optional[str] = None
    latin_binominal: Optional[str] = None
    family_latin: Optional[str] = None
    description_md: Optional[str] = None
    cultivation_md: Optional[str] = None
    harvest_md: Optional[str] = None
    hazards_md: Optional[str] = None
    meta_json: Optional[Dict[str, Any]] = None
    names: List[str] = field(default_factory=list)
    parts: List[str] = field(default_factory=list)
    uses: List[Union[str, Dict[str, Any]]] = field(default_factory=list)
    images: List[Dict[str, Any]] = field(default_factory=list)
    recipes: List[Dict[str, Any]] = field(default_factory=list)
    sources: List[Dict[str, Any]] = field(default_factory=list)
    zrodla: List[Dict[str, Any]] = field(default_factory=list)

def extract_first(d: Dict[str, Any], keys: List[str]) -> Optional[Any]:
    for k in keys:
        v = deep_get(d, k) if "." in k else d.get(k)
        if v not in (None, "", []): return v
    return None

def normalize_plant(raw: Dict[str, Any], cfg: Config, file_source: Dict[str, Any]) -> PlantIn:
    m = cfg.plant_map
    p = PlantIn(
        common_pl = norm(extract_first(raw, m.get("common_pl", [])) or raw.get("nazwa")),
        latin_binominal = norm(extract_first(raw, m.get("latin_binominal", []))),
        family_latin = norm(extract_first(raw, m.get("family_latin", []))),
        description_md = norm(extract_first(raw, m.get("description_md", []))),
        cultivation_md = norm(extract_first(raw, m.get("cultivation_md", []))),
        harvest_md = norm(extract_first(raw, m.get("harvest_md", []))),
        hazards_md = norm(extract_first(raw, m.get("hazards_md", []))),
        meta_json = extract_first(raw, m.get("meta_json", [])) or {},
        names = [str(n).strip() for n in ensure_list(extract_first(raw, m.get("names", []))) if str(n).strip()],
        parts = [str(n).strip() for n in ensure_list(extract_first(raw, m.get("parts", []))) if str(n).strip()],
        uses = ensure_list(extract_first(raw, m.get("uses", []))),
        images = [dict(x) for x in ensure_list(extract_first(raw, m.get("images", [])))],
        recipes = [dict(x) for x in ensure_list(extract_first(raw, m.get("recipes", [])))],
        sources = [dict(x) for x in ensure_list(extract_first(raw, m.get("sources", [])))],
        zrodla = []
    )
    for z in ensure_list(raw.get("zrodla")) + p.sources:
        if isinstance(z, dict):
            p.zrodla = add_zrodlo(p.zrodla, z)
    p.zrodla = add_zrodlo(p.zrodla, file_source)
    return p

# ---------- Operacje na DB ----------

def get_or_create_part(session: Session, name_pl: str, parts_map: Dict[str, str], zdef: Dict[str, Any]) -> Part:
    key = parts_map.get(slugify(name_pl), parts_map.get(name_pl, name_pl)).strip()
    obj = session.execute(select(Part).where(Part.name_pl.ilike(key))).scalar_one_or_none()
    if obj: return obj
    obj = Part(name_pl=key, zrodla=[zdef]); session.add(obj); session.flush(); return obj

def get_or_create_use(session: Session, val: Union[str, Dict[str, Any]], zdef: Dict[str, Any]) -> Use:
    if isinstance(val, dict):
        name = val.get("name") or val.get("nazwa") or val.get("slug") or json.dumps(val, ensure_ascii=False)[:80]
        kind = val.get("kind") or val.get("rodzaj") or "medyczne"
    else:
        name, kind = str(val), "medyczne"
    slug = slugify(name)
    obj = session.execute(select(Use).where(Use.slug == slug)).scalar_one_or_none()
    if obj: return obj
    obj = Use(slug=slug, name_pl=name, kind=kind, zrodla=[zdef]); session.add(obj); session.flush(); return obj

def get_or_create_recipe_type(session: Session, raw_type: Optional[str], cfg: Config, zdef: Dict[str, Any]) -> RecipeType:
    if not raw_type: raw_type = "inne"
    slug = slugify(raw_type); display = cfg.recipe_types.get(slug, raw_type.capitalize())
    obj = session.execute(select(RecipeType).where(RecipeType.slug == slug)).scalar_one_or_none()
    if obj: return obj
    obj = RecipeType(slug=slug, name_pl=display, zrodla=[zdef]); session.add(obj); session.flush(); return obj

def upsert_plant(session: Session, p: PlantIn) -> Plant:
    existing = None
    if p.latin_binominal:
        existing = session.execute(select(Plant).where(Plant.latin_binominal == p.latin_binominal)).scalar_one_or_none()
    if not existing and p.common_pl:
        existing = session.execute(select(Plant).where(Plant.common_pl.ilike(p.common_pl))).scalar_one_or_none()

    if existing:
        changed = False
        for f in ("common_pl","latin_binominal","family_latin","description_md","cultivation_md","harvest_md","hazards_md"):
            nv = getattr(p, f)
            if nv and getattr(existing, f) != nv:
                setattr(existing, f, nv); changed = True
        if p.meta_json:
            existing.meta_json = {**(existing.meta_json or {}), **p.meta_json}; changed = True
        for z in p.zrodla:
            existing.zrodla = add_zrodlo(existing.zrodla, z); changed = True
        if changed: session.flush()
        return existing

    obj = Plant(
        common_pl=p.common_pl or "N/D",
        latin_binominal=p.latin_binominal or f"nd-{uuid.uuid4()}",
        family_latin=p.family_latin,
        description_md=p.description_md,
        cultivation_md=p.cultivation_md,
        harvest_md=p.harvest_md,
        hazards_md=p.hazards_md,
        meta_json=p.meta_json or {},
        zrodla=p.zrodla or [],
    )
    session.add(obj); session.flush(); return obj

def attach_names(session: Session, plant: Plant, names: List[str], zdef: Dict[str, Any]) -> int:
    added, existing = 0, {n.name.lower().strip() for n in plant.names}
    for nm in names:
        nm2 = nm.strip()
        if not nm2 or nm2.lower() in existing: continue
        session.add(PlantName(plant_id=plant.id, lang="pl", name=nm2, zrodla=[zdef])); added += 1
    if added: session.flush()
    return added

def attach_parts(session: Session, plant: Plant, parts: List[str], cfg: Config, zdef: Dict[str, Any]) -> int:
    added, existing_ids = 0, {pp.part_id for pp in plant.parts_rel}
    for p in parts:
        part = get_or_create_part(session, p, cfg.parts_map, zdef)
        if part.id in existing_ids: continue
        session.add(PlantPart(plant_id=plant.id, part_id=part.id, notes_md=None, zrodla=[zdef])); added += 1
    if added: session.flush()
    return added

def attach_uses(session: Session, plant: Plant, uses: List[Union[str, Dict[str, Any]]], zdef: Dict[str, Any]) -> int:
    added, existing_ids = 0, {pu.use_id for pu in plant.uses_rel}
    for u in uses:
        use = get_or_create_use(session, u, zdef)
        if use.id in existing_ids: continue
        session.add(PlantUse(plant_id=plant.id, use_id=use.id, strength=None, notes_md=None, zrodla=[zdef])); added += 1
    if added: session.flush()
    return added

def attach_images(session: Session, plant: Plant, images: List[Dict[str, Any]], zdef: Dict[str, Any]) -> int:
    added, existing_urls = 0, {img.url for img in plant.images}
    for im in images:
        url = norm(im.get("url") or im.get("link"))
        if not url or url in existing_urls: continue
        title = norm(im.get("tytul") or im.get("title"))
        lic = norm(im.get("licencja") or im.get("license"))
        src = norm(im.get("zrodlo") or im.get("source"))
        z = add_zrodlo(ensure_list(im.get("zrodla")), zdef)
        session.add(Image(plant_id=plant.id, title=title, url=url, license=lic, source=src, zrodla=z)); added += 1
    if added: session.flush()
    return added

def attach_sources(session: Session, plant: Plant, sources: List[Dict[str, Any]], zdef: Dict[str, Any]) -> int:
    added = 0
    for s in sources:
        citation = s.get("citation") or s.get("cytat") or s.get("opis") or json.dumps(s, ensure_ascii=False)[:240]
        url = s.get("url"); notes = s.get("uwagi") or s.get("notes")
        z = add_zrodlo(ensure_list(s.get("zrodla")), zdef)
        session.add(Source(plant_id=plant.id, citation=citation, url=url, notes_md=notes, zrodla=z)); added += 1
    if added: session.flush()
    return added

def upsert_recipe_tree(session: Session, plant: Plant, raw: Dict[str, Any], cfg: Config, zdef: Dict[str, Any]) -> Tuple[Recipe, bool]:
    title = norm(raw.get("tytul") or raw.get("title") or "Przepis bez tytułu")
    rtype = get_or_create_recipe_type(session, norm(raw.get("typ") or raw.get("type")), cfg, zdef)
    slug = slugify(f"{plant.latin_binominal}-{title}")
    recipe = session.execute(select(Recipe).where(Recipe.slug == slug)).scalar_one_or_none()
    created = False
    if not recipe:
        steps_block = raw.get("steps_md")
        if not steps_block:
            steps_list = ensure_list(raw.get("kroki") or raw.get("steps") or [])
            steps_block = "\n".join(steps_list)
        recipe = Recipe(
            slug=slug, title_pl=title, recipe_type_id=rtype.id,
            intro_md=norm(raw.get("wstep") or raw.get("intro")),
            steps_md=steps_block or "",
            yield_text=norm(raw.get("wydajnosc") or raw.get("yield")),
            prep_time_min=raw.get("czas_przygotowania") or raw.get("prep_time_min"),
            macer_time_h=raw.get("czas_maceracji") or raw.get("macer_time_h"),
            tips_md=norm(raw.get("wskazowki") or raw.get("tips_md")),
            zrodla=add_zrodlo(ensure_list(raw.get("zrodla")), zdef),
        )
        session.add(recipe); session.flush(); created = True

    # link przepis—roślina (+opcjonalnie zastosowanie)
    use_in_recipe = raw.get("use") or raw.get("zastosowanie")
    use_obj = get_or_create_use(session, use_in_recipe, zdef) if use_in_recipe else None
    key = {"recipe_id": recipe.id, "plant_id": plant.id, "use_id": (use_obj.id if use_obj else None)}
    link = session.get(RecipeLink, key)
    if not link:
        session.add(RecipeLink(**key, zrodla=[zdef]))

    # składniki
    existing = {(ri.ingredient_txt or "", ri.plant_id or 0, ri.part_id or 0) for ri in recipe.ingredients}
    pos = len(recipe.ingredients)
    for ing in ensure_list(raw.get("skladniki") or raw.get("ingredients")):
        if not isinstance(ing, dict): ing = {"ingredient": str(ing)}
        plant_name = norm(ing.get("roslina") or ing.get("plant"))
        part_name = norm(ing.get("czesc") or ing.get("part"))
        qty_text = norm(ing.get("ilosc") or ing.get("qty"))
        qty_value, qty_unit = parse_qty(qty_text)
        notes = norm(ing.get("uwagi") or ing.get("notes"))
        plant_id = part_id = None
        if plant_name:
            p = session.execute(select(Plant).where(Plant.common_pl.ilike(plant_name))).scalar_one_or_none()
            if not p:
                p = session.execute(select(Plant).where(Plant.latin_binominal.ilike(plant_name))).scalar_one_or_none()
            if p: plant_id = p.id
        if part_name:
            prt = session.execute(select(Part).where(Part.name_pl.ilike(part_name))).scalar_one_or_none()
            if prt: part_id = prt.id
        ing_txt = norm(ing.get("ingredient") or ing.get("nazwa"))
        key2 = (ing_txt or "", plant_id or 0, part_id or 0)
        if key2 in existing: continue
        recipe.ingredients.append(RecipeIngredient(
            ingredient_txt=ing_txt, plant_id=plant_id, part_id=part_id,
            qty_value=qty_value, qty_unit=qty_unit, notes=notes,
            position_ord=pos, zrodla=add_zrodlo(ensure_list(ing.get("zrodla")), zdef)
        ))
        pos += 1
    session.flush()
    return recipe, created

# ---------- Raport ----------

@dataclass
class Report:
    files_total: int = 0
    plants_upserted: int = 0
    names_added: int = 0
    parts_added: int = 0
    uses_added: int = 0
    images_added: int = 0
    sources_added: int = 0
    recipes_created: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)
    def to_dict(self) -> Dict[str, Any]: return dataclasses.asdict(self)

# ---------- Główna ścieżka ----------

def migrate_path(session: Session, path: Path, cfg: Config, dry_run: bool, report: Report):
    if path.is_dir():
        files = sorted([p for p in path.glob("*.json")])
        dataset = [(p, json.loads(p.read_text(encoding="utf-8"))) for p in files]
    else:
        data = json.loads(path.read_text(encoding="utf-8"))
        dataset = [(path, data if isinstance(data, list) else [data])]

    for fpath, rows in dataset:
        report.files_total += 1
        file_src = dict(cfg.default_source)
        file_src["uwagi"] = f"Źródło: {fpath.name}"
        try:
            rows_iter = rows if isinstance(rows, list) else [rows]
            for raw in rows_iter:
                p = normalize_plant(raw, cfg, file_src)
                if not p.common_pl and not p.latin_binominal:
                    raise ValueError("Brak nazwy rośliny (common_pl / latin_binominal)")
                plant = upsert_plant(session, p)
                report.plants_upserted += 1
                report.names_added  += attach_names(session, plant, p.names, cfg.default_source)
                report.parts_added  += attach_parts(session, plant, p.parts, cfg, cfg.default_source)
                report.uses_added   += attach_uses(session, plant, p.uses, cfg.default_source)
                report.images_added += attach_images(session, plant, p.images, cfg.default_source)
                report.sources_added+= attach_sources(session, plant, p.sources, cfg.default_source)
                for r in p.recipes:
                    _, created = upsert_recipe_tree(session, plant, r, cfg, cfg.default_source)
                    if created: report.recipes_created += 1
            if dry_run: session.rollback()
            else: session.commit()
        except Exception as e:
            session.rollback()
            report.errors.append({"file": str(fpath), "error": str(e)})

def main():
    ap = argparse.ArgumentParser(description="Migracja starych JSON-ów do bazy Kwiatownika (PostgreSQL)")
    ap.add_argument("input", help="Plik JSON lub katalog z *.json")
    ap.add_argument("--config", default="tools/migrate_config.yml", help="Plik YAML z mapowaniem pól")
    ap.add_argument("--database-url", default=os.environ.get("DATABASE_URL"), help="SQLAlchemy DATABASE_URL")
    ap.add_argument("--commit", action="store_true", help="Zapisz zmiany (domyślnie: dry-run)")
    ap.add_argument("--report", default="migration_report.json", help="Plik wyjściowy raportu JSON")
    args = ap.parse_args()

    if not args.database_url:
        print("Brak DATABASE_URL (ustaw zmienną lub podaj --database-url).", file=sys.stderr)
        sys.exit(2)

    cfg = Config.load(args.config)
    engine = create_engine(args.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    report = Report()
    with SessionLocal() as s:
        migrate_path(s, Path(args.input), cfg, dry_run=(not args.commit), report=report)

    Path(args.report).write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
