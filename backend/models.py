from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import enum

class TaskStatus(str, enum.Enum):
    ACTIVE = "active"
    PLANNED = "planned"
    DONE = "done"

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, unique=True, index=True)
    name = Column(String)

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class MachineGroup(Base):
    __tablename__ = "machine_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class PlanItem(Base):
    __tablename__ = "plan_items"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)

    employee_id = Column(Integer, ForeignKey("employees.id"))
    article_id = Column(Integer, ForeignKey("articles.id"))
    machine_group_id = Column(Integer, ForeignKey("machine_groups.id"))

    goal = Column(Integer, default=0)
    quantity_done = Column(Integer, default=0)
    status = Column(String, default=TaskStatus.PLANNED)

    employee = relationship("Employee")
    article = relationship("Article")
    machine_group = relationship("MachineGroup")

class DefaultGoal(Base):
    __tablename__ = "default_goals"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(Integer, ForeignKey("articles.id"))
    machine_group_id = Column(Integer, ForeignKey("machine_groups.id"))
    goal = Column(Integer)
