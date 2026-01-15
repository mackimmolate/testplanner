from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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
    article_id: int
    machine_group_id: int
    goal: int
    date: date
    status: models.TaskStatus = models.TaskStatus.PLANNED

class PlanItemUpdate(BaseModel):
    employee_id: Optional[int] = None
    article_id: Optional[int] = None
    machine_group_id: Optional[int] = None
    goal: Optional[int] = None
    status: Optional[models.TaskStatus] = None
    quantity_done: Optional[int] = None

class PlanItemResponse(BaseModel):
    id: int
    date: date
    employee: EmployeeBase
    article: ArticleBase
    machine_group: MachineGroupBase
    goal: int
    quantity_done: int
    status: models.TaskStatus

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

    plan_items = db.query(models.PlanItem).filter(models.PlanItem.date == target_date).all()
    return plan_items

@app.post("/plan", response_model=PlanItemResponse)
def create_plan_item(item: PlanItemCreate, db: Session = Depends(get_db)):
    # Check if exists? Maybe allow duplicates for different times, but simpler to just add.
    db_item = models.PlanItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Save default goal
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
