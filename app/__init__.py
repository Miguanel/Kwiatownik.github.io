# app/__init__.py (NOWA)
from flask import Flask, jsonify
from .config import settings
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# NIC nie tworzymy globalnie
SessionLocal = sessionmaker(autoflush=False, autocommit=False)
engine = None  # zostanie zainicjalizowany w create_app

def create_app():
    global engine
    app = Flask(__name__)
    app.config["SECRET_KEY"] = settings.SECRET_KEY

    if not settings.SQLALCHEMY_DATABASE_URI:
        raise RuntimeError("Brak DATABASE_URL – ustaw zmienną środowiskową.")

    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI,
        **settings.SQLALCHEMY_ENGINE_OPTIONS,
    )
    SessionLocal.configure(bind=engine)

    @app.get("/healthz")
    def healthz():
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return jsonify(status="ok")

    from .routes import bp as api_bp
    app.register_blueprint(api_bp, url_prefix="/api")
    return app
