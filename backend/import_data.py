import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Employee, Article, MachineGroup

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def import_data():
    db = SessionLocal()
    try:
        # Read CSV
        df = pd.read_csv("../Stämplingslogg-2026-01-15.csv")

        # 1. Employees
        employees = df[['Anställningsnummer', 'Namn']].drop_duplicates()
        seen_employees = set()

        # Pre-load existing to avoid duplicates across runs
        existing_employees = db.query(Employee).all()
        for e in existing_employees:
            seen_employees.add(e.number)

        for _, row in employees.iterrows():
            number = str(row['Anställningsnummer']).strip()
            name = str(row['Namn']).strip()

            if not number or not name or pd.isna(number) or pd.isna(name):
                continue

            if number not in seen_employees:
                db.add(Employee(number=number, name=name))
                seen_employees.add(number)

        # 2. Articles
        articles = df['Artikelbenämning'].drop_duplicates()
        seen_articles = set()

        existing_articles = db.query(Article).all()
        for a in existing_articles:
            seen_articles.add(a.name)

        for name in articles:
            if pd.isna(name) or not str(name).strip():
                continue
            name = str(name).strip()

            if name not in seen_articles:
                db.add(Article(name=name))
                seen_articles.add(name)

        # 3. Machine Groups
        groups = df['Operationsbenämning'].drop_duplicates()
        seen_groups = set()

        existing_groups = db.query(MachineGroup).all()
        for g in existing_groups:
            seen_groups.add(g.name)

        for name in groups:
            if pd.isna(name) or not str(name).strip():
                continue
            name = str(name).strip()

            if name not in seen_groups:
                db.add(MachineGroup(name=name))
                seen_groups.add(name)

        db.commit()
        print("Data import successful!")

    except Exception as e:
        print(f"Error importing data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_data()
