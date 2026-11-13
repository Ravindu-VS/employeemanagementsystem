from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

import models
from database import engine, get_db

# Create database tables if they do not exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="KK & SONS Employee Service", version="1.0.0")

# --- Pydantic Schemas for Request/Response validation ---

class EmployeeBase(BaseModel):
    display_name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    daily_rate: float = 0.0
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    transport_type: str = "none"
    pickup_location: Optional[str] = None
    drop_location: Optional[str] = None
    distance: float = 0.0
    transport_rate: float = 0.0
    transport_rate_type: str = "per_day"

class EmployeeCreate(EmployeeBase):
    uid: str
    worker_id: str

class EmployeeUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    daily_rate: Optional[float] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    transport_type: Optional[str] = None
    pickup_location: Optional[str] = None
    drop_location: Optional[str] = None
    distance: Optional[float] = None
    transport_rate: Optional[float] = None
    transport_rate_type: Optional[str] = None

class EmployeeOut(EmployeeBase):
    uid: str
    worker_id: str
    is_active: bool
    joining_date: datetime

    class Config:
        orm_mode = True

# --- API Path Operations ---

@app.get("/employees", response_model=List[EmployeeOut])
def get_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@app.get("/employees/{uid}", response_model=EmployeeOut)
def get_employee(uid: str, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.uid == uid).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Employee profile not found"
        )
    return employee

@app.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.uid == employee.uid).first()
    if db_employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Employee with this UID already exists"
        )
    
    new_employee = models.Employee(
        uid=employee.uid,
        worker_id=employee.worker_id,
        display_name=employee.display_name,
        email=employee.email,
        role=employee.role,
        phone=employee.phone,
        address=employee.address,
        daily_rate=employee.daily_rate,
        bank_name=employee.bank_name,
        account_number=employee.account_number,
        account_holder=employee.account_holder,
        emergency_contact=employee.emergency_contact,
        emergency_phone=employee.emergency_phone,
        transport_type=employee.transport_type,
        pickup_location=employee.pickup_location,
        drop_location=employee.drop_location,
        distance=employee.distance,
        transport_rate=employee.transport_rate,
        transport_rate_type=employee.transport_rate_type
    )
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    return new_employee

@app.put("/employees/{uid}", response_model=EmployeeOut)
def update_employee(uid: str, employee_update: EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.uid == uid).first()
    if not db_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Employee not found"
        )
    
    update_data = employee_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_employee, key, value)
        
    db.commit()
    db.refresh(db_employee)
    return db_employee

@app.post("/employees/{uid}/deactivate", response_model=EmployeeOut)
def deactivate_employee(uid: str, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.uid == uid).first()
    if not db_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Employee not found"
        )
    db_employee.is_active = False
    db.commit()
    db.refresh(db_employee)
    return db_employee

@app.post("/employees/{uid}/reactivate", response_model=EmployeeOut)
def reactivate_employee(uid: str, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.uid == uid).first()
    if not db_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Employee not found"
        )
    db_employee.is_active = True
    db.commit()
    db.refresh(db_employee)
    return db_employee

@app.delete("/employees/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(uid: str, db: Session = Depends(get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.uid == uid).first()
    if not db_employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Employee not found"
        )
    db.delete(db_employee)
    db.commit()
    return None
