import json
from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

try:
    from . import models
    from .database import Base, SessionLocal, engine
except ImportError:
    import models
    from database import Base, SessionLocal, engine

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
REFERENCE_DATA_PATH = (
    Path(__file__).resolve().parent.parent / "frontend" / "src" / "data" / "initialData.json"
)
SPECIAL_MACHINE_GROUP_NAMES = {"Sjuk", "Arbetsledning"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ORMModel(BaseModel):
    class Config:
        from_attributes = True


class EmployeeBase(ORMModel):
    id: int
    number: str
    name: str


class EmployeeCreate(BaseModel):
    number: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)


class ArticleBase(ORMModel):
    id: int
    name: str


class MachineGroupBase(ORMModel):
    id: int
    name: str


class ReferenceData(BaseModel):
    employees: List[EmployeeBase]
    articles: List[ArticleBase]
    machine_groups: List[MachineGroupBase]


class PlanItemCreate(BaseModel):
    employee_id: int
    article_id: Optional[int] = None
    machine_group_id: Optional[int] = None
    goal: int = Field(ge=0)
    date: date
    status: models.TaskStatus = models.TaskStatus.PLANNED
    comment: Optional[str] = None


class PlanItemUpdate(BaseModel):
    goal: Optional[int] = Field(default=None, ge=0)
    status: Optional[models.TaskStatus] = None
    quantity_done: Optional[int] = Field(default=None, ge=0)
    comment: Optional[str] = None


class PlanItemResponse(ORMModel):
    id: int
    date: date
    employee: EmployeeBase
    article: Optional[ArticleBase] = None
    machine_group: Optional[MachineGroupBase] = None
    goal: int
    quantity_done: int
    status: models.TaskStatus
    comment: Optional[str] = None


def normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


def repair_mojibake(value: Optional[str]) -> Optional[str]:
    if value is None or "\u00c3" not in value:
        return value

    try:
        return value.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def seed_reference_data():
    if not REFERENCE_DATA_PATH.exists():
        return

    db = SessionLocal()
    try:
        changed = False
        with REFERENCE_DATA_PATH.open(encoding="utf-8") as handle:
            reference_data = json.load(handle)

        if db.query(models.Employee).count() == 0:
            for employee in reference_data["employees"]:
                db.add(
                    models.Employee(
                        id=employee["id"],
                        name=employee["name"],
                        number=employee["number"],
                    )
                )
            changed = True

        if db.query(models.Article).count() == 0:
            for article in reference_data["articles"]:
                db.add(models.Article(id=article["id"], name=article["name"]))
            changed = True

        if db.query(models.MachineGroup).count() == 0:
            for machine_group in reference_data["machine_groups"]:
                db.add(models.MachineGroup(id=machine_group["id"], name=machine_group["name"]))
            changed = True

        for employee in db.query(models.Employee).all():
            repaired_name = repair_mojibake(employee.name)
            if repaired_name != employee.name:
                employee.name = repaired_name
                changed = True

        for article in db.query(models.Article).all():
            repaired_name = repair_mojibake(article.name)
            if repaired_name != article.name:
                article.name = repaired_name
                changed = True

        for machine_group in db.query(models.MachineGroup).all():
            repaired_name = repair_mojibake(machine_group.name)
            if repaired_name != machine_group.name:
                machine_group.name = repaired_name
                changed = True

        if changed:
            db.commit()
    finally:
        db.close()


seed_reference_data()


def validate_plan_item_references(
    db: Session,
    employee_id: int,
    article_id: Optional[int],
    machine_group_id: Optional[int],
):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    machine_group = None
    if machine_group_id is not None:
        machine_group = db.query(models.MachineGroup).filter(
            models.MachineGroup.id == machine_group_id
        ).first()
        if not machine_group:
            raise HTTPException(status_code=404, detail="Machine group not found")

    if article_id is not None:
        article = db.query(models.Article).filter(models.Article.id == article_id).first()
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")

    if machine_group_id is None and article_id is not None:
        raise HTTPException(
            status_code=422,
            detail="Article cannot be set without a machine group.",
        )

    if (
        machine_group is not None
        and machine_group.name not in SPECIAL_MACHINE_GROUP_NAMES
        and article_id is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Article is required for this machine group.",
        )


@app.get("/data", response_model=ReferenceData)
def get_reference_data(db: Session = Depends(get_db)):
    employees = db.query(models.Employee).order_by(models.Employee.name.asc()).all()
    articles = db.query(models.Article).order_by(models.Article.name.asc()).all()
    machine_groups = db.query(models.MachineGroup).order_by(models.MachineGroup.name.asc()).all()
    return {
        "employees": employees,
        "articles": articles,
        "machine_groups": machine_groups,
    }


