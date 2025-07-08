from flask import Flask, render_template, abort, request, redirect, url_for
from markupsafe import Markup
import os
import json
import re

app = Flask(__name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CATEGORIES = ["drzewa", "krzewy", "ziola", "bulwy", "cebule", "egzotyczne"]

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
    folder = os.path.join(DATA_DIR, category)
    if not os.path.exists(folder):
        return []
    return [
        f[:-5]
        for f in os.listdir(folder)
        if f.endswith(".json")
    ]


def load_plant(category, plant):
    path = os.path.join(DATA_DIR, category, f"{plant}.json")
    if not os.path.exists(path):
        abort(404)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def all_plants():
    out = []
    for cat in CATEGORIES:
        for plant in get_plants(cat):
            data = load_plant(cat, plant)
            out.append({
                "category": cat,
                "slug": plant,
                "name": data.get("gatunek", plant.replace("_", " ")),
                "latin": data.get("nazwa_lacinska", ""),
                "trujacy": any(
                    "trujący" in (u["uwaga"] + u.get("rozwiazanie", "")).lower()
                    for u in data.get("uwagi_i_ostrzezenia", [])
                ),
                "data": data
            })
    return out


@app.route("/")
def index():
    tree = build_tree()
    return render_template("index.html", tree=tree)


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




def search_in_plant(plant, query):
    """Zwraca listę fragmentów tekstu (pola i tekst), gdzie znaleziono zapytanie."""
    hits = []
    q = query.lower()
    # Szukaj we wszystkich istotnych polach:
    for key in ["gatunek", "nazwa_lacinska"]:
        val = plant["data"].get(key, "")
        if q in (val or "").lower():
            hits.append(("Nazwa", val))
    # Opis botaniczny
    opis = plant["data"].get("opis_botaniczny", {})
    for field, val in opis.items():
        if isinstance(val, str) and q in val.lower():
            hits.append((field.capitalize(), val))
    # Właściwości
    for skl in plant["data"].get("wlasciwosci_i_skladniki", []):
        for field in ["nazwa", "dzialanie", "sklad", "ciekawostka"]:
            val = skl.get(field)
            if val and q in val.lower():
                hits.append((field.capitalize(), val))
    # Cechy, historia, ciekawostki
    cechy_hist = plant["data"].get("cechy_i_historia", {})
    for field in ["opis"] + cechy_hist.get("cechy", []) + cechy_hist.get("zastosowanie_historyczne",
                                                                         []) + cechy_hist.get("ciekawostki", []):
        if isinstance(field, str) and q in field.lower():
            hits.append(("Historia/Cechy", field))
    # Uwagi i ostrzeżenia
    for u in plant["data"].get("uwagi_i_ostrzezenia", []):
        for field in ["uwaga", "rozwiazanie"]:
            val = u.get(field)
            if val and q in val.lower():
                hits.append(("Ostrzeżenia", val))
    # Przepisy medyczne i kulinarne
    for typ in ["przepisy_medyczne", "przepisy_kulinarne"]:
        przepisy = plant["data"].get(typ, {})
        for nazwa, przepis in przepisy.items():
            for pole in ["skladniki", "sposob_przygotowania", "cechy", "wlasciwosci", "zastosowanie"]:
                wart = przepis.get(pole)
                if isinstance(wart, list):
                    for w in wart:
                        if q in w.lower():
                            hits.append((f"{typ}:{nazwa}", w))
                elif isinstance(wart, str) and q in wart.lower():
                    hits.append((f"{typ}:{nazwa}", wart))
    # Przepisy z innymi roślinami
    for typ in ["medyczne", "kulinarne"]:
        for miesz in plant["data"].get("przepisy_z_innymi_roslinami", {}).get(typ, []):
            for pole in ["nazwa", "skladniki", "sposob_przygotowania", "cechy", "wlasciwosci", "zastosowanie"]:
                wart = miesz.get(pole)
                if isinstance(wart, list):
                    for w in wart:
                        if q in w.lower():
                            hits.append((f"przepisy_z_innymi_{typ}", w))
                elif isinstance(wart, str) and q in wart.lower():
                    hits.append((f"przepisy_z_innymi_{typ}", wart))
    return hits


@app.route("/szukaj")
def search():
    q = request.args.get("q", "").strip()
    q_lower = q.lower()
    results = []
    for plant in all_plants():
        data = plant["data"]
        matches = []

        # Nazwa polska/łacińska
        if q_lower in plant["name"].lower() or q_lower in plant["latin"].lower():
            matches.append(("Nazwa", highlight(f"{plant['name']} ({plant['latin']})", q)))

        # Przeszukaj wybrane sekcje tekstowe
        for section, pretty in [
            ("opis_botaniczny", "Opis"),
            ("wlasciwosci_i_skladniki", "Właściwości/składniki"),
            ("cechy_i_historia", "Historia/Cechy"),
            ("uwagi_i_ostrzezenia", "Uwagi"),
            ("przepisy_medyczne", "Przepisy medyczne"),
            ("przepisy_kulinarne", "Przepisy kulinarne"),
        ]:
            value = data.get(section)
            if not value:
                continue
            # Dict (np. opis_botaniczny, cechy_i_historia, przepisy_medyczne)
            if isinstance(value, dict):
                for key, v in value.items():
                    if isinstance(v, str) and q_lower in v.lower():
                        matches.append((f"{pretty}: {key}", highlight(v, q)))
                    elif isinstance(v, list):
                        for elem in v:
                            if isinstance(elem, str) and q_lower in elem.lower():
                                matches.append((f"{pretty}: {key}", highlight(elem, q)))
            # List (np. wlasciwosci_i_skladniki, uwagi_i_ostrzezenia)
            elif isinstance(value, list):
                for item in value:
                    for k, v in item.items():
                        if isinstance(v, str) and q_lower in v.lower():
                            matches.append((f"{pretty}: {k}", highlight(v, q)))

        if matches:
            plant["matches"] = matches
            results.append(plant)
    return render_template("search.html", results=results, q=q)

@app.route("/ulubione")
def ulubione():
    # Sama strona; lista w localStorage, pobiera dane przez JS
    return render_template("ulubione.html")


@app.route("/porownaj")
def porownaj():
    roslina1 = request.args.get("roslina1")
    roslina2 = request.args.get("roslina2")
    plant1, plant2 = None, None
    for cat in CATEGORIES:
        if not plant1 and roslina1 in get_plants(cat):
            plant1 = (cat, load_plant(cat, roslina1))
        if not plant2 and roslina2 in get_plants(cat):
            plant2 = (cat, load_plant(cat, roslina2))
    if not plant1 or not plant2:
        return "Nie znaleziono obu roślin", 404
    return render_template("porownaj.html", plant1=plant1, plant2=plant2)


@app.route("/generator_ogrodu")
def generator_ogrodu():
    # Sama strona, wybór roślin przez JS, podsumowanie przez JS
    return render_template("generator_ogrodu.html", all_plants=all_plants())


@app.route("/<category>/<plant>")
def roslina(category, plant):
    data = load_plant(category, plant)
    return render_template("roslina.html", data=data, slug=plant, category=category)


@app.route("/<category>/<plant>/bibliografia")
def bibliografia(category, plant):
    data = load_plant(category, plant)
    return render_template("bibliografia.html", bibliografia=data["bibliografia"])


if __name__ == "__main__":
    app.run(debug=True)
