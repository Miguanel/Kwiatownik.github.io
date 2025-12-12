import os

class Settings:
    SECRET_KEY = os.environ.get("APP_SECRET", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "")
    # Render/PG tipy: pre_ping + pool_recycle zapobiega padom po idle
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "5")),
    }
    JSON_SORT_KEYS = False

settings = Settings()
