run:
\tpython run.py
migrate:
\talembic revision -m "$(m)" --autogenerate
upgrade:
\talembic upgrade head
seed:
\tpsql "$$DATABASE_URL" -f db/010_seed.sql
initdb:
\tpsql "$$DATABASE_URL" -f db/000_init.sql
