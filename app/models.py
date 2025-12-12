# app/models.py
from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional, Dict, Any

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    CheckConstraint,
    Index,
    Float,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# --- Alembic-friendly naming convention ---
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming_convention)


# --- Mixins ---

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


# ========================
#        SŁOWNIKI
# ========================

class Part(Base):
    """Słownik części rośliny: liść, kwiat, korzeń, kora…"""
    __tablename__ = "parts"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    name_pl: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    latin: Mapped[Optional[str]] = mapped_column(String(80))

    # Źródła
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)


class Tag(Base):
    """Tagi/kategorie ogólne (np. „drzewo”, „zioło”, „smak-mięta”, „typ_przepisu”…)."""
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name_pl: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="inne")
    description: Mapped[Optional[str]] = mapped_column(Text)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    __table_args__ = (
        CheckConstraint(
            "category IN ('roślina','cel','cecha','typ_przepisu','smak','inne')",
            name="category_tag_ck",
        ),
    )


class Use(Base):
    """Zastosowania (np. „na kaszel”, „na sen”, „odporność”)."""
    __tablename__ = "uses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name_pl: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="medyczne")
    notes: Mapped[Optional[str]] = mapped_column(Text)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    __table_args__ = (
        CheckConstraint(
            "kind IN ('medyczne','kulinarne','rytualne','inne')",
            name="kind_use_ck",
        ),
    )


class RecipeType(Base):
    """Typy przepisów: nalewka, napar, odwar, syrop, danie, napój…"""
    __tablename__ = "recipe_types"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name_pl: Mapped[str] = mapped_column(String(80), nullable=False)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)


# ========================
#         ROŚLINY
# ========================

class Plant(Base, TimestampMixin):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    latin_binominal: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    family_latin: Mapped[Optional[str]] = mapped_column(String(120))
    common_pl: Mapped[str] = mapped_column(String(160), nullable=False)

    description_md: Mapped[Optional[str]] = mapped_column(Text)
    cultivation_md: Mapped[Optional[str]] = mapped_column(Text)
    harvest_md: Mapped[Optional[str]] = mapped_column(Text)
    hazards_md: Mapped[Optional[str]] = mapped_column(Text)

    meta_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    # FTS; trigger i aktualizacja wektorów robimy w migracji SQL
    search_vector: Mapped[Optional[str]] = mapped_column(TSVECTOR)

    # --- Relacje ---
    names: Mapped[List["PlantName"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    parts_rel: Mapped[List["PlantPart"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    parts: Mapped[List[Part]] = relationship(secondary="plant_parts", viewonly=True)

    tags_rel: Mapped[List["PlantTag"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tags: Mapped[List[Tag]] = relationship(secondary="plant_tags", viewonly=True)

    uses_rel: Mapped[List["PlantUse"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    uses: Mapped[List[Use]] = relationship(secondary="plant_uses", viewonly=True)

    images: Mapped[List["Image"]] = relationship(
        back_populates="plant", cascade="all, set null", passive_deletes=True
    )
    sources: Mapped[List["Source"]] = relationship(
        back_populates="plant", cascade="all, set null", passive_deletes=True
    )

    recipe_links: Mapped[List["RecipeLink"]] = relationship(
        back_populates="plant", cascade="all, delete-orphan", passive_deletes=True
    )
    recipes: Mapped[List["Recipe"]] = relationship(secondary="recipe_links", viewonly=True)

    __table_args__ = (
        Index("ix_plants_common_pl", "common_pl"),
        Index("ix_plants_search_gin", "search_vector", postgresql_using="gin"),
    )


class PlantName(Base):
    __tablename__ = "plant_names"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
    )
    lang: Mapped[str] = mapped_column(String(10), default="pl", nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)

    # źródła nazewnictwa (słowniki, monografie itp.)
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped["Plant"] = relationship(back_populates="names")

    __table_args__ = (Index("ix_plant_names_name", "name"),)


class PlantPart(Base):
    """Asocjacja roślina ↔ część (z notatką)."""
    __tablename__ = "plant_parts"

    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), primary_key=True
    )
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), primary_key=True)
    notes_md: Mapped[Optional[str]] = mapped_column(Text)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped["Plant"] = relationship(back_populates="parts_rel")
    part: Mapped["Part"] = relationship()


class PlantTag(Base):
    """Asocjacja roślina ↔ tag."""
    __tablename__ = "plant_tags"

    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped["Plant"] = relationship(back_populates="tags_rel")
    tag: Mapped["Tag"] = relationship()


class PlantUse(Base):
    """Asocjacja roślina ↔ zastosowanie (siła, notatka)."""
    __tablename__ = "plant_uses"

    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), primary_key=True
    )
    use_id: Mapped[int] = mapped_column(
        ForeignKey("uses.id", ondelete="CASCADE"), primary_key=True
    )
    strength: Mapped[Optional[int]] = mapped_column(SmallInteger)
    notes_md: Mapped[Optional[str]] = mapped_column(Text)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped["Plant"] = relationship(back_populates="uses_rel")
    use: Mapped["Use"] = relationship()


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL")
    )
    title: Mapped[Optional[str]] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    license: Mapped[Optional[str]] = mapped_column(String(120))
    source: Mapped[Optional[str]] = mapped_column(String(300))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # źródła pozyskania/atrybucji zdjęcia (np. strona autora, archiwum)
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped[Optional["Plant"]] = relationship(back_populates="images")

    __table_args__ = (Index("ix_images_plant_id", "plant_id"),)


