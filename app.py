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

@app.route("/szukaj")
def search():
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
            name_match.append(("Nazwa", highlight(f"{data.get('gatunek','')} ({data.get('nazwa_lacinska','')})", q)))
            plant_copy = plant.copy()
            plant_copy["matches"] = name_match
            results_names.append(plant_copy)

        # Sekcja 2: Szczegóły – szukaj we wszystkich innych polach (może być też w nazwie, ale wyświetlamy)
        # (możesz wziąć stary kod z twojego search_in_plant/old search)
        matches = []
        # ...tu wrzuć logikę z wcześniejszego search_in_plant, ale pomiń pole 'gatunek', 'podgatunek', 'nazwa_lacinska'
        # przykład uproszczony poniżej:
        # (wyciągnij, jeśli chcesz bardziej zaawansowane szukanie w szczegółach)
        for key in ["opis_botaniczny", "wlasciwosci_i_skladniki", "cechy_i_historia", "uwagi_i_ostrzezenia", "przepisy_medyczne", "przepisy_kulinarne"]:
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
    )

@app.route("/ulubione")
def ulubione():
    return render_template("ulubione.html", all_plants=all_plants())

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
if __name__ == "__main__":
    app.run(debug=True)
