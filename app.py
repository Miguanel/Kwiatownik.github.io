from markupsafe import Markup
from pathlib import Path
from flask import Flask, render_template, send_from_directory, jsonify, request, make_response, abort, jsonify, request
import os, json, requests, math, datetime, ephem, re

app = Flask(__name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CATEGORIES = ["drzewa", "krzewy", "ziola", "bulwy", "cebule", "egzotyczne"]
BASE_DIR = Path(__file__).resolve().parent
PLANTS_DIR = BASE_DIR  # katalog, w którym masz wszystkie pliki *.json


def _safe_list(v):
    if isinstance(v, list): return [str(x) for x in v]
    if isinstance(v, str):  return [v] if v.strip() else []
    return []


def _first_path_entry(raw):
    sciezka = raw.get("nazwa_zbioru") or raw.get("ścieżka") or raw.get("sciezka") or raw.get("path") or []
    if isinstance(sciezka, str):
        parts = [s.strip() for s in re.split(r">|→", sciezka) if s.strip()]
    elif isinstance(sciezka, list):
        parts = [str(s) for s in sciezka]
    else:
        parts = []
    return parts, (parts[0] if parts else "Inne")


def load_all_plants_from_disk_OLD():
    """Czyta wszystkie JSON-y z PLANTS_DIR i zwraca listę wpisów zgodnych z extract_all_recipes()."""
    out = []
    for path in sorted(Path(PLANTS_DIR).rglob("*.json")):  # :contentReference[oaicite:1]{index=1}
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            out.append({"slug": path.stem, "name": path.stem.replace("_", " "), "category": path.parent.name,
                        "data": {"_blad": str(e)}})
            continue

        slug = path.stem
        parent = path.parent.name.lower()
        category = parent  # trzymaj jak w Twojej logice
        name = (
                raw.get("gatunek")
                or raw.get("nazwa")
                or raw.get("nazwa_pospolita")
                or slug.replace("_", " ")
        )
        latin = (
                raw.get("nazwa_lacinska")
                or raw.get("nazwa_łacińska")
                or (raw.get("taksonomia") or {}).get("lacinska")
                or (raw.get("taksonomia") or {}).get("łacińska")
                or ""
        )
        path_list, top = _first_path_entry(raw)

        out.append({
            "slug": slug,
            "name": name,
            "latin": latin,
            "path": path_list,
            "top": top,
            "category": category,
            "data": {
                # ujednolicamy nazwy sekcji, żeby extract_all_recipes miał co czytać
                "przepisy_medyczne": (raw.get("Przepisy") or {}).get("przepisy_medyczne") or {},
                "przepisy_kulinarne": (raw.get("Przepisy") or {}).get("przepisy_kulinarne") or {},
                "przepisy_z_innymi_roslinami": (raw.get("Przepisy") or {}).get("przepisy_z_innymi_roslinami") or {},
            },
            "_raw": raw  # opcjonalnie – może się przydać do renderów papirusu
        })
    return out


def load_all_plants_from_disk():
    all_plants = []
    for path in sorted(Path(PLANTS_DIR).rglob("*.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                plant = json.load(f)
                all_plants.append(plant)
        except Exception as e:
            print(f"Błąd przy wczytywaniu {path}: {e}")
    return all_plants


# Załaduj raz przy starcie
ALL_PLANTS = load_all_plants_from_disk()


def all_plants():
    """Źródło prawdy dla extract_all_recipes() i API – używa preładowanego cache."""
    for p in ALL_PLANTS:
        yield p


##########################################
def _slugify_name(name: str) -> str:
    """PL -> ASCII, spacje -> _, tylko [a-z0-9_]"""
    if not name:
        return ""
    mapping = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
    s = name.translate(mapping)
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s_]+", "", s)
    s = re.sub(r"\s+", "_", s).strip("_")
    return s


# ROOT danych statycznych
ROOT_DATA = Path(app.static_folder) / "data"
PLANTS_DIR = ROOT_DATA / "rosliny"  # ← tu są JSON-y roślin, w podfolderach (np. ziola/, drzewa/…)
RECIPES_DIR = ROOT_DATA / "przepisy"  # ← tu są globalne przepisy (jeśli kiedyś będziesz je podawać z backendu)


def build_plant_manifest():
    items = []
    for path in sorted((PLANTS_DIR).rglob("*.json")):  # ** zamiast "*/*.json"
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue

        slug = path.stem
        parent = path.parent.name.lower()
        category = parent if parent in ALLOWED_PLANT_CATS else "ziola"  # sensowny default

        name = (
                raw.get("gatunek")
                or raw.get("nazwa")
                or raw.get("nazwa_pospolita")
                or slug.replace("_", " ")
        )
        latin = (
                raw.get("nazwa_lacinska")
                or raw.get("nazwa_łacińska")
                or (raw.get("taksonomia") or {}).get("lacinska")
                or (raw.get("taksonomia") or {}).get("łacińska")
                or ""
        )

        # ścieżka/„top” do grupowania w drzewku:
        sciezka = raw.get("nazwa_zbioru") or raw.get("ścieżka") or raw.get("sciezka") or raw.get("path") or []
        if isinstance(sciezka, str):
            path_list = [s.strip() for s in re.split(r">|→", sciezka) if s.strip()]
        elif isinstance(sciezka, list):
            path_list = [str(s) for s in sciezka]
        else:
            path_list = []
        top = path_list[0] if path_list else "Inne"

        items.append({
            "slug": slug,
            "name": name,
            "latin": latin,
            "path": path_list,
            "top": top,
            "category": category,
        })
    return items


# -----------------------------------------------
# Normalizacja list
# -----------------------------------------------
def _as_list(v):
    """Zwraca listę stringów; obsługuje: None/str/list/inna-typ"""
    if isinstance(v, list):
        return [str(x).strip() for x in v if x is not None and str(x).strip() != ""]
    if isinstance(v, str):
        s = v.strip()
        return [s] if s else []
    return []


# -----------------------------------------------
# NORMALIZACJA POJEDYNCZEGO PRZEPISU
# -----------------------------------------------
def normalize_recipe(pr):
    """
    Normalizuje pojedynczy przepis do spójnego słownika.
    - wspiera formaty: dict / str / inne
    - utrzymuje typy (listy/str), usuwa None
    - wylicza smak/cele heurystycznie (z poszanowaniem inputu)
    - zrodla/zrodlo -> lista stringów
    """
    if isinstance(pr, dict):
        raw = dict(pr)
    elif isinstance(pr, str):
        raw = {"nazwa": pr.strip()}
    else:
        raw = {"nazwa": (str(pr).strip() if pr is not None else "Bez nazwy")}

    rec = {
        "nazwa": raw.get("nazwa", "Bez nazwy") or "Bez nazwy",
        "skladniki": _as_list(raw.get("skladniki")),
        "sposob_przygotowania": raw.get("sposob_przygotowania", "") or "",
        "zastosowanie": raw.get("zastosowanie", "") or "",
        "cechy": _as_list(raw.get("cechy")),
        "wlasciwosci": _as_list(raw.get("wlasciwosci")),
        "smak": _as_list(raw.get("smak")),
        "pora": raw.get("pora", "") or "",
        "ksiezyc": raw.get("ksiezyc", "") or "",
    }

    # heurystyki
    try:
        inferred_taste = infer_taste(raw) or []
    except Exception:
        inferred_taste = []
    try:
        inferred_cele = infer_cele(raw) or []
    except Exception:
        inferred_cele = []

    rec["smak"] = sorted(set(rec["smak"] + inferred_taste))
    rec["cele"] = inferred_cele

    z = raw.get("zrodla") or raw.get("zrodlo")
    rec["zrodla"] = _as_list(z)

    return rec


# -----------------------------------------------
# EKSTRAKCJA WSZYSTKICH PRZEPISÓW
# -----------------------------------------------
def extract_all_recipes():
    """
    Zwraca listę ujednoliconych przepisów ze wszystkich roślin:
    - typ: medyczny/kulinarny/mieszanki (dla mieszanek: rodzaj='mieszanka', typ='medyczne'|'kulinarne')
    - każdy rekord niesie metadane rośliny i pole 'category' (kategoria roślin: drzewa/ziola/bulwy/korzenie/...)
    """
    results = []
    for plant in all_plants():
        base = {
            "roslina": plant.get("name", ""),
            "slug": plant.get("slug", "") or _slugify_name(plant.get("name", "")),
            "category": plant.get("category", "").lower(),
        }
        data = plant.get("data", {}) or {}

        # medyczne
        for rodzaj, items in (data.get("przepisy_medyczne") or {}).items():
            for pr in (items or []):
                norm = normalize_recipe(pr)
                results.append({**base, **norm, "typ": "medyczny", "rodzaj": rodzaj})

        # kulinarne
        for rodzaj, items in (data.get("przepisy_kulinarne") or {}).items():
            for pr in (items or []):
                norm = normalize_recipe(pr)
                results.append({**base, **norm, "typ": "kulinarny", "rodzaj": rodzaj})

        # mieszanki
        mixes = data.get("przepisy_z_innymi_roslinami") or {}
        for mix_typ in ("medyczne", "kulinarne"):
            for pr in (mixes.get(mix_typ) or []):
                norm = normalize_recipe(pr)
                results.append({**base, **norm, "typ": mix_typ, "rodzaj": "mieszanka"})

    # usuń placeholdery "nazwa"
    results = [r for r in results if (r.get("nazwa") or "").strip().lower() != "nazwa"]
    return results


# -----------------------------------------------
# SŁOWNIK DO AUTOSUGESTII
# -----------------------------------------------
_vocabulary_cache = None


def build_vocabulary():
    """
    Buduje słownik słów do autosugestii:
    - nazwy roślin, slugi
    - rodzaj (np. napar, syrop)
    - typ (medyczny/kulinarny/mieszanki) — mniej ważne do sugestii, ale ok
    - zastosowanie (tokenizacja)
    - cechy, właściwości, smak, składniki (tokeny)
    """
    global _vocabulary_cache
    if _vocabulary_cache is not None:
        return _vocabulary_cache

    vocab = set()
    for r in extract_all_recipes():
        # roślina/slug
        if r.get("roslina"): vocab.add(r["roslina"])
        if r.get("slug"): vocab.add(r["slug"])

        # rodzaj/typ
        if r.get("rodzaj"): vocab.add(str(r["rodzaj"]).replace("_", " "))
        if r.get("typ"): vocab.add(r["typ"])

        # proste listy
        for key in ("cechy", "wlasciwosci", "smak", "skladniki", "cele"):
            for w in (r.get(key) or []):
                if w: vocab.add(str(w))

        # zastosowanie — tokenizuj po spacjach/przecinkach
        z = r.get("zastosowanie") or ""
        for token in re.split(r"[,\.;:\s/]+", z):
            token = token.strip()
            if len(token) >= 3:
                vocab.add(token)

    # posortowana lista
    _vocabulary_cache = sorted(vocab, key=lambda s: s.lower())
    return _vocabulary_cache


# -----------------------------------------------
# API: AUTOSUGESTIA
# -----------------------------------------------
@app.route("/api/suggest_words", methods=["GET"])
def api_suggest_words():
    q = (request.args.get("q") or "").strip().lower()
    if not q or len(q) < 2:
        return jsonify([])
    vocab = build_vocabulary()
    # dopasowanie zawiera (case-insensitive), limit 5
    out = []
    for w in vocab:
        if q in w.lower():
            out.append(w)
            if len(out) >= 5:
                break
    return jsonify(out)


# -----------------------------------------------
# API: KATALOG KAPSUŁEK (dla panelu filtrów)
# -----------------------------------------------
@app.route("/api/filters_catalog", methods=["GET"])
def api_filters_catalog():
    """
    Zwraca katalog filtrowalnych kapsułek:
    - kategorie_roślin: drzewa, zioła, bulwy, korzenie
    - cele: unikalne
    - typy_kulinarne: z 'przepisy_kulinarne' (zebrane rodzaje)
    - typy_medyczne: z 'przepisy_medyczne'
    - typy_mieszanki_palenia: (jeśli występują — z rodzajów związanych z paleniem)
    - typy_eliksiry: przykładowe zbiory (opcjonalne; jeśli brak w danych, zwracamy predefiniowane)
    """
    # z danych
    recipes = extract_all_recipes()

    cele = sorted(set(c for r in recipes for c in (r.get("cele") or [])), key=lambda s: s.lower())

    # detekcja typów po 'typ' i 'rodzaj'
    kulinarne = sorted(set(r["rodzaj"] for r in recipes if r.get("typ") == "kulinarny" and r.get("rodzaj")),
                       key=lambda s: s.lower())
    medyczne = sorted(set(r["rodzaj"] for r in recipes if r.get("typ") == "medyczny" and r.get("rodzaj")),
                      key=lambda s: s.lower())
    # mieszanki do palenia: heurystyka po słowach kluczowych
    palenia = sorted(set(
        r["rodzaj"] for r in recipes
        if r.get("rodzaj") and any(
            k in r["rodzaj"].lower() for k in ("palen", "dym", "fajk", "tytoń", "tyton", "zamiennik"))
    ), key=lambda s: s.lower())

    # eliksiry: jeśli w danych brak — podaj przykładowe taksony
    eliksiry = sorted(set(
        r["rodzaj"] for r in recipes
        if r.get("rodzaj") and "eliksir" in r["rodzaj"].lower()
    ), key=lambda s: s.lower())
    if not eliksiry:
        eliksiry = ["eliksir_miłości", "eliksir_odporności", "eliksir_spokoju"]

    return jsonify({
        "kategorie_roslin": ["drzewa", "zioła", "bulwy", "korzenie"],
        "cele": cele,
        "typy_kulinarne": kulinarne,
        "typy_medyczne": medyczne,
        "typy_mieszanki_palenia": palenia,
        "typy_eliksiry": eliksiry
    })


# -----------------------------------------------
# API: LISTA ROŚLIN (DRZEWA / ZIOŁA / BULWY / KORZENIE)
# -----------------------------------------------
@app.route("/api/plants_list", methods=["GET"])
def api_plants_list():
    drzewa, ziola, bulwy, korzenie = [], [], [], []

    try:
        plants = list(all_plants())
    except Exception:
        plants = []

    for p in plants:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        slug = (p.get("slug") or "").strip() or _slugify_name(name)
        cat = (p.get("category") or "").strip().lower()

        item = {"name": name, "slug": slug}

        if "drzew" in cat:
            drzewa.append(item)
        elif "bulw" in cat:
            bulwy.append(item)
        elif "korzen" in cat or "korzeń" in cat:
            korzenie.append(item)
        else:
            ziola.append(item)

    # sort
    keyf = lambda x: x["name"].lower()
    for lst in (drzewa, ziola, bulwy, korzenie):
        lst.sort(key=keyf)

    return jsonify({
        "drzewa": drzewa,
        "ziola": ziola,
        "bulwy": bulwy,
        "korzenie": korzenie
    })


# -----------------------------------------------
# API: GŁÓWNY GENERATOR — FILTROWANIE WYNIKÓW
# -----------------------------------------------
@app.route("/api/generator_przepisow", methods=["POST"])
def api_generator_przepisow():
    """
    Wejście (JSON):
    {
      "q": "tekst z inputu (chipsy łączone spacją — ale to tylko podgląd)",
      "chips": ["chip1","chip2",...],                # aktywne tagi z inputu/autosugestii
      "cele": ["na kaszel", "na odporność", ...],    # OR w grupie
      "typy_kulinarne": ["dania","napoje",...],      # OR w grupie (dopasowywane do 'rodzaj')
      "typy_medyczne": ["nalewka","syrop","napar"],  # OR w grupie
      "typy_mieszanki_palenia": [...],               # OR w grupie
      "typy_eliksiry": [...],                        # OR w grupie
      "kategorie_roslin": ["drzewa","zioła",...],    # OR w grupie (dopasowane do r["category"])
      "rosliny": ["slug1","slug2",...],              # OR po slug lub nazwa
      "smaki": ["słodkie","pikantny",...],           # OR w grupie
      "pora": ["rano","noc",...],                    # OR w grupie (puste = brak filtra)
      "ksiezyc": ["pełnia","nów",...],               # OR w grupie
    }
    Zasada: AND POMIĘDZY GRUPAMI, OR W OBRĘBIE JEDNEJ GRUPY. Chips — AND (każdy chip musi wystąpić).
    """
    try:
        p = request.get_json(force=True) or {}

        # --- wejście i normalizacja ---
        def norm_list(x):
            if isinstance(x, list): return [str(v).strip() for v in x if v]
            if isinstance(x, str):  return [x.strip()] if x.strip() else []
            return []

        q = (p.get("q") or "").strip().lower()
        chips = norm_list(p.get("chips") or p.get("freechips") or [])
        cele = norm_list(p.get("cele"))
        tkul = norm_list(p.get("typy_kulinarne"))
        tmed = norm_list(p.get("typy_medyczne"))
        tpal = norm_list(p.get("typy_mieszanki_palenia"))
        telix = norm_list(p.get("typy_eliksiry"))
        kateg = norm_list(p.get("kategorie_roslin"))
        rosl = norm_list(p.get("rosliny"))
        smaki = norm_list(p.get("smaki"))
        pora = norm_list(p.get("pora"))
        ks = norm_list(p.get("ksiezyc"))

        # --- przeszukaj ---
        out = []
        for r in extract_all_recipes():
            # zbior pól tekstowych do chips/pełnotekstowego
            hay = " ".join(filter(None, [
                r.get("nazwa", ""),
                r.get("roslina", ""),
                r.get("zastosowanie", ""),
                r.get("rodzaj", ""),
                r.get("typ", ""),
                " ".join(r.get("skladniki", [])),
                " ".join(r.get("cechy", [])),
                " ".join(r.get("wlasciwosci", [])),
                " ".join(r.get("smak", [])),
                " ".join(r.get("cele", [])),
            ])).lower()

            # --- chips (AND): każdy chip musi wystąpić w hay ---
            if chips and not all(c.lower() in hay for c in chips):
                continue

            # --- q (pełnotekstowe) — traktuj jak dodatkowy chip (opcjonalne) ---
            if q and q not in hay:
                continue

            # --- cele (OR w grupie) ---
            if cele:
                rc = r.get("cele") or []
                if not any(c in rc for c in cele):
                    continue

            # --- typy kulinarne/medyczne/mieszanki/eliksiry (dopasowujemy do 'rodzaj') ---
            rodzaj = (r.get("rodzaj") or "").lower()
            if tkul:
                if not any(x.lower() in rodzaj for x in tkul):
                    continue
            if tmed:
                if not any(x.lower() in rodzaj for x in tmed):
                    continue
            if tpal:
                if not any(x.lower() in rodzaj for x in tpal):
                    continue
            if telix:
                if not any(x.lower() in rodzaj for x in telix):
                    continue

            # --- kategorie roślin (drzewa/ziola/bulwy/korzenie) ---
            if kateg:
                cat = (r.get("category") or "").lower()
                # normalizacja: "zioła"~"ziola"
                norm_kateg = [kk.replace("ł", "l") for kk in kateg]
                norm_cat = cat.replace("ł", "l")
                if not any(kk in norm_cat for kk in norm_kateg):
                    continue

            # --- konkretne rośliny (slug lub nazwa) ---
            if rosl:
                slug = (r.get("slug") or "").lower()
                name = (r.get("roslina") or "").lower()
                if not any(x.lower() == slug or x.lower() == name for x in rosl):
                    continue

            # --- smaki (OR) ---
            if smaki:
                rs = r.get("smak") or []
                if not any(s in rs for s in smaki):
                    continue

            # --- pory / fazy księżyca (OR) ---
            if pora:
                rp = r.get("pora", "")
                if not any(pp.lower() in rp.lower() for pp in pora):
                    continue
            if ks:
                rk = r.get("ksiezyc", "")
                if not any(mm.lower() in rk.lower() for mm in ks):
                    continue

            out.append(r)

        return jsonify({"status": "ok", "count": len(out), "results": out})

    except Exception as e:
        import traceback
        print("🔥 Błąd w API /api/generator_przepisow")
        traceback.print_exc()
        return jsonify({"error": "Internal error", "details": str(e)}), 500


#
# @app.route("/api/plants_list", methods=["GET"])
# def api_plants_list():
#     """
#     Zwraca listę roślin pogrupowaną na drzewa i zioła:
#     {
#       "drzewa": [{"name": "...", "slug": "..."}, ...],
#       "ziola":  [{"name": "...", "slug": "..."}, ...]
#     }
#     Zawsze zwraca przynajmniej puste listy.
#     """
#     drzewa, ziola = [], []
#
#     try:
#         plants = list(all_plants())  # wymuś materializację – bezpiecznie użyj istniejącego źródła
#     except Exception:
#         plants = []
#
#     for p in plants:
#         name = (p.get("name") or "").strip()
#         slug = (p.get("slug") or "").strip() or _slugify_name(name)
#         cat  = (p.get("category") or "").strip().lower()
#
#         # pomiń wpisy bez nazwy
#         if not name:
#             continue
#
#         item = {"name": name, "slug": slug}
#
#         # heurystyka grupowania
#         is_tree = any(k in cat for k in ("drzew", "tree", "arb", "las"))
#         if is_tree:
#             drzewa.append(item)
#         else:
#             ziola.append(item)
#
#     # sortowanie alfabetyczne
#     drzewa.sort(key=lambda x: x["name"].lower())
#     ziola.sort(key=lambda x: x["name"].lower())
#
#     return jsonify({"drzewa": drzewa, "ziola": ziola})

# @app.route("/api/generator_przepisow", methods=["POST"])
# def api_generator_przepisow():
#     """
#     Filtruje przepisy wg:
#     - q: pełnotekstowo (nazwa, zastosowanie, cechy, właściwości, składniki)
#     - cele: lista (OR)
#     - typy: lista rodzajów (np. napar, syrop) — exact match
#     - smaki: lista tagów smakowych (OR)
#     - pora:  lista wartości; 'all' ignorowane
#     - ksiezyc: lista wartości; 'all' ignorowane
#     - rosliny: lista slugów lub nazw (OR)
#     """
#     try:
#         payload = request.get_json(force=True) or {}
#         print("▶ PAYLOAD:", payload)
#
#         q = (payload.get("q") or "").strip().lower()
#         cele = payload.get("cele") or []
#         typy = payload.get("typy") or []
#         smaki = payload.get("smaki") or []
#         pora = payload.get("pora") or []
#         ksiezyc = payload.get("ksiezyc") or []
#         rosliny = payload.get("rosliny") or []
#
#         # normalizacja list (string -> lista)
#         if isinstance(cele, str): cele = [cele]
#         if isinstance(typy, str): typy = [typy]
#         if isinstance(smaki, str): smaki = [smaki]
#         if isinstance(pora, str): pora = [pora]
#         if isinstance(ksiezyc, str): ksiezyc = [ksiezyc]
#         if isinstance(rosliny, str): rosliny = [rosliny]
#
#         # ignoruj 'all'
#         pora = [x for x in pora if str(x).lower() != "all"]
#         ksiezyc = [x for x in ksiezyc if str(x).lower() != "all"]
#
#         results = []
#         for r in extract_all_recipes():
#             # rośliny (OR po slug/name)
#             if rosliny:
#                 slug = (r.get("slug") or "").lower()
#                 name = (r.get("roslina") or "").lower()
#                 if not any((s.lower() == slug) or (s.lower() == name) for s in rosliny):
#                     continue
#
#             # q: fulltext
#             if q:
#                 blob = " ".join(filter(None, [
#                     r.get("nazwa", ""),
#                     r.get("zastosowanie", ""),
#                     " ".join(r.get("wlasciwosci", [])),
#                     " ".join(r.get("cechy", [])),
#                     " ".join(r.get("skladniki", [])),
#                 ])).lower()
#                 if q not in blob:
#                     continue
#
#             # cele (OR)
#             if cele:
#                 rc = r.get("cele") or []
#                 if not any(c in rc for c in cele):
#                     continue
#
#             # typy (dokładny rodzaj)
#             if typy:
#                 if r.get("rodzaj") not in typy:
#                     continue
#
#             # smak (OR)
#             if smaki:
#                 rs = r.get("smak") or []
#                 if not any(s in rs for s in smaki):
#                     continue
#
#             # pora (OR)
#             if pora:
#                 rp = r.get("pora", "")
#                 if not any(p in rp for p in pora if p):
#                     continue
#
#             # księżyc (OR)
#             if ksiezyc:
#                 rk = r.get("ksiezyc", "")
#                 if not any(m in rk for m in ksiezyc if m):
#                     continue
#
#             results.append(r)
#
#         return jsonify({"status": "ok", "count": len(results), "results": results})
#
#     except Exception as e:
#         import traceback
#         print("🔥 Błąd w API /api/generator_przepisow")
#         traceback.print_exc()
#         return jsonify({"error": "Internal error", "details": str(e)}), 500

# 🔍 Pomocnicze dopasowywanie smaków
def infer_cele(przepis):
    zastosowanie = (przepis.get("zastosowanie") or "").lower()
    cechy = (przepis.get("cechy") or []) + (przepis.get("wlasciwosci") or [])
    tekst = zastosowanie + " " + " ".join(cechy).lower()
    cele = []

    if "kaszel" in tekst or "gardło" in tekst or "przeziębienie" in tekst or "drogi oddechowe" in tekst:
        cele.append("na kaszel")
    if "trawienie" in tekst or "jelita" in tekst or "żołądek" in tekst or "wzdęcia" in tekst:
        cele.append("na trawienie")
    if "wątroba" in tekst or "oczyszczanie" in tekst:
        cele.append("wątroba")
    if "skóra" in tekst or "egzema" in tekst or "trądzik" in tekst or "wysypka" in tekst:
        cele.append("skóra")
    if "odporność" in tekst or "wzmocnienie" in tekst or "układ immunologiczny" in tekst:
        cele.append("odporność")
    if "sen" in tekst or "bezsenność" in tekst or "uspokojenie" in tekst:
        cele.append("sen")
    if "układ moczowy" in tekst or "nerki" in tekst:
        cele.append("układ moczowy")
    if "układ krążenia" in tekst or "serce" in tekst or "ciśnienie" in tekst:
        cele.append("układ krążenia")
    if "bóle" in tekst or "ból" in tekst:
        cele.append("bóle")
    if "układ nerwowy" in tekst or "nerwy" in tekst or "depresja" in tekst:
        cele.append("układ nerwowy")
    if "cukrzyca" in tekst or "glukoza" in tekst:
        cele.append("cukrzyca")
    if "menstruacja" in tekst or "cykl miesiączkowy" in tekst or "krwawienie" in tekst:
        cele.append("menstruacja")
    if "reumatyzm" in tekst or "stawy" in tekst:
        cele.append("stawy")
    if "przeciwzapalne" in tekst or "zapaleniem" in tekst:
        cele.append("przeciwzapalne")
    if "antybakteryjne" in tekst or "przeciwbakteryjne" in tekst:
        cele.append("antybakteryjne")
    if "przeciwwirusowe" in tekst:
        cele.append("przeciwwirusowe")

    return list(set(cele)) or []


# 🔍 Pomocnicze dopasowywanie kategorii celu
def infer_taste(przepis):
    cechy = (przepis.get("cechy") or []) + (przepis.get("wlasciwosci") or []) + (przepis.get("skladniki") or [])
    tekst = " ".join(cechy).lower()
    tags = []

    if any(w in tekst for w in ["miód", "słodk", "cukier", "syrop", "rodzynki", "owoce suszone"]):
        tags.append("słodkie")
    if any(w in tekst for w in ["ocet", "cytryna", "kwasek", "kwaśn", "kiszon", "jabłczan"]):
        tags.append("kwaśny")
    if any(w in tekst for w in ["gorycz", "gorzki", "piołun", "krwawnik", "tatarak"]):
        tags.append("gorzki")
    if any(w in tekst for w in ["imbir", "pieprz", "chilli", "ostra", "pikant", "papryczka"]):
        tags.append("pikantny")
    if any(w in tekst for w in
           ["aromatyczny", "zioł", "liść", "bazylia", "tymianek", "oregano", "majeranek", "rozmaryn"]):
        tags.append("ziołowy")
    if any(w in tekst for w in ["czosnek", "cebula", "korzeń", "kminek", "koperek", "lubczyk"]):
        tags.append("korzenny")
    if any(w in tekst for w in ["anyż", "goździki", "cynamon", "wanilia", "kardamon"]):
        tags.append("przyprawowy")
    if any(w in tekst for w in ["mięta", "melisa", "eukaliptus", "mentol"]):
        tags.append("świeży")

    return list(set(tags)) or []


# ------------- Helpers -------------
def load_jsons():
    data = []
    for fn in os.listdir('.'):
        if fn.endswith('.json'):
            try:
                with open(fn, 'r', encoding='utf-8') as f:
                    j = json.load(f)
                    # normalize fields expected by templates
                    slug = os.path.splitext(fn)[0]
                    name = j.get('gatunek') or j.get('gatunek', slug.replace('_', ' ').title())
                    latin = j.get('nazwa_lacinska', '')
                    category = (j.get('nazwa_zbioru') or ['inne'])[0]
                    data.append({
                        'slug': slug,
                        'name': name,
                        'latin': latin,
                        'category': category,
                        'data': j
                    })
            except Exception as e:
                print('Failed to load', fn, e)
    return data


def moon_phase_for_today():
    # simple approximation
    now = datetime.datetime.utcnow()
    known_new_moon = datetime.datetime(2000, 1, 6, 18, 14)  # reference
    days = (now - known_new_moon).total_seconds() / 86400.0
    synodic = 29.53058867
    phase = days % synodic
    percent = int(100 * (1 - abs(phase - synodic / 2) / (synodic / 2)))
    if phase < 1.84566:
        name = "nów"
    elif phase < 5.53699:
        name = "sierp przybywający"
    elif phase < 9.22831:
        name = "pierwsza kwadra"
    elif phase < 12.91963:
        name = "garb przybywający"
    elif phase < 16.61096:
        name = "pełnia"
    elif phase < 20.30228:
        name = "garb ubywający"
    elif phase < 23.99361:
        name = "ostatnia kwadra"
    elif phase < 27.68493:
        name = "sierp ubywający"
    else:
        name = "nów"
    return name, percent


ALL_PLANTS = load_jsons()


@app.context_processor
def inject_globals():
    name, percent = moon_phase_for_today()
    return {
        'now': datetime.datetime.now(),
        'moon_phase': name,
        'moon_percent': percent,
        # 'all_plants': all_plants()  # ← jeśli chcesz mieć w każdym szablonie
    }


def get_moon_phase():
    now = datetime.datetime.utcnow()
    moon = ephem.Moon(now)
    phase = moon.phase  # 0–100

    if phase < 1.5:
        return ("🌑 Nów", round(phase, 1))
    elif phase < 49:
        return ("🌒 Faza rosnąca", round(phase, 1))
    elif phase < 51:
        return ("🌕 Pełnia", round(phase, 1))
    elif phase < 99:
        return ("🌘 Faza malejąca", round(phase, 1))
    else:
        return ("🌑 Nów", round(phase, 1))


moon_phase, moon_percent = get_moon_phase()


def highlight(text, q):
    # Bezpieczne podświetlenie
    return Markup(re.sub(
        re.escape(q),
        lambda m: f"<b>{m.group(0)}</b>",
        text,
        flags=re.IGNORECASE)
    )


def build_tree():
    tree = {}
    for cat in CATEGORIES:
        for plant in get_plants(cat):
            data = load_plant(cat, plant)
            zbior = data.get("nazwa_zbioru", [])
            node = tree
            for poziom in zbior[:-1]:
                node = node.setdefault(poziom, {})
            node.setdefault('gatunki', []).append({
                'name': data["gatunek"],
                'latin': data.get("nazwa_lacinska", ""),
                'slug': plant,
                'category': cat,
            })
    return tree


def get_plants(category):
    folder = PLANTS_DIR / category
    if not folder.exists():
        return []
    return [p.stem for p in folder.glob("*.json")]


def load_plant(category, plant):
    path = PLANTS_DIR / category / f"{plant}.json"
    if not path.exists():
        abort(404)
    return json.loads(path.read_text(encoding="utf-8"))


def all_plants():
    out = []
    for json_path in PLANTS_DIR.glob("*/*.json"):
        category = json_path.parent.name
        slug = json_path.stem
        data = json.loads(json_path.read_text(encoding="utf-8"))
        out.append({
            "category": category,
            "slug": slug,
            "name": data.get("gatunek", slug.replace("_", " ")),
            "latin": data.get("nazwa_lacinska", ""),
            "trujacy": any(
                "trujący" in (u.get("uwaga", "") + u.get("rozwiazanie", "")).lower()
                for u in (data.get("uwagi_i_ostrzezenia") or [])
                if isinstance(u, dict)
            ),
            "data": data
        })
    return out


@app.route("/generator_przepisow")
def generator_przepisow():
    now = datetime.datetime.now()
    moon_phase, moon_percent = get_moon_phase()
    return render_template("generator_przepisow.html",
                           all_plants=all_plants(),
                           now=now,
                           moon_phase=moon_phase,
                           moon_percent=moon_percent)


@app.route("/<category>/")
def lista(category):
    plants = get_plants(category)
    # Filtry
    q = request.args.get("q", "").lower()
    dzialanie = request.args.get("dzialanie", "")
    tylko_trujace = request.args.get("trujace") == "1"
    sort = request.args.get("sort", "az")
    wyniki = []
    for plant in plants:
        data = load_plant(category, plant)
        if q and q not in data["gatunek"].lower() and q not in data.get("nazwa_lacinska", "").lower():
            continue
        if dzialanie:
            ok = False
            for skl in data.get("wlasciwosci_i_skladniki", []):
                if dzialanie.lower() in skl.get("dzialanie", "").lower():
                    ok = True
            if not ok:
                continue
        if tylko_trujace:
            if not any("trujący" in (u["uwaga"] + u.get("rozwiazanie", "")).lower() for u in
                       data.get("uwagi_i_ostrzezenia", [])):
                continue
        wyniki.append((plant, data))
    # Sortowanie
    if sort == "za":
        wyniki.sort(key=lambda x: x[1].get("gatunek", ""))
        wyniki.reverse()
    else:
        wyniki.sort(key=lambda x: x[1].get("gatunek", ""))
    return render_template("lista.html", category=category, wyniki=wyniki, q=q, dzialanie=dzialanie,
                           tylko_trujace=tylko_trujace, sort=sort)


@app.route("/szukaj")
def search():
    now = datetime.datetime.now()
    q = request.args.get("q", "").strip()
    q_lower = q.lower()
    results_names = []
    results_details = []
    for plant in all_plants():
        data = plant["data"]
        name_match = []
        details_match = []

        # Sekcja 1: TYLKO nazwa gatunku i podgatunku (oraz łacińska)
        if (
                q_lower in (data.get("gatunek", "").lower())
                or q_lower in (data.get("podgatunek") or "").lower()
                or q_lower in (data.get("nazwa_lacinska") or "").lower()
        ):
            name_match.append(("Nazwa", highlight(f"{data.get('gatunek', '')} ({data.get('nazwa_lacinska', '')})", q)))
            plant_copy = plant.copy()
            plant_copy["matches"] = name_match
            results_names.append(plant_copy)

        # Sekcja 2: Szczegóły – szukaj we wszystkich innych polach (może być też w nazwie, ale wyświetlamy)
        # (możesz wziąć stary kod z twojego search_in_plant/old search)
        matches = []
        # ...tu wrzuć logikę z wcześniejszego search_in_plant, ale pomiń pole 'gatunek', 'podgatunek', 'nazwa_lacinska'
        # przykład uproszczony poniżej:
        # (wyciągnij, jeśli chcesz bardziej zaawansowane szukanie w szczegółach)
        for key in ["opis_botaniczny", "wlasciwosci_i_skladniki", "cechy_i_historia", "uwagi_i_ostrzezenia",
                    "przepisy_medyczne", "przepisy_kulinarne"]:
            value = data.get(key)
            if not value:
                continue
            if isinstance(value, dict):
                for subk, v in value.items():
                    if isinstance(v, str) and q_lower in v.lower():
                        matches.append((f"{key}: {subk}", highlight(v, q)))
                    elif isinstance(v, list):
                        for elem in v:
                            if isinstance(elem, str) and q_lower in elem.lower():
                                matches.append((f"{key}: {subk}", highlight(elem, q)))
            elif isinstance(value, list):
                for item in value:
                    for subk, v in item.items():
                        if isinstance(v, str) and q_lower in v.lower():
                            matches.append((f"{key}: {subk}", highlight(v, q)))
        if matches:
            plant_copy = plant.copy()
            plant_copy["matches"] = matches
            results_details.append(plant_copy)

    return render_template(
        "search.html",
        q=q,
        results_names=results_names,
        results_details=results_details,
        now=now
    )


@app.route("/ulubione")
def ulubione():
    now = datetime.datetime.now()
    moon_phase, moon_percent = get_moon_phase()
    return render_template("ulubione.html",
                           all_plants=all_plants(),
                           now=now,
                           moon_phase=moon_phase,
                           moon_percent=moon_percent)


@app.route("/kontakt")
def kontakt():
    return render_template("kontakt.html")


@app.route("/generator_ogrodu")
def generator_ogrodu():
    # Sama strona, wybór roślin przez JS, podsumowanie przez JS
    return render_template("generator_ogrodu.html", all_plants=all_plants())


@app.route("/<category>/<plant>")
def roslina(category, plant):
    data = load_plant(category, plant)
    current_month = datetime.datetime.now().month  # 1 = styczeń, 12 = grudzień
    now = datetime.datetime.now()
    return render_template(
        "roslina.html",
        data=data,
        slug=plant,
        category=category,
        all_plants=all_plants(),
        now=now,
        current_month=current_month,
        moon_phase=moon_phase,
        moon_percent=moon_percent
    )


@app.route("/<category>/<plant>/bibliografia")
def bibliografia(category, plant):
    data = load_plant(category, plant)
    return render_template("bibliografia.html", bibliografia=data["bibliografia"])


@app.route("/<category>/<plant>/fragment/<grupa>")
def fragment(category, plant, grupa):
    data = load_plant(category, plant)
    return render_template(
        f"fragmenty/roslina_{grupa}.html",
        data=data,
        category=category,
        slug=plant
    )


@app.route("/<category>/<plant>/fragment/przepisy_kulinarne_all")
def fragment_przepisy_kulinarne_all(category, plant):
    data = load_plant(category, plant)
    przepisy_solo = data.get("przepisy_kulinarne", {})  # dict: nazwa: obiekt
    mieszanki = data.get("przepisy_z_innymi_roslinami", {}).get("kulinarne", [])  # lista dictów
    return render_template("fragmenty/roslina_przepisy_kulinarne_all.html",
                           przepisy=przepisy_solo,
                           mieszanki=mieszanki,
                           data=data)


@app.route("/<category>/<plant>/fragment/przepisy_medyczne_all")
def fragment_przepisy_medyczne_all(category, plant):
    data = load_plant(category, plant)
    przepisy_solo = data.get("przepisy_medyczne", {})
    mieszanki = data.get("przepisy_z_innymi_roslinami", {}).get("medyczne", [])
    return render_template("fragmenty/roslina_przepisy_medyczne_all.html",
                           przepisy=przepisy_solo,
                           mieszanki=mieszanki,
                           data=data)


@app.route('/fragment/<category>/<plant>/przepisy/nalewki')
def fragment_przepisy_nalewki_all(category, plant):
    # Wczytaj dane i renderuj odpowiedni fragment
    return render_template('fragment_przepisy_nalewki_all.html')


@app.route('/fragment/<category>/<plant>/przepisy/napoje')
def fragment_przepisy_napoje_all(category, plant):
    # Wczytaj dane i renderuj odpowiedni fragment
    return render_template('fragment_przepisy_napoje_all.html')


@app.route("/")
def index():
    # tree = build_tree()
    # now = datetime.datetime.now()
    # moon_phase, moon_percent = get_moon_phase()
    # return render_template("index.html",
    #                        tree=tree,
    #                        all_plants=all_plants(),
    #                        now=now,
    #                        moon_phase=moon_phase,
    #                        moon_percent=moon_percent)
    all_plants = build_plant_manifest()
    return render_template("index.html",
                           all_plants=all_plants)


@app.route("/newage")
def newage():
    all_plants = build_plant_manifest()
    return render_template("newage2.html",
                           all_plants=all_plants)


ALLOWED_PLANT_CATS = {"ziola", "drzewa", "krzewy", "bulwy", "cebule", "egzotyczne"}


@app.route('/static/data/rosliny/<category>/<path:filename>')
def serve_plants_static(category, filename):
    if category not in ALLOWED_PLANT_CATS:
        abort(404)
    return send_from_directory(PLANTS_DIR / category, filename)


# ---------- Open‑Meteo proxy (CORS-safe) ----------

OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search"
OPEN_METEO_REVERSE = "https://geocoding-api.open-meteo.com/v1/reverse"


def corsify(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return resp


@app.route('/api/geocode')
def api_geocode():
    q = request.args.get('q', '')
    params = {
        'name': q,
        'language': 'pl',
        'count': 10,
        'format': 'json'
    }
    try:
        r = requests.get(OPEN_METEO_GEOCODE, params=params, timeout=10)
        data = r.json()
    except Exception as e:
        data = {'error': True, 'message': str(e)}
    return corsify(
        make_response(json.dumps(data, ensure_ascii=False), 200, {'Content-Type': 'application/json; charset=utf-8'}))


@app.route('/api/reverse_geocode')
def api_reverse_geocode():
    lat = request.args.get('latitude') or request.args.get('lat')
    lon = request.args.get('longitude') or request.args.get('lon')
    params = {
        'latitude': lat,
        'longitude': lon,
        'language': 'pl',
        'format': 'json'
    }
    try:
        r = requests.get(OPEN_METEO_REVERSE, params=params, timeout=10)
        data = r.json()
    except Exception as e:
        data = {'error': True, 'message': str(e)}
    return corsify(
        make_response(json.dumps(data, ensure_ascii=False), 200, {'Content-Type': 'application/json; charset=utf-8'}))


# Static pass-through (if run directly)
@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)


if __name__ == "__main__":
    app.run(debug=True)