class Source(Base):
    """Opis bibliograficzny (czasem przypięty do rośliny)."""
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL")
    )
    citation: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[Optional[str]] = mapped_column(String(500))
    notes_md: Mapped[Optional[str]] = mapped_column(Text)

    # źródła źródła (np. archiwizacja, kopie)
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    plant: Mapped[Optional["Plant"]] = relationship(back_populates="sources")

    __table_args__ = (Index("ix_sources_plant_id", "plant_id"),)


# ========================
#         PRZEPISY
# ========================

class Recipe(Base, TimestampMixin):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    title_pl: Mapped[str] = mapped_column(String(200), nullable=False)
    recipe_type_id: Mapped[int] = mapped_column(
        ForeignKey("recipe_types.id"), nullable=False
    )

    intro_md: Mapped[Optional[str]] = mapped_column(Text)
    steps_md: Mapped[str] = mapped_column(Text, nullable=False)
    yield_text: Mapped[Optional[str]] = mapped_column(String(120))
    prep_time_min: Mapped[Optional[int]] = mapped_column(Integer)
    macer_time_h: Mapped[Optional[int]] = mapped_column(Integer)
    tips_md: Mapped[Optional[str]] = mapped_column(Text)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    recipe_type: Mapped["RecipeType"] = relationship()
    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="RecipeIngredient.position_ord",
    )
    links: Mapped[List["RecipeLink"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan", passive_deletes=True
    )
    plants: Mapped[List["Plant"]] = relationship(secondary="recipe_links", viewonly=True)

    __table_args__ = (Index("ix_recipes_title_pl", "title_pl"),)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False
    )
    plant_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL")
    )
    ingredient_txt: Mapped[Optional[str]] = mapped_column(String(200))
    part_id: Mapped[Optional[int]] = mapped_column(ForeignKey("parts.id"))
    qty_value: Mapped[Optional[float]] = mapped_column(Float)
    qty_unit: Mapped[Optional[str]] = mapped_column(String(32))
    notes: Mapped[Optional[str]] = mapped_column(String(200))
    position_ord: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")
    plant: Mapped[Optional["Plant"]] = relationship()
    part: Mapped[Optional["Part"]] = relationship()

    __table_args__ = (
        Index("ix_ri_recipe_id", "recipe_id"),
        Index("ix_ri_plant_id", "plant_id"),
    )


class RecipeLink(Base):
    """Powiązanie przepisu z rośliną (+ opcjonalnie zastosowaniem)."""
    __tablename__ = "recipe_links"

    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True
    )
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), primary_key=True
    )
    use_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("uses.id", ondelete="SET NULL"), primary_key=True
    )

    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    recipe: Mapped["Recipe"] = relationship(back_populates="links")
    plant: Mapped["Plant"] = relationship(back_populates="recipe_links")
    use: Mapped[Optional["Use"]] = relationship()

    __table_args__ = (
        UniqueConstraint("recipe_id", "plant_id", "use_id", name="uq_recipe_plant_use"),
    )


# ========================
#       UŻYTKOWNICY
# ========================

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(190), unique=True, nullable=False)
    display: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    favorites: Mapped[List["Favorite"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    garden_entries: Mapped[List["GardenEntry"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(16), primary_key=True)  # 'plant' | 'recipe'
    ref_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # zwykle nie potrzebujemy zrodla tutaj, ale jeśli chcesz śledzić „dlaczego dodałem”:
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    user: Mapped["User"] = relationship(back_populates="favorites")

    __table_args__ = (
        CheckConstraint("kind IN ('plant','recipe')", name="kind_favorite_ck"),
    )


class GardenEntry(Base):
    __tablename__ = "garden_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
    )
    location: Mapped[Optional[str]] = mapped_column(String(160))
    planted_on: Mapped[Optional[date]] = mapped_column(Date)
    notes_md: Mapped[Optional[str]] = mapped_column(Text)

    # np. źródła zaleceń uprawowych dla konkretnego wpisu ogrodowego
    zrodla: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSONB, default=list)

    user: Mapped["User"] = relationship(back_populates="garden_entries")
    plant: Mapped["Plant"] = relationship()

    __table_args__ = (
        Index("ix_garden_user_id", "user_id"),
        Index("ix_garden_plant_id", "plant_id"),
    )
