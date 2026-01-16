import json
from database import SessionLocal
from models import Employee, Article, MachineGroup
from constants import SPECIFIC_ARTICLES, SPECIFIC_GROUPS

def clean_data():
    db = SessionLocal()
    try:
        # Get employees (keep all from CSV import, minus specific exclusions)
        excluded_names = ["Mensur Butkovic", "Henric Thylander"]
        employees = [
            {'id': e.id, 'name': e.name, 'number': e.number}
            for e in db.query(Employee).all()
            if e.name not in excluded_names
        ]

        # Hardcoded Articles
        # We need IDs for them. If they exist in DB, use that ID. If not, we might have an issue with mock consistency vs real DB.
        # But for 'initialData.json', we can just generate new IDs or map them.
        # To be safe, we rely on what's in the DB but FILTER it by the strict list.

        db_articles = db.query(Article).filter(Article.name.in_(SPECIFIC_ARTICLES)).all()
        # If DB is missing some hardcoded ones, we should technically add them, but for now lets dump what we have matching the strict list.
        articles = [{'id': a.id, 'name': a.name} for a in db_articles]

        db_groups = db.query(MachineGroup).filter(MachineGroup.name.in_(SPECIFIC_GROUPS)).all()
        machine_groups = [{'id': m.id, 'name': m.name} for m in db_groups]

        data = {
            'employees': employees,
            'articles': articles,
            'machine_groups': machine_groups
        }

        print(json.dumps(data))

    finally:
        db.close()

if __name__ == "__main__":
    clean_data()
