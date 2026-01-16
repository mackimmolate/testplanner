from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import SessionLocal, engine, Base
import models
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Schemas
class EmployeeBase(BaseModel):
    id: int
    number: str
    name: str

class ArticleBase(BaseModel):
    id: int
    name: str

class MachineGroupBase(BaseModel):
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
    goal: int
    date: date
    status: models.TaskStatus = models.TaskStatus.PLANNED
    comment: Optional[str] = None

class PlanItemUpdate(BaseModel):
    employee_id: Optional[int] = None
    article_id: Optional[int] = None
    machine_group_id: Optional[int] = None
    goal: Optional[int] = None
    status: Optional[models.TaskStatus] = None
    quantity_done: Optional[int] = None
    comment: Optional[str] = None

class PlanItemResponse(BaseModel):
    id: int
    date: date
    employee: EmployeeBase
    article: Optional[ArticleBase] = None
    machine_group: Optional[MachineGroupBase] = None
    goal: int
    quantity_done: int
    status: models.TaskStatus
    comment: Optional[str] = None

    class Config:
        orm_mode = True

# Endpoints

@app.get("/data", response_model=ReferenceData)
def get_reference_data(db: Session = Depends(get_db)):
    employees = db.query(models.Employee).all()
    articles = db.query(models.Article).all()
    machine_groups = db.query(models.MachineGroup).all()
    return {
        "employees": employees,
        "articles": articles,
        "machine_groups": machine_groups
    }

@app.get("/plan", response_model=List[PlanItemResponse])
def get_plan(target_date: Optional[date] = None, db: Session = Depends(get_db)):
    if target_date is None:
        target_date = date.today()

    # Logic: Get the latest plan item for each employee where date <= target_date

    # Subquery to find the latest date per employee
    subq = db.query(
        models.PlanItem.employee_id,
        func.max(models.PlanItem.date).label("max_date")
    ).filter(models.PlanItem.date <= target_date).group_by(models.PlanItem.employee_id).subquery()

    # Join to get the actual items
    q = db.query(models.PlanItem).join(
        subq,
        and_(
            models.PlanItem.employee_id == subq.c.employee_id,
            models.PlanItem.date == subq.c.max_date
        )
    )

    items = q.all()

    # Filter out items where machine_group_id is None (effectively "cleared" or "void")
    active_items = [i for i in items if i.machine_group_id is not None]

    return active_items

@app.post("/plan", response_model=PlanItemResponse)
def create_plan_item(item: PlanItemCreate, db: Session = Depends(get_db)):
    # If adding a new item for a date, we should probably check if one already exists for this employee on this date
    # and update it or delete it to avoid clutter, but appending is fine if we sort by ID desc in "latest" logic
    # (but our "latest" logic uses max(date), so multiple items on SAME date is ambiguous).
    # Ideally we should remove existing item for this employee on this date.

    existing_item = db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == item.employee_id,
        models.PlanItem.date == item.date
    ).first()

    if existing_item:
        db.delete(existing_item)
        db.commit()

    db_item = models.PlanItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Save default goal (only if article/group provided)
    if item.article_id and item.machine_group_id:
        default_goal = db.query(models.DefaultGoal).filter(
            models.DefaultGoal.article_id == item.article_id,
            models.DefaultGoal.machine_group_id == item.machine_group_id
        ).first()

        if default_goal:
            default_goal.goal = item.goal
        else:
            db.add(models.DefaultGoal(
                article_id=item.article_id,
                machine_group_id=item.machine_group_id,
                goal=item.goal
            ))
        db.commit()

    return db_item

@app.put("/plan/{item_id}", response_model=PlanItemResponse)
def update_plan_item(item_id: int, item: PlanItemUpdate, db: Session = Depends(get_db)):
    db_item = db.query(models.PlanItem).filter(models.PlanItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Plan item not found")

    update_data = item.dict(exclude_unset=True)
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
        models.DefaultGoal.machine_group_id == machine_group_id
    ).first()
    if default_goal:
        return {"goal": default_goal.goal}
    return {"goal": 0}
