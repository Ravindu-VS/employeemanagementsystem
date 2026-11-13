import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Retrieve database URL from environment variable, falling back to local PostgreSQL defaults
DATABASE_URL = os.environ["DATABASE_URL"]  # required — never hard-code credentials

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session in path operations
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
