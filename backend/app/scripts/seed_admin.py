"""Seed admin user and default RAG config."""

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import RagConfig, User, UserRole
from app.services.auth_service import create_user, get_user_by_email


def main():
    db = SessionLocal()
    try:
        if not get_user_by_email(db, settings.admin_email):
            create_user(
                db,
                settings.admin_email,
                settings.admin_password,
                settings.admin_full_name,
                UserRole.admin,
            )
            print(f"Created admin user: {settings.admin_email}")
        else:
            print(f"Admin user already exists: {settings.admin_email}")

        defaults = {
            "top_n": str(settings.search_default_top_n),
            "embedding_type": settings.embedding_type_default,
            "vector_weight": str(settings.rrf_vector_weight),
            "keyword_weight": str(settings.rrf_keyword_weight),
            "rrf_k": str(settings.rrf_k),
        }
        for key, value in defaults.items():
            if not db.query(RagConfig).filter(RagConfig.key == key).first():
                db.add(RagConfig(key=key, value=value))
        db.commit()
        print("RAG config defaults seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
