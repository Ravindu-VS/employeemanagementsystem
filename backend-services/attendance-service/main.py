from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="KK & SONS Attendance Service", version="1.0.0")

# --- Pydantic Schemas ---

class SiteBase(BaseModel):
    id: str
    name: str
    client: str
    status: str = "active"
    geofence_lat: Optional[float] = None
    geofence_lng: Optional[float] = None
    geofence_radius: Optional[float] = None

class SiteCreate(SiteBase):
    pass

class SiteOut(SiteBase):
    created_at: datetime
    class Config:
        orm_mode = True

class AttendanceBase(BaseModel):
    worker_id: str
    site_id: Optional[str] = None
    date: date
    present: bool = True
    morning_present: bool = True
    evening_present: bool = True
    ot_hours: float = 0.0
    morning_ot_hours: float = 0.0
    evening_ot_hours: float = 0.0
    verified: bool = False

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceOut(AttendanceBase):
    id: int
    class Config:
        orm_mode = True

# --- API Path Operations ---

@app.get("/sites", response_model=List[SiteOut])
def get_sites(db: Session = Depends(get_db)):
    return db.query(models.Site).all()

@app.post("/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(site: SiteCreate, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site.id).first()
    if db_site:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Site with this ID already exists"
        )
    new_site = models.Site(
        id=site.id,
        name=site.name,
        client=site.client,
        status=site.status,
        geofence_lat=site.geofence_lat,
        geofence_lng=site.geofence_lng,
        geofence_radius=site.geofence_radius
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    return new_site

@app.put("/sites/{site_id}", response_model=SiteOut)
def update_site(site_id: str, site_update: SiteCreate, db: Session = Depends(get_db)):
    db_site = db.query(models.Site).filter(models.Site.id == site_id).first()
    if not db_site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Site not found"
        )
    for key, value in site_update.dict().items():
        setattr(db_site, key, value)
    db.commit()
    db.refresh(db_site)
    return db_site

@app.post("/attendance", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def record_attendance(attendance: AttendanceCreate, db: Session = Depends(get_db)):
    # Verify site status is not completed/inactive before posting attendance
    if attendance.site_id:
        site = db.query(models.Site).filter(models.Site.id == attendance.site_id).first()
        if site and site.status in ["completed", "inactive"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record attendance on a {site.status} site."
            )
            
    # Check duplicate attendance for date and worker
    db_att = db.query(models.Attendance).filter(
        models.Attendance.worker_id == attendance.worker_id,
        models.Attendance.date == attendance.date
    ).first()
    
    if db_att:
        # Update existing record
        for key, value in attendance.dict().items():
            setattr(db_att, key, value)
        db.commit()
        db.refresh(db_att)
        return db_att
        
    new_att = models.Attendance(
        worker_id=attendance.worker_id,
        site_id=attendance.site_id,
        date=attendance.date,
        present=attendance.present,
        morning_present=attendance.morning_present,
        evening_present=attendance.evening_present,
        ot_hours=attendance.ot_hours,
        morning_ot_hours=attendance.morning_ot_hours,
        evening_ot_hours=attendance.evening_ot_hours,
        verified=attendance.verified
    )
    db.add(new_att)
    db.commit()
    db.refresh(new_att)
    return new_att

@app.get("/attendance", response_model=List[AttendanceOut])
def get_attendance(date: Optional[date] = None, db: Session = Depends(get_db)):
    query = db.query(models.Attendance)
    if date:
        query = query.filter(models.Attendance.date == date)
    return query.all()

@app.get("/attendance/worker/{worker_id}", response_model=List[AttendanceOut])
def get_worker_attendance(worker_id: str, db: Session = Depends(get_db)):
    return db.query(models.Attendance).filter(models.Attendance.worker_id == worker_id).all()
