from sqlalchemy import Column, String, Boolean, Numeric, DateTime, func
from database import Base

class Employee(Base):
    __tablename__ = "employees"

    uid = Column(String(128), primary_key=True, index=True)
    worker_id = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    phone = Column(String(30), nullable=True)
    address = Column(String(500), nullable=True)
    daily_rate = Column(Numeric(10, 2), default=0.00)
    joining_date = Column(DateTime(timezone=True), server_default=func.now())
    
    # Bank details
    bank_name = Column(String(100), nullable=True)
    account_number = Column(String(100), nullable=True)
    account_holder = Column(String(100), nullable=True)
    
    # Emergency contact
    emergency_contact = Column(String(100), nullable=True)
    emergency_phone = Column(String(30), nullable=True)

    # Transport settings
    transport_type = Column(String(50), default="none")
    pickup_location = Column(String(100), nullable=True)
    drop_location = Column(String(100), nullable=True)
    distance = Column(Numeric(5, 2), default=0.00)
    transport_rate = Column(Numeric(10, 2), default=0.00)
    transport_rate_type = Column(String(50), default="per_day")
