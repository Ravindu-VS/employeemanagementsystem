from sqlalchemy import Column, String, Boolean, Numeric, Date, Integer, ForeignKey, DateTime, func
from database import Base

class Site(Base):
    __tablename__ = "sites"

    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    client = Column(String(100), nullable=False)
    status = Column(String(50), default="active") # active, inactive, completed, archived
    geofence_lat = Column(Numeric(9, 6), nullable=True)
    geofence_lng = Column(Numeric(9, 6), nullable=True)
    geofence_radius = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(String(128), nullable=False, index=True)
    site_id = Column(String(100), ForeignKey("sites.id"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    present = Column(Boolean, default=True)
    
    # Split Shift & OT fields for Drivers / Laborers
    morning_present = Column(Boolean, default=True)
    evening_present = Column(Boolean, default=True)
    ot_hours = Column(Numeric(4, 2), default=0.00)
    morning_ot_hours = Column(Numeric(4, 2), default=0.00)
    evening_ot_hours = Column(Numeric(4, 2), default=0.00)
    
    verified = Column(Boolean, default=False)
