from flask import Flask, send_from_directory, jsonify, render_template_string, abort, request
import json
import os
import random

app = Flask(__name__, static_folder='static', template_folder='templates')


@app.route('/')
def index():
    # Wczytaj liczby jeśli istnieją
    numbers = []
    try:
        with open("random_numbers.json", "r", encoding="utf-8") as f:
            numbers = json.load(f)
    except:
        pass

    return render_template_string("generateNumbet.html", numbers)


@app.route('/generate', methods=['POST'])
def generate():
    numbers = random.sample(range(1, 101), 10)
    with open("random_numbers.json", "w", encoding="utf-8") as f:
        json.dump(numbers, f)
    return index()


@app.route('/style.css')
def style():
    return send_from_directory('.', 'style.css')


@app.route('/kwiatowik_data.json')
def data():
    return send_from_directory('.', 'kwiatowik_data.json')


@app.route('/roslina/<nazwa>')
def roslina(nazwa):
    try:
        with open('kwiatowik_data.json', encoding='utf-8') as f:
            data = json.load(f)
        if nazwa not in data:
            abort(404)
        plant = data[nazwa]

        return render_template_string("mainKwiat.hmtl", plant)
    except Exception as e:
        abort(500, str(e))


if __name__ == '__main__':
    app.run(debug=True)
