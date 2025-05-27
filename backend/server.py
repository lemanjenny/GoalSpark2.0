from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"

class GoalStatus(str, Enum):
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    OFF_TRACK = "off_track"

class GoalCycle(str, Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"

class GoalType(str, Enum):
    TARGET = "target"
    PERCENTAGE = "percentage"
    REVENUE = "revenue"
    CUSTOM = "custom"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    first_name: str
    last_name: str
    role: UserRole
    job_title: str
    manager_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    job_title: str
    manager_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    job_title: str
    manager_id: Optional[str] = None
    created_at: datetime

class Goal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    goal_type: GoalType
    target_value: float
    current_value: float = 0.0
    unit: str  # e.g., "calls", "$", "%", "units"
    assigned_to: List[str]  # user IDs
    assigned_by: str  # admin user ID
    cycle_type: GoalCycle
    start_date: datetime
    end_date: datetime
    status: GoalStatus = GoalStatus.ON_TRACK
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class GoalCreate(BaseModel):
    title: str
    description: str
    goal_type: GoalType
    target_value: float
    unit: str
    assigned_to: List[str]
    cycle_type: GoalCycle
    start_date: datetime
    end_date: datetime

class GoalUpdate(BaseModel):
    current_value: Optional[float] = None
    status: Optional[GoalStatus] = None

class ProgressUpdate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    goal_id: str
    user_id: str
    previous_value: float
    new_value: float
    status: GoalStatus
    comment: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ProgressUpdateCreate(BaseModel):
    goal_id: str
    new_value: float
    status: GoalStatus
    comment: Optional[str] = None

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Root route for testing
@api_router.get("/")
async def root():
    return {"message": "Goal Tracker API is running!"}

# Authentication routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Determine role based on manager_id
    role = UserRole.EMPLOYEE if user_data.manager_id else UserRole.ADMIN
    
    # Validate manager exists if provided
    if user_data.manager_id:
        manager = await db.users.find_one({"id": user_data.manager_id, "role": UserRole.ADMIN})
        if not manager:
            raise HTTPException(status_code=400, detail="Invalid manager selected")
    
    # Create user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=role,
        job_title=user_data.job_title,
        manager_id=user_data.manager_id
    )
    
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user.dict())
    }

@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user)
    }

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**current_user.dict())

@api_router.get("/managers")
async def get_managers():
    """Get list of managers for employee registration"""
    managers = await db.users.find({"role": UserRole.ADMIN, "is_active": True}).to_list(100)
    return [{"id": m["id"], "first_name": m["first_name"], "last_name": m["last_name"], "job_title": m["job_title"]} for m in managers]

# Goal management routes
@api_router.post("/goals", response_model=Goal)
async def create_goal(goal_data: GoalCreate, admin_user: User = Depends(get_admin_user)):
    goal = Goal(
        **goal_data.dict(),
        assigned_by=admin_user.id
    )
    
    # Validate assigned users exist
    for user_id in goal.assigned_to:
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=400, detail=f"User {user_id} not found")
    
    await db.goals.insert_one(goal.dict())
    return goal

@api_router.get("/goals", response_model=List[Goal])
async def get_goals(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        # Admins see all goals for their team
        team_members = await db.users.find({"manager_id": current_user.id}).to_list(100)
        team_member_ids = [member["id"] for member in team_members] + [current_user.id]
        goals = await db.goals.find({"assigned_to": {"$in": team_member_ids}, "is_active": True}).to_list(100)
    else:
        # Employees see only their goals
        goals = await db.goals.find({"assigned_to": current_user.id, "is_active": True}).to_list(100)
    
    return [Goal(**goal) for goal in goals]

@api_router.get("/goals/{goal_id}", response_model=Goal)
async def get_goal(goal_id: str, current_user: User = Depends(get_current_user)):
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check access permissions
    if current_user.role == UserRole.EMPLOYEE and current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return Goal(**goal)

@api_router.post("/goals/{goal_id}/progress")
async def update_progress(goal_id: str, update_data: ProgressUpdateCreate, current_user: User = Depends(get_current_user)):
    # Get goal and verify access
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create progress update record
    progress_update = ProgressUpdate(
        goal_id=goal_id,
        user_id=current_user.id,
        previous_value=goal["current_value"],
        new_value=update_data.new_value,
        status=update_data.status,
        comment=update_data.comment
    )
    
    await db.progress_updates.insert_one(progress_update.dict())
    
    # Update goal with new values
    await db.goals.update_one(
        {"id": goal_id},
        {"$set": {
            "current_value": update_data.new_value,
            "status": update_data.status
        }}
    )
    
    return {"message": "Progress updated successfully"}

@api_router.get("/goals/{goal_id}/progress")
async def get_goal_progress(goal_id: str, current_user: User = Depends(get_current_user)):
    # Verify goal access
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    if current_user.role == UserRole.EMPLOYEE and current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    progress_updates = await db.progress_updates.find({"goal_id": goal_id}).sort("timestamp", -1).to_list(100)
    
    # Convert to ProgressUpdate models to ensure proper serialization
    return [ProgressUpdate(**update) for update in progress_updates]

@api_router.get("/users/team")
async def get_team_members(admin_user: User = Depends(get_admin_user)):
    """Get team members for goal assignment"""
    team_members = await db.users.find({"manager_id": admin_user.id, "is_active": True}).to_list(100)
    return [UserResponse(**member) for member in team_members]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
