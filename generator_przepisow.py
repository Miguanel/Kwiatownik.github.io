# app.py — PEŁNA AKTUALIZACJA BACKENDU DLA GENERATORA PRZEPISÓW
# =====================================================================================
# ZAWIERA:
# - solidną normalizację danych przepisów (normalize_recipe)
# - ekstrakcję wszystkich przepisów (extract_all_recipes)
# - słownik do autosugestii (build_vocabulary)
# - API: /api/generator_przepisow  (filtracja z logiką AND między grupami, OR w ramach grup)
# - API: /api/suggest_words        (autosugestia do 5 trafień)
# - API: /api/filters_catalog      (katalog kapsułek: kategorie roślin, typy itd.)
# - API: /api/plants_list          (lista roślin pogrupowanych; zgodna z kapsułkami)
#
# UWAGI:
# - Logika filtrowania: AND między GRUPAMI filtrów (chips, cele, plants, kategorie_roślin, typy_*)
#   ale OR wewnątrz jednej grupy (np. kilka roślin = OR). To jest praktyczne i zgodne z UX.
# - "chips" (z inputu/autosugestii) sprawdzane są z logiką AND (każdy chip musi się znaleźć
#   w sklejonych polach: nazwa, roślina, składniki, cechy, właściwości, zastosowanie, rodzaj, typ).
# - Wszystkie endpointy są defensywnie pisane (odporne na braki pól i nietypowe typy danych).
# =====================================================================================

import re
from flask import Flask, jsonify, request


# Załóż, że istniejące funkcje/projekty:
# - app = Flask(__name__)
# - all_plants(): -> iterable z rekordami roślin:
#   {"name": "...", "slug": "...", "category": "drzewa|zioła|bulwy|korzenie|...", "data": {...}}
# - infer_taste(dict), infer_cele(dict) — z poprzednich kroków
# - renderowanie stron pozostaje bez zmian

# -----------------------------------------------
# Pomocnicze: slugify backendowy (bez unicodedata)
# -----------------------------------------------
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