@app.post("/employees", response_model=EmployeeBase, status_code=201)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    name = employee.name.strip()
    number = employee.number.strip()
    if not name or not number:
        raise HTTPException(status_code=422, detail="Name and number are required.")

    existing_employee = db.query(models.Employee).filter(
        models.Employee.number == number
    ).first()
    if existing_employee:
        raise HTTPException(status_code=409, detail="Employee number already exists.")

    db_employee = models.Employee(name=name, number=number)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == employee_id
    ).delete(synchronize_session=False)
    db.delete(db_employee)
    db.commit()
    return {"ok": True}


@app.get("/plan", response_model=List[PlanItemResponse])
def get_plan(target_date: Optional[date] = None, db: Session = Depends(get_db)):
    if target_date is None:
        target_date = date.today()

    subq = db.query(
        models.PlanItem.employee_id,
        func.max(models.PlanItem.date).label("max_date"),
    ).filter(models.PlanItem.date <= target_date).group_by(models.PlanItem.employee_id).subquery()

    items = db.query(models.PlanItem).join(
        subq,
        and_(
            models.PlanItem.employee_id == subq.c.employee_id,
            models.PlanItem.date == subq.c.max_date,
        ),
    ).order_by(models.PlanItem.id.asc()).all()

    return [item for item in items if item.machine_group_id is not None]


@app.post("/plan", response_model=PlanItemResponse, status_code=201)
def create_plan_item(item: PlanItemCreate, db: Session = Depends(get_db)):
    validate_plan_item_references(db, item.employee_id, item.article_id, item.machine_group_id)
    normalized_comment = normalize_optional_text(item.comment)

    existing_count = db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == item.employee_id,
        models.PlanItem.date == item.date,
        models.PlanItem.machine_group_id.isnot(None),
    ).count()

    if item.machine_group_id is None:
        db.query(models.PlanItem).filter(
            models.PlanItem.employee_id == item.employee_id,
            models.PlanItem.date == item.date,
        ).delete(synchronize_session=False)

        db_item = models.PlanItem(
            employee_id=item.employee_id,
            article_id=None,
            machine_group_id=None,
            goal=0,
            date=item.date,
            status=item.status.value,
            comment=normalized_comment,
        )
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    if existing_count >= 4:
        raise HTTPException(status_code=400, detail="Max 4 jobs per day allowed.")

    db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == item.employee_id,
        models.PlanItem.date == item.date,
        models.PlanItem.machine_group_id.is_(None),
    ).delete(synchronize_session=False)

    db_item = models.PlanItem(
        employee_id=item.employee_id,
        article_id=item.article_id,
        machine_group_id=item.machine_group_id,
        goal=item.goal,
        date=item.date,
        status=item.status.value,
        comment=normalized_comment,
    )
    db.add(db_item)

    if item.article_id is not None and item.machine_group_id is not None:
        default_goal = db.query(models.DefaultGoal).filter(
            models.DefaultGoal.article_id == item.article_id,
            models.DefaultGoal.machine_group_id == item.machine_group_id,
        ).first()
        if default_goal:
            default_goal.goal = item.goal
        else:
            db.add(
                models.DefaultGoal(
                    article_id=item.article_id,
                    machine_group_id=item.machine_group_id,
                    goal=item.goal,
                )
            )

    db.commit()
    db.refresh(db_item)
    return db_item


@app.put("/plan/{item_id}", response_model=PlanItemResponse)
def update_plan_item(item_id: int, item: PlanItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(models.PlanItem).filter(models.PlanItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    update_data = item.model_dump(exclude_unset=True)
    if "goal" in update_data and update_data["goal"] is None:
        raise HTTPException(status_code=422, detail="Goal cannot be null.")
    if "quantity_done" in update_data and update_data["quantity_done"] is None:
        raise HTTPException(status_code=422, detail="Quantity done cannot be null.")
    if "status" in update_data and update_data["status"] is None:
        raise HTTPException(status_code=422, detail="Status cannot be null.")

    if "comment" in update_data:
        update_data["comment"] = normalize_optional_text(update_data["comment"])
    if "status" in update_data:
        update_data["status"] = update_data["status"].value

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


@app.delete("/plan/{item_id}")
def delete_plan_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.PlanItem).filter(models.PlanItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    db.delete(db_item)
    db.commit()
    return {"ok": True}


@app.get("/default-goal")
def get_default_goal(article_id: int, machine_group_id: int, db: Session = Depends(get_db)):
    default_goal = db.query(models.DefaultGoal).filter(
        models.DefaultGoal.article_id == article_id,
        models.DefaultGoal.machine_group_id == machine_group_id,
    ).first()
    if default_goal:
        return {"goal": default_goal.goal}
    return {"goal": 0}


def resolve_frontend_file(relative_path: str):
    candidate = (FRONTEND_DIST_DIR / relative_path).resolve()
    try:
        candidate.relative_to(FRONTEND_DIST_DIR)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


if FRONTEND_DIST_DIR.exists():
    @app.get("/", include_in_schema=False)
    def serve_frontend_index():
        return FileResponse(FRONTEND_DIST_DIR / "index.html")


    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        dist_file = resolve_frontend_file(full_path)
        if dist_file is not None:
            return FileResponse(dist_file)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
