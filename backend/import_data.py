import os
from pathlib import Path

import pandas as pd

try:
    from .constants import SPECIFIC_ARTICLES, SPECIFIC_GROUPS
    from .database import Base, SessionLocal, engine
    from .models import Article, Employee, MachineGroup
except ImportError:
    from constants import SPECIFIC_ARTICLES, SPECIFIC_GROUPS
    from database import Base, SessionLocal, engine
    from models import Article, Employee, MachineGroup

Base.metadata.create_all(bind=engine)

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CSV_PATH = ROOT_DIR / "Stämplingslogg-2026-01-15.csv"
EMPLOYEE_NUMBER_COLUMN = "Anställningsnummer"
EMPLOYEE_NAME_COLUMN = "Namn"


def resolve_csv_path():
    csv_path = Path(os.environ.get("PLANNER_IMPORT_CSV", DEFAULT_CSV_PATH))
    if not csv_path.is_absolute():
        csv_path = ROOT_DIR / csv_path
    return csv_path


def import_data():
    db = SessionLocal()
    try:
        csv_path = resolve_csv_path()
        try:
            df = pd.read_csv(csv_path, encoding="utf-8-sig", dtype=str)
        except FileNotFoundError:
            print(f"CSV file not found at {csv_path}, skipping employee import.")
            df = pd.DataFrame()

        if not df.empty:
            employees = df[[EMPLOYEE_NUMBER_COLUMN, EMPLOYEE_NAME_COLUMN]].drop_duplicates()
            seen_employees = {employee.number for employee in db.query(Employee).all()}

            for _, row in employees.iterrows():
                number = str(row[EMPLOYEE_NUMBER_COLUMN]).strip()
                name = str(row[EMPLOYEE_NAME_COLUMN]).strip()

                if not number or not name or pd.isna(number) or pd.isna(name):
                    continue

                if number not in seen_employees:
                    db.add(Employee(number=number, name=name))
                    seen_employees.add(number)

        seen_articles = {article.name for article in db.query(Article).all()}
        for name in SPECIFIC_ARTICLES:
            if name not in seen_articles:
                db.add(Article(name=name))
                seen_articles.add(name)

        seen_groups = {group.name for group in db.query(MachineGroup).all()}
        for name in SPECIFIC_GROUPS:
            if name not in seen_groups:
                db.add(MachineGroup(name=name))
                seen_groups.add(name)

        db.commit()
        print("Data import successful!")
    except Exception as exc:
        print(f"Error importing data: {exc}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    import_data()
