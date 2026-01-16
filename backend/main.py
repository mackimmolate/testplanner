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
    # Support multiple jobs per day (max 4)
    # Check count of existing items for this employee on this date
    existing_count = db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == item.employee_id,
        models.PlanItem.date == item.date,
        models.PlanItem.machine_group_id.isnot(None) # Don't count "void" items if any
    ).count()

    # If the user is trying to "clear" (machine_group_id is None), we should probably clear ALL tasks for that day?
    # Or just add a void record? The logic for "clearing" in AdminPage sends machine_group_id=null.
    # If we add a void record, the `get_plan` logic filters out items where machine_group_id is None.
    # But wait, `get_plan` returns ALL items for the max_date.
    # If we have 3 active items and add 1 void item on the same date, `get_plan` will return 4 items (3 active, 1 void).
    # The frontend filters out void items? `active_items = [i for i in items if i.machine_group_id is not None]` in backend.
    # So if we add a void item, it won't show up, but the OLD active items on the same date WILL show up.
    # So "Clearing" needs to DELETE existing items on that date if we want to wipe the slate.

    if item.machine_group_id is None:
        # Clearing tasks for this day
        db.query(models.PlanItem).filter(
            models.PlanItem.employee_id == item.employee_id,
            models.PlanItem.date == item.date
        ).delete()
        db.commit()

        # Add the void item to establish history/stop carry-over?
        # Actually, if we delete all items on this date, `get_plan` will look for previous date.
        # We NEED a void item on this date to stop carry over from yesterday.
        db_item = models.PlanItem(**item.dict())
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    # If NOT clearing, check max limit
    if existing_count >= 4:
        raise HTTPException(status_code=400, detail="Max 4 jobs per day allowed.")

    # Also, if there was a "void" item on this date (machine_group_id is None), we should remove it so it doesn't block carry-over logic or clutter?
    # Actually, if we add a real task, that becomes the latest activity.
    # But `get_plan` fetches ALL items on max_date.
    # If we have 1 void item and add 1 real item, we return both. The void is filtered out. The real one is shown. Correct.

    # However, if we previously "Cleared" the day, we might have a void item.
    # We should probably delete any void items for this day before adding a real one, to keep it clean.
    db.query(models.PlanItem).filter(
        models.PlanItem.employee_id == item.employee_id,
        models.PlanItem.date == item.date,
        models.PlanItem.machine_group_id.is_(None)
    ).delete()

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
