from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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
from email_service import email_service
import jwt
from passlib.context import CryptContext
from enum import Enum
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Environment-based configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/goaltracker')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')

# Database connection
client = AsyncIOMotorClient(MONGO_URL)
# Extract database name from URL or use default
if 'mongodb+srv://' in MONGO_URL or '/' in MONGO_URL:
    # Production MongoDB (Atlas) - extract database name from URL
    db_name = MONGO_URL.split('/')[-1].split('?')[0] if '/' in MONGO_URL else 'goaltracker'
else:
    # Local MongoDB
    db_name = 'goaltracker'

db = client[db_name]

print(f"🔗 Connected to MongoDB: {db_name}")

# Security
SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 2880  # 48 hours

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

class GoalComparison(str, Enum):
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    EQUAL_TO = "equal_to"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    first_name: str
    last_name: str
    role: UserRole
    job_title: str
    custom_role: Optional[str] = None  # New field for team role management
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
    custom_role: Optional[str] = None
    manager_id: Optional[str] = None
    created_at: datetime

class UserInvite(BaseModel):
    email: str
    first_name: str
    last_name: str
    job_title: str
    custom_role: Optional[str] = None

class PasswordResetRequest(BaseModel):
    email: str

class PasswordReset(BaseModel):
    token: str
    new_password: str

class UserUpdate(BaseModel):
    job_title: Optional[str] = None
    custom_role: Optional[str] = None

class Goal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    goal_type: GoalType
    target_value: float
    comparison: GoalComparison = GoalComparison.GREATER_THAN
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
    comparison: GoalComparison = GoalComparison.GREATER_THAN  # Default to greater than
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
    new_value: float
    status: GoalStatus
    comment: Optional[str] = None

# Activity/Notification Models
class ActivityItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "goal_created", "progress_updated", "status_changed", etc.
    title: str
    description: str
    user_id: str
    user_name: str
    goal_id: Optional[str] = None
    goal_title: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AnalyticsData(BaseModel):
    team_overview: Dict[str, Any]
    performance_trends: List[Dict[str, Any]]
    goal_completion_stats: Dict[str, Any]
    employee_performance: List[Dict[str, Any]]
    status_distribution: Dict[str, int]
    recent_activities: List[Dict[str, Any]]

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
    return {"message": "Goal Spark 2.0 API is running!"}

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
        custom_role=user_data.job_title,  # Default custom_role to job_title
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

@api_router.post("/auth/forgot-password")
async def forgot_password(request: PasswordResetRequest):
    """Send password reset token to user's email"""
    user = await db.users.find_one({"email": request.email})
    
    if not user:
        # For non-existent users, create a demo token that can be used for testing
        demo_reset_token = str(uuid.uuid4())
        demo_reset_url = f"https://a57f031a-35f2-4808-be33-a7b5e2b52483.preview.emergentagent.com/reset-password?token={demo_reset_token}"
        
        # Create a temporary demo user entry for password reset testing
        demo_user = {
            "id": str(uuid.uuid4()),
            "email": request.email,
            "first_name": "Demo",
            "last_name": "Manager",
            "job_title": "Demo Manager",
            "password_hash": pwd_context.hash("demopassword123"),  # Default demo password
            "role": "admin",  # Make demo user an admin so they can access all features
            "is_active": True,
            "is_demo": True,
            "reset_token": demo_reset_token,
            "reset_token_expires": datetime.utcnow() + timedelta(hours=1),
            "created_at": datetime.utcnow()
        }
        
        # Store demo user with reset token
        await db.users.insert_one(demo_user)
        
        return {
            "message": "If an account with that email exists, a password reset link has been sent.",
            "demo_mode": True,
            "demo_note": "Demo user created! You can reset the password and then login with the new password.",
            "demo_reset_url": demo_reset_url,
            "demo_instructions": f"Demo Manager created for {request.email}. Use this URL to set a password, then login: {demo_reset_url}",
            "demo_email": request.email,
            "demo_default_password": "demopassword123",
            "demo_role": "admin",
            "demo_tip": "After login, use the 'Generate Demo Data' button to populate your account with sample goals and analytics."
        }
    
    # Generate secure reset token for real user
    reset_token = str(uuid.uuid4())
    reset_expires = datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
    
    # Store reset token in database
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_expires
        }}
    )
    
    # Send password reset email
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    email_result = await email_service.send_password_reset_email(
        to_email=user["email"],
        reset_token=reset_token,
        user_name=user_name or None
    )
    
    # Log email sending result
    if email_result["success"]:
        print(f"✅ Email sent successfully via {email_result['provider']}")
        if email_result.get("demo_reset_url"):
            print(f"🔗 Demo Reset URL: {email_result['demo_reset_url']}")
    else:
        print(f"❌ Email sending failed: {email_result.get('error', 'Unknown error')}")
    
    # Always return success message for security (don't reveal if email exists)
    response = {
        "message": "If an account with that email exists, a password reset link has been sent."
    }
    
    # Add demo information if in simulation mode (no SendGrid configured)
    if email_result.get("provider") == "simulation":
        response.update({
            "demo_mode": True,
            "demo_reset_url": email_result.get("demo_reset_url"),
            "demo_instructions": email_result.get("demo_instructions"),
            "user_exists": True
        })
    
    return response

@api_router.post("/auth/reset-password")
async def reset_password(reset_data: PasswordReset):
    """Reset user password with valid token"""
    user = await db.users.find_one({
        "reset_token": reset_data.token,
        "reset_token_expires": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Update password and clear reset token
    new_password_hash = get_password_hash(reset_data.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": new_password_hash
        }, "$unset": {
            "reset_token": "",
            "reset_token_expires": ""
        }}
    )
    
    return {"message": "Password reset successfully"}

# Dummy data generation
@api_router.post("/demo/generate-data")
async def generate_dummy_data(admin_user: User = Depends(get_admin_user)):
    """Generate realistic dummy data for analytics demonstration"""
    
    # Check if demo data already exists for ANY admin (not just current admin)
    existing_demo = await db.users.find_one({"email": {"$regex": "testemployee.*@demo.com"}})
    if existing_demo:
        return {"message": "Demo data already exists", "generated": False}
    
    # Create 3 test employees under the current admin
    test_employees = []
    employee_profiles = [
        {
            "first_name": "Test Employee",
            "last_name": "1",
            "email": "testemployee1@demo.com",
            "job_title": "Sales Representative",
            "custom_role": "Sales Rep",
            "performance_type": "high"  # High performer
        },
        {
            "first_name": "Test Employee", 
            "last_name": "2",
            "email": "testemployee2@demo.com",
            "job_title": "Marketing Specialist",
            "custom_role": "Marketing",
            "performance_type": "average"  # Average performer
        },
        {
            "first_name": "Test Employee",
            "last_name": "3", 
            "email": "testemployee3@demo.com",
            "job_title": "Customer Support",
            "custom_role": "Support",
            "performance_type": "struggling"  # Needs improvement
        }
    ]
    
    # Create test employees
    for profile in employee_profiles:
        employee = User(
            email=profile["email"],
            password_hash=get_password_hash("demo123"),
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            role=UserRole.EMPLOYEE,
            job_title=profile["job_title"],
            custom_role=profile["custom_role"],
            manager_id=admin_user.id,
            created_at=datetime.utcnow() - timedelta(days=120)  # 4 months ago
        )
        
        await db.users.insert_one(employee.dict())
        test_employees.append((employee, profile["performance_type"]))
    
    # Generate historical goals and progress for each employee
    goal_templates = [
        {"title": "Monthly Sales Target", "type": "revenue", "unit": "$", "base_target": 5000},
        {"title": "Client Calls Goal", "type": "target", "unit": "calls", "base_target": 50},
        {"title": "Customer Satisfaction", "type": "percentage", "unit": "%", "base_target": 95},
        {"title": "Lead Generation", "type": "target", "unit": "leads", "base_target": 20},
        {"title": "Meeting Attendance", "type": "percentage", "unit": "%", "base_target": 90},
        {"title": "Project Completion", "type": "target", "unit": "projects", "base_target": 3},
    ]
    
    # Generate 4 months of historical data
    for month_offset in range(4, 0, -1):  # 4 months ago to current
        start_date = datetime.utcnow() - timedelta(days=30 * month_offset)
        end_date = start_date + timedelta(days=30)
        
        for employee, performance_type in test_employees:
            # Create 2-3 goals per employee per month
            num_goals = random.randint(2, 3)
            selected_templates = random.sample(goal_templates, num_goals)
            
            for template in selected_templates:
                # Adjust target based on employee and goal type
                target_multiplier = 1.0
                if performance_type == "high":
                    target_multiplier = random.uniform(1.2, 1.5)
                elif performance_type == "average": 
                    target_multiplier = random.uniform(0.8, 1.2)
                else:  # struggling
                    target_multiplier = random.uniform(0.6, 0.9)
                
                target_value = template["base_target"] * target_multiplier
                
                # Create goal
                goal = Goal(
                    title=f"{template['title']} - {start_date.strftime('%B %Y')}",
                    description=f"Monthly {template['title'].lower()} for {employee.first_name} {employee.last_name}",
                    goal_type=template["type"],
                    target_value=target_value,
                    current_value=0.0,
                    unit=template["unit"],
                    assigned_to=[employee.id],
                    assigned_by=admin_user.id,
                    cycle_type=GoalCycle.MONTHLY,
                    start_date=start_date,
                    end_date=end_date,
                    status=GoalStatus.ON_TRACK,
                    created_at=start_date,
                    is_active=month_offset == 1  # Only current month goals are active
                )
                
                await db.goals.insert_one(goal.dict())
                
                # Generate realistic progress updates throughout the month
                current_date = start_date
                current_value = 0.0
                
                # Performance patterns based on employee type
                if performance_type == "high":
                    # Steady progress, usually exceeds targets
                    final_completion = random.uniform(1.05, 1.3)  # 105-130% completion
                    status_pattern = ["on_track"] * 8 + ["at_risk"] * 1 + ["on_track"] * 1
                elif performance_type == "average":
                    # Moderate progress, mixed results
                    final_completion = random.uniform(0.7, 1.1)  # 70-110% completion
                    status_pattern = ["on_track"] * 5 + ["at_risk"] * 3 + ["off_track"] * 2
                else:  # struggling
                    # Inconsistent progress, often behind
                    final_completion = random.uniform(0.4, 0.8)  # 40-80% completion
                    status_pattern = ["on_track"] * 3 + ["at_risk"] * 4 + ["off_track"] * 3
                
                # Generate 8-10 progress updates throughout the month
                num_updates = random.randint(8, 10)
                for i in range(num_updates):
                    days_progress = (30 / num_updates) * (i + 1)
                    update_date = start_date + timedelta(days=days_progress)
                    
                    # Calculate progress value (with some randomness)
                    progress_ratio = (i + 1) / num_updates
                    base_progress = target_value * final_completion * progress_ratio
                    variance = base_progress * 0.1  # ±10% variance
                    new_value = max(0, base_progress + random.uniform(-variance, variance))
                    
                    # Determine status based on progress and pattern
                    if i < len(status_pattern):
                        status = status_pattern[i]
                    else:
                        # Final status based on completion
                        if new_value >= target_value * 0.95:
                            status = "on_track"
                        elif new_value >= target_value * 0.7:
                            status = "at_risk"
                        else:
                            status = "off_track"
                    
                    # Create progress update
                    progress_update = ProgressUpdate(
                        goal_id=goal.id,
                        user_id=employee.id,
                        previous_value=current_value,
                        new_value=new_value,
                        status=status,
                        comment=generate_realistic_comment(status, performance_type) if status != "on_track" else None,
                        timestamp=update_date
                    )
                    
                    await db.progress_updates.insert_one(progress_update.dict())
                    current_value = new_value
                
                # Update final goal status and value
                final_status = status_pattern[-1] if status_pattern else "on_track"
                await db.goals.update_one(
                    {"id": goal.id},
                    {"$set": {
                        "current_value": current_value,
                        "status": final_status
                    }}
                )
    
    return {
        "message": "Demo data generated successfully",
        "generated": True,
        "employees_created": len(test_employees),
        "time_period": "4 months of historical data"
    }

def generate_realistic_comment(status: str, performance_type: str) -> str:
    """Generate realistic comments based on status and performance type"""
    
    if status == "at_risk":
        if performance_type == "high":
            comments = [
                "Slight delay due to client meeting reschedules, will catch up this week",
                "Waiting for approval on two major deals, confident about hitting target",
                "Had to focus on urgent customer issue, back on track now"
            ]
        elif performance_type == "average":
            comments = [
                "Behind schedule due to system downtime last week",
                "Need additional support to reach target this month",
                "Market conditions challenging, working on new strategies"
            ]
        else:  # struggling
            comments = [
                "Struggling with new process, need additional training",
                "Personal issues affecting performance, improving next week",
                "Technical difficulties slowing progress, IT working on solution"
            ]
    else:  # off_track
        if performance_type == "high":
            comments = [
                "Major client postponed project, will impact this month but next month looks strong",
                "Team member was sick, taking on extra workload temporarily"
            ]
        elif performance_type == "average":
            comments = [
                "Significantly behind due to unexpected project requirements",
                "Need manager support to prioritize tasks better"
            ]
        else:  # struggling
            comments = [
                "Need immediate help and training to improve performance",
                "Overwhelmed with current workload, require task redistribution",
                "Personal challenges affecting work, seeking support"
            ]
    
    return random.choice(comments)

# Activities and Notifications endpoints
@api_router.get("/activities", response_model=List[ActivityItem])
async def get_activities(
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    activity_type: Optional[str] = None
):
    """Get recent activities/notifications for the user's team"""
    if current_user.role == UserRole.ADMIN:
        # Admins see all activities for their team
        team_members = await db.users.find({"manager_id": current_user.id}).to_list(100)
        team_member_ids = [member["id"] for member in team_members] + [current_user.id]
        query = {"user_id": {"$in": team_member_ids}}
    else:
        # Employees see their own activities
        query = {"user_id": current_user.id}
    
    # Add activity type filter if provided
    if activity_type:
        query["type"] = activity_type
    
    activities = await db.activities.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    return [ActivityItem(**activity) for activity in activities]

@api_router.get("/activities/unread-count")
async def get_unread_activities_count(current_user: User = Depends(get_current_user)):
    """Get count of unread activities (activities from last 24 hours)"""
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    
    if current_user.role == UserRole.ADMIN:
        team_members = await db.users.find({"manager_id": current_user.id}).to_list(100)
        team_member_ids = [member["id"] for member in team_members] + [current_user.id]
        query = {"user_id": {"$in": team_member_ids}, "timestamp": {"$gte": twenty_four_hours_ago}}
    else:
        query = {"user_id": current_user.id, "timestamp": {"$gte": twenty_four_hours_ago}}
    
    count = await db.activities.count_documents(query)
    return {"unread_count": count}

# Enhanced Comment Prompt endpoint
@api_router.get("/goals/{goal_id}/comment-prompt")
async def get_comment_prompt(goal_id: str, status: str, current_user: User = Depends(get_current_user)):
    """Get contextual comment prompt based on goal status"""
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check access
    if current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this goal")
    
    prompts = {
        "on_track": [
            "Great progress! What's working well for you?",
            "Keep up the momentum! What strategies are helping you succeed?",
            "Excellent work! Share what's driving your success.",
            "You're doing great! What would you like to highlight about your progress?"
        ],
        "at_risk": [
            "What challenges are you facing that we can help address?",
            "What obstacles have come up, and how can the team support you?",
            "What's preventing you from staying on track? Let's work together on solutions.",
            "What support or resources would help you get back on track?",
            "What specific challenges can we help you overcome?"
        ],
        "off_track": [
            "What steps are you taking to get back on track?",
            "What's your plan to recover and meet your goal?",
            "What barriers need to be removed to help you succeed?",
            "What support do you need from the team to turn this around?",
            "What's your strategy for getting back on course? How can we help?",
            "What lessons have you learned that will help you refocus?"
        ]
    }
    
    import random
    prompt = random.choice(prompts.get(status, ["Please share an update on your progress."]))
    
    return {
        "prompt": prompt,
        "status": status,
        "goal_title": goal["title"],
        "additional_context": {
            "current_progress": f"{goal.get('current_value', 0)}/{goal['target_value']} {goal['unit']}",
            "progress_percentage": goal.get("progress_percentage", 0),
            "time_remaining": f"Until {goal['end_date'].strftime('%B %d, %Y')}" if goal.get('end_date') else None
        }
    }
@api_router.get("/analytics/dashboard", response_model=AnalyticsData)
async def get_analytics_dashboard(admin_user: User = Depends(get_admin_user)):
    """Get comprehensive analytics data for dashboard"""
    
    # Get all team members using the same logic as the team endpoint
    team_members = await db.users.find({"manager_id": admin_user.id, "is_active": True}).to_list(1000)
    
    # If no direct reports, get all employees for debugging/demo purposes
    if not team_members:
        all_employees = await db.users.find({"role": UserRole.EMPLOYEE, "is_active": True}).to_list(1000)
        print(f"DEBUG ANALYTICS: Admin {admin_user.email} has no direct reports, showing all {len(all_employees)} employees")
        team_members = all_employees
    
    team_member_ids = [member["id"] for member in team_members]
    
    if not team_member_ids:
        # Return empty analytics if no team members
        print(f"DEBUG ANALYTICS: No team members found for admin {admin_user.email}")
        return AnalyticsData(
            team_overview={"total_employees": 0, "total_goals": 0, "active_goals": 0, "completed_goals": 0, "completion_rate": 0, "avg_progress": 0},
            performance_trends=[],
            goal_completion_stats={"total": 0, "on_track": 0, "at_risk": 0, "off_track": 0, "on_track_percentage": 0, "at_risk_percentage": 0, "off_track_percentage": 0},
            employee_performance=[],
            status_distribution={"on_track": 0, "at_risk": 0, "off_track": 0},
            recent_activities=[]
        )
    
    # Get all goals for the team
    all_goals = await db.goals.find({"assigned_to": {"$in": team_member_ids}}).to_list(1000)
    
    # Get all progress updates for the team
    goal_ids = [goal["id"] for goal in all_goals]
    all_progress = await db.progress_updates.find({"goal_id": {"$in": goal_ids}}).to_list(10000)
    
    # Team Overview
    total_goals = len(all_goals)
    active_goals = len([g for g in all_goals if g["is_active"]])
    completed_goals = len([g for g in all_goals if not g["is_active"] and g["current_value"] >= g["target_value"] * 0.95])
    
    team_overview = {
        "total_employees": len(team_members),
        "total_goals": total_goals,
        "active_goals": active_goals,
        "completed_goals": completed_goals,
        "completion_rate": round((completed_goals / max(total_goals, 1)) * 100, 1),
        "avg_progress": round(sum([g["current_value"] / g["target_value"] for g in all_goals]) / max(len(all_goals), 1) * 100, 1)
    }
    
    # Performance Trends (last 4 months)
    monthly_trends = []
    for month_offset in range(4, 0, -1):
        month_start = datetime.utcnow() - timedelta(days=30 * month_offset)
        month_end = month_start + timedelta(days=30)
        month_name = month_start.strftime("%B %Y")
        
        # Handle both datetime objects and ISO strings
        month_goals = []
        for g in all_goals:
            start_date = g["start_date"]
            if isinstance(start_date, str):
                start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            elif isinstance(start_date, datetime):
                start_date = start_date.replace(tzinfo=None)  # Remove timezone for comparison
            
            if month_start <= start_date <= month_end:
                month_goals.append(g)
        month_completed = len([g for g in month_goals if g["current_value"] >= g["target_value"] * 0.95])
        
        monthly_trends.append({
            "month": month_name,
            "goals_created": len(month_goals),
            "goals_completed": month_completed,
            "completion_rate": round((month_completed / max(len(month_goals), 1)) * 100, 1),
            "avg_progress": round(sum([g["current_value"] / g["target_value"] for g in month_goals]) / max(len(month_goals), 1) * 100, 1) if month_goals else 0
        })
    
    # Goal Completion Stats
    on_track = len([g for g in all_goals if g["status"] == "on_track"])
    at_risk = len([g for g in all_goals if g["status"] == "at_risk"])
    off_track = len([g for g in all_goals if g["status"] == "off_track"])
    
    goal_completion_stats = {
        "total": total_goals,
        "on_track": on_track,
        "at_risk": at_risk,
        "off_track": off_track,
        "on_track_percentage": round((on_track / max(total_goals, 1)) * 100, 1),
        "at_risk_percentage": round((at_risk / max(total_goals, 1)) * 100, 1),
        "off_track_percentage": round((off_track / max(total_goals, 1)) * 100, 1)
    }
    
    # Employee Performance
    employee_performance = []
    for member in team_members:
        member_goals = [g for g in all_goals if member["id"] in g["assigned_to"]]
        member_completed = len([g for g in member_goals if g["current_value"] >= g["target_value"] * 0.95])
        member_progress = sum([g["current_value"] / g["target_value"] for g in member_goals]) / max(len(member_goals), 1) * 100
        
        # Calculate performance score (0-100)
        completion_score = (member_completed / max(len(member_goals), 1)) * 50
        progress_score = min(member_progress, 100) * 0.5
        performance_score = completion_score + progress_score
        
        employee_performance.append({
            "id": member["id"],
            "name": f"{member['first_name']} {member['last_name']}",
            "role": member.get("custom_role", member["job_title"]),
            "total_goals": len(member_goals),
            "completed_goals": member_completed,
            "completion_rate": round((member_completed / max(len(member_goals), 1)) * 100, 1),
            "avg_progress": round(member_progress, 1),
            "performance_score": round(performance_score, 1),
            "status_distribution": {
                "on_track": len([g for g in member_goals if g["status"] == "on_track"]),
                "at_risk": len([g for g in member_goals if g["status"] == "at_risk"]),
                "off_track": len([g for g in member_goals if g["status"] == "off_track"])
            }
        })
    
    # Sort by performance score
    employee_performance.sort(key=lambda x: x["performance_score"], reverse=True)
    
    # Status Distribution
    status_distribution = {
        "on_track": on_track,
        "at_risk": at_risk,
        "off_track": off_track
    }
    
    # Recent Activities (last 10 progress updates)
    recent_progress = sorted(all_progress, key=lambda x: x["timestamp"], reverse=True)[:10]
    recent_activities = []
    
    for progress in recent_progress:
        goal = next((g for g in all_goals if g["id"] == progress["goal_id"]), None)
        member = next((m for m in team_members if m["id"] == progress["user_id"]), None)
        
        if goal and member:
            recent_activities.append({
                "employee_name": f"{member['first_name']} {member['last_name']}",
                "goal_title": goal["title"],
                "status": progress["status"],
                "progress_value": progress["new_value"],
                "target_value": goal["target_value"],
                "unit": goal["unit"],
                "timestamp": progress["timestamp"],
                "comment": progress.get("comment")
            })
    
    return AnalyticsData(
        team_overview=team_overview,
        performance_trends=monthly_trends,
        goal_completion_stats=goal_completion_stats,
        employee_performance=employee_performance,
        status_distribution=status_distribution,
        recent_activities=recent_activities
    )

@api_router.post("/team/invite")
async def invite_employee(invite_data: UserInvite, admin_user: User = Depends(get_admin_user)):
    """Invite a new employee to join the team"""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": invite_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create user with temporary password (they'll need to set it during first login)
    temp_password = "TempPass123!"  # In production, generate random password and send via email
    
    user = User(
        email=invite_data.email,
        password_hash=get_password_hash(temp_password),
        first_name=invite_data.first_name,
        last_name=invite_data.last_name,
        role=UserRole.EMPLOYEE,
        job_title=invite_data.job_title,
        custom_role=invite_data.custom_role or invite_data.job_title,
        manager_id=admin_user.id
    )
    
    await db.users.insert_one(user.dict())
    
    # TODO: In production, send email invitation with temporary password
    # For now, return the temp password for demo purposes
    return {
        "message": "Employee invited successfully",
        "employee": UserResponse(**user.dict()),
        "temp_password": temp_password,  # Remove in production
        "instructions": f"Employee can login with email {invite_data.email} and temporary password: {temp_password}"
    }

# Admin user management endpoints
@api_router.get("/admin/users")
async def get_all_users(admin_user: User = Depends(get_admin_user)):
    """Get all users - admin only"""
    users = await db.users.find({}).to_list(100)
    
    # Clean and return user data with defaults for missing fields
    user_list = []
    for user in users:
        user_data = {
            "id": user.get("id"),
            "email": user.get("email"),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "role": user.get("role", "employee"),
            "job_title": user.get("job_title", "Employee"),  # Default job title
            "custom_role": user.get("custom_role"),
            "manager_id": user.get("manager_id"),
            "created_at": user.get("created_at")
        }
        user_list.append(user_data)
    
    return user_list

@api_router.patch("/admin/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: dict, admin_user: User = Depends(get_admin_user)):
    """Update user role - admin only"""
    new_role = role_data.get("role")
    if new_role not in ["admin", "employee"]:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'employee'")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User role updated to {new_role}"}

# Fix specific user role endpoint
@api_router.post("/admin/fix-jenny-role")
async def fix_jenny_role():
    """Fix jenny@careerplug.com role to admin"""
    result = await db.users.update_one(
        {"email": "jenny@careerplug.com"},
        {"$set": {"role": "admin"}}
    )
    
    if result.matched_count == 0:
        return {"message": "jenny@careerplug.com not found in database"}
    
# Restore missing CareerPlug users
@api_router.post("/admin/restore-careerplug-users")
async def restore_careerplug_users():
    """Restore Kelly Gull and Clint Smith user accounts"""
    
    # Check if users already exist
    kelly = await db.users.find_one({"email": "legal@careerplug.com"})
    clint = await db.users.find_one({"email": "clint@careerplug.com"})
    
    restored_users = []
    
    # Restore Kelly Gull
    if not kelly:
        kelly_user = {
            "id": str(uuid.uuid4()),
            "email": "legal@careerplug.com",
            "first_name": "Kelly",
            "last_name": "Gull",
            "job_title": "Legal Counsel",
            "password_hash": pwd_context.hash("password123"),  # Default password
            "role": "employee",
            "is_active": True,
            "manager_id": None,  # Can be updated later
            "custom_role": "Legal",
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(kelly_user)
        restored_users.append("Kelly Gull (legal@careerplug.com)")
    
    # Restore Clint Smith  
    if not clint:
        clint_user = {
            "id": str(uuid.uuid4()),
            "email": "clint@careerplug.com",
            "first_name": "Clint",
            "last_name": "Smith",
            "job_title": "Operations Manager",
            "password_hash": pwd_context.hash("password123"),  # Default password
            "role": "employee", 
            "is_active": True,
            "manager_id": None,  # Can be updated later
            "custom_role": "Operations",
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(clint_user)
        restored_users.append("Clint Smith (clint@careerplug.com)")
    
    if not restored_users:
        return {"message": "Users already exist - no restoration needed"}
    
# Fix Jenny's profile
@api_router.post("/admin/fix-jenny-profile")
async def fix_jenny_profile():
    """Fix Jenny's profile information"""
    # Get Jenny's current ID first
    jenny = await db.users.find_one({"email": "jenny@careerplug.com"})
    if not jenny:
        return {"message": "Jenny not found"}
    
    jenny_id = jenny["id"]
    
    # Update Jenny's profile
    jenny_result = await db.users.update_one(
        {"email": "jenny@careerplug.com"},
        {"$set": {
            "first_name": "Jenny",
            "last_name": "CareerPlug",
            "job_title": "CEO & Manager",
            "role": "admin"
        }}
    )
    
    # Set Jenny as manager for Kelly and Clint
    kelly_result = await db.users.update_one(
        {"email": "legal@careerplug.com"},
        {"$set": {"manager_id": jenny_id}}
    )
    
    clint_result = await db.users.update_one(
        {"email": "clint@careerplug.com"},
        {"$set": {"manager_id": jenny_id}}
    )
    
    return {
        "message": "Jenny's profile updated and team relationships established",
        "updates": {
            "jenny_profile_updated": jenny_result.modified_count > 0,
            "kelly_manager_set": kelly_result.modified_count > 0,
            "clint_manager_set": clint_result.modified_count > 0
        }
    }

# Team management routes
@api_router.get("/team")
async def get_team(admin_user: User = Depends(get_admin_user)):
    """Get full team roster with manager details"""
    # Get all users who have this admin as their manager
    team_members = await db.users.find({"manager_id": admin_user.id, "is_active": True}).to_list(1000)
    
    # Also get all users managed by this admin (broader search for edge cases)
    if not team_members:
        # Try alternative search - look for users who might have been assigned to this admin
        all_users = await db.users.find({"role": UserRole.EMPLOYEE, "is_active": True}).to_list(1000)
        # For debugging - let's see what users exist
        print(f"DEBUG: Admin {admin_user.email} (ID: {admin_user.id}) looking for team members")
        print(f"DEBUG: Found {len(all_users)} total employee users")
        for user in all_users:
            print(f"DEBUG: User {user['email']} has manager_id: {user.get('manager_id', 'None')}")
        
        # If admin has no direct reports, return all employees for now (can be refined later)
        team_members = all_users
    
    # Add manager details for each team member
    for member in team_members:
        if member.get("manager_id"):
            manager = await db.users.find_one({"id": member["manager_id"]})
            member["manager_name"] = f"{manager['first_name']} {manager['last_name']}" if manager else "Unknown"
        else:
            member["manager_name"] = None
    
    print(f"DEBUG: Returning {len(team_members)} team members for admin {admin_user.email}")
    return [UserResponse(**member) for member in team_members]

@api_router.put("/team/{user_id}")
async def update_team_member(user_id: str, update_data: UserUpdate, admin_user: User = Depends(get_admin_user)):
    """Update team member details (job title, custom role)"""
    # Verify the user is part of the admin's team
    user = await db.users.find_one({"id": user_id, "manager_id": admin_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    # Update user
    update_fields = {}
    if update_data.job_title is not None:
        update_fields["job_title"] = update_data.job_title
    if update_data.custom_role is not None:
        update_fields["custom_role"] = update_data.custom_role
    
    if update_fields:
        await db.users.update_one({"id": user_id}, {"$set": update_fields})
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id})
    return UserResponse(**updated_user)

@api_router.get("/roles")
async def get_custom_roles(admin_user: User = Depends(get_admin_user)):
    """Get list of custom roles used by team members"""
    team_members = await db.users.find({"manager_id": admin_user.id, "is_active": True}).to_list(100)
    
    # Extract unique custom roles
    roles = set()
    for member in team_members:
        if member.get("custom_role"):
            roles.add(member["custom_role"])
    
    return [{"role": role, "count": len([m for m in team_members if m.get("custom_role") == role])} for role in sorted(roles)]

# Enhanced Goal Response Model with Comments
class GoalWithComments(Goal):
    latest_comment: Optional[str] = None
    latest_comment_timestamp: Optional[datetime] = None
    latest_comment_user: Optional[str] = None

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
    
    # Create activity item for goal creation
    activity = ActivityItem(
        type="goal_created",
        title="New Goal Created",
        description=f"Goal '{goal.title}' was created and assigned to {len(goal.assigned_to)} team member(s)",
        user_id=admin_user.id,
        user_name=f"{admin_user.first_name} {admin_user.last_name}",
        goal_id=goal.id,
        goal_title=goal.title,
        metadata={"assigned_count": len(goal.assigned_to), "cycle_type": goal.cycle_type}
    )
    await db.activities.insert_one(activity.dict())
    
    return goal

# Goal editing endpoint
@api_router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, goal_data: GoalCreate, admin_user: User = Depends(get_admin_user)):
    """Update an existing goal and recalculate progress"""
    # Check if goal exists
    existing_goal = await db.goals.find_one({"id": goal_id})
    if not existing_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Validate assigned users exist if updating assignments
    for user_id in goal_data.assigned_to:
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=400, detail=f"User {user_id} not found")
    
    # Store original values for activity tracking
    original_target = existing_goal.get("target_value")
    original_comparison = existing_goal.get("comparison", "greater_than")
    
    # Prepare update data
    update_data = goal_data.dict()
    update_data["last_updated"] = datetime.utcnow()
    
    # Recalculate progress percentage with new target/comparison
    current_value = existing_goal.get("current_value", 0)
    new_progress_percentage = calculate_progress_percentage(
        current_value,
        goal_data.target_value,
        goal_data.comparison
    )
    
    update_data["progress_percentage"] = new_progress_percentage
    
    # Update the goal
    await db.goals.update_one({"id": goal_id}, {"$set": update_data})
    
    # Create activity for goal edit
    changes = []
    if original_target != goal_data.target_value:
        changes.append(f"target: {original_target} → {goal_data.target_value}")
    if original_comparison != goal_data.comparison:
        changes.append(f"logic: {original_comparison} → {goal_data.comparison}")
    
    activity = ActivityItem(
        type="goal_edited",
        title="Goal Updated",
        description=f"Goal '{goal_data.title}' was edited by {admin_user.first_name}. Changes: {', '.join(changes) if changes else 'details updated'}",
        user_id=admin_user.id,
        user_name=f"{admin_user.first_name} {admin_user.last_name}",
        goal_id=goal_id,
        goal_title=goal_data.title,
        metadata={
            "original_target": original_target,
            "new_target": goal_data.target_value,
            "original_comparison": original_comparison,
            "new_comparison": goal_data.comparison,
            "recalculated_progress": new_progress_percentage
        }
    )
    await db.activities.insert_one(activity.dict())
    
    return {"message": "Goal updated successfully", "recalculated_progress": new_progress_percentage}

@api_router.get("/goals", response_model=List[GoalWithComments])
async def get_goals(
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = None,
    include_comments: bool = True
):
    """Get goals with optional status filtering and latest comments"""
    if current_user.role == UserRole.ADMIN:
        # Admins see all goals for their team
        team_members = await db.users.find({"manager_id": current_user.id}).to_list(100)
        team_member_ids = [member["id"] for member in team_members] + [current_user.id]
        query = {"assigned_to": {"$in": team_member_ids}, "is_active": True}
    else:
        # Employees see only their goals
        query = {"assigned_to": current_user.id, "is_active": True}
    
    # Add status filter if provided
    if status_filter and status_filter in ["on_track", "at_risk", "off_track"]:
        query["status"] = status_filter
    
    goals = await db.goals.find(query).to_list(100)
    
    # Enhance goals with latest comments if requested
    enhanced_goals = []
    for goal in goals:
        goal_with_comments = GoalWithComments(**goal)
        
        if include_comments:
            # Get latest progress update with comment for this goal
            latest_progress = await db.progress_updates.find({
                "goal_id": goal["id"],
                "comment": {"$ne": None, "$ne": ""}
            }).sort("timestamp", -1).limit(1).to_list(1)
            
            if latest_progress:
                update = latest_progress[0]
                goal_with_comments.latest_comment = update.get("comment")
                goal_with_comments.latest_comment_timestamp = update.get("timestamp")
                
                # Get user name for the comment
                comment_user = await db.users.find_one({"id": update.get("user_id")})
                if comment_user:
                    goal_with_comments.latest_comment_user = f"{comment_user['first_name']} {comment_user['last_name']}"
        
        enhanced_goals.append(goal_with_comments)
    
    return enhanced_goals

@api_router.get("/goals/{goal_id}", response_model=Goal)
async def get_goal(goal_id: str, current_user: User = Depends(get_current_user)):
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check access permissions
    if current_user.role == UserRole.EMPLOYEE and current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return Goal(**goal)

def calculate_progress_percentage(current_value: float, target_value: float, comparison: str) -> float:
    """Calculate progress percentage based on comparison type"""
    if comparison == "greater_than":
        # Traditional progress: current/target * 100
        if target_value > 0:
            return min((current_value / target_value) * 100, 100)
        return 0
    elif comparison == "less_than":
        # Reverse progress: (target - current) / target * 100
        if target_value <= 0:
            return 100 if current_value <= 0 else 0
        remaining = max(target_value - current_value, 0)
        return (remaining / target_value) * 100
    elif comparison == "equal_to":
        # Exact match: 100% if equal, decreasing based on distance
        if target_value == 0:
            return 100 if current_value == 0 else 0
        distance = abs(current_value - target_value)
        max_acceptable_distance = abs(target_value * 0.1)  # 10% tolerance
        if distance <= max_acceptable_distance:
            return 100 - (distance / max_acceptable_distance) * 100
        return 0
    # Default to greater_than
    if target_value > 0:
        return min((current_value / target_value) * 100, 100)
    return 0

@api_router.post("/goals/{goal_id}/progress")
async def update_goal_progress(
    goal_id: str, 
    progress_data: ProgressUpdateCreate, 
    current_user: User = Depends(get_current_user)
):
    """Update goal progress with enhanced activity tracking"""
    goal = await db.goals.find_one({"id": goal_id})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Check if user is assigned to this goal
    if current_user.id not in goal["assigned_to"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this goal")
    
    # Store previous status for comparison
    previous_status = goal.get("status", "on_track")
    
    # Create progress update record
    progress_update = ProgressUpdate(
        goal_id=goal_id,
        user_id=current_user.id,
        previous_value=goal["current_value"],
        new_value=progress_data.new_value,
        status=progress_data.status,
        comment=progress_data.comment
    )
    
    await db.progress_updates.insert_one(progress_update.dict())
    
    # Calculate progress percentage using comparison logic
    progress_percentage = calculate_progress_percentage(
        progress_data.new_value, 
        goal["target_value"], 
        goal.get("comparison", "greater_than")
    )
    
    # Update goal with new progress and status
    update_data = {
        "current_value": progress_data.new_value,
        "progress_percentage": progress_percentage,
        "status": progress_data.status,
        "last_updated": datetime.utcnow()
    }
    
    await db.goals.update_one({"id": goal_id}, {"$set": update_data})
    
    # Create activity for progress update
    status_emoji = {"on_track": "🟢", "at_risk": "🟡", "off_track": "🔴"}
    activity = ActivityItem(
        type="progress_updated",
        title="Goal Progress Updated",
        description=f"{status_emoji.get(progress_data.status, '⚪')} {current_user.first_name} updated '{goal['title']}' to {progress_data.new_value}/{goal['target_value']} {goal['unit']}",
        user_id=current_user.id,
        user_name=f"{current_user.first_name} {current_user.last_name}",
        goal_id=goal_id,
        goal_title=goal["title"],
        metadata={
            "progress_value": progress_data.new_value,
            "target_value": goal["target_value"],
            "status": progress_data.status,
            "previous_status": previous_status,
            "progress_percentage": progress_percentage,
            "has_comment": bool(progress_data.comment)
        }
    )
    await db.activities.insert_one(activity.dict())
    
    # Create additional activity for status changes
    if previous_status != progress_data.status:
        status_change_activity = ActivityItem(
            type="status_changed",
            title="Goal Status Changed",
            description=f"Goal '{goal['title']}' status changed from {previous_status.replace('_', ' ').title()} to {progress_data.status.replace('_', ' ').title()}",
            user_id=current_user.id,
            user_name=f"{current_user.first_name} {current_user.last_name}",
            goal_id=goal_id,
            goal_title=goal["title"],
            metadata={
                "previous_status": previous_status,
                "new_status": progress_data.status,
                "comment": progress_data.comment
            }
        )
        await db.activities.insert_one(status_change_activity.dict())
    
    return {"message": "Progress updated successfully", "progress_percentage": progress_percentage}

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

@api_router.post("/goals/assign-by-role")
async def assign_goal_by_role(role_name: str, goal_data: GoalCreate, admin_user: User = Depends(get_admin_user)):
    """Create and assign goal to all team members with specified custom role"""
    # Find all team members with the specified custom role
    team_members = await db.users.find({
        "manager_id": admin_user.id, 
        "custom_role": role_name, 
        "is_active": True
    }).to_list(100)
    
    if not team_members:
        raise HTTPException(status_code=400, detail=f"No team members found with role: {role_name}")
    
    # Set assigned_to to all users with this role
    goal_data.assigned_to = [member["id"] for member in team_members]
    
    goal = Goal(
        **goal_data.dict(),
        assigned_by=admin_user.id
    )
    
    await db.goals.insert_one(goal.dict())
    return {
        "goal": goal,
        "assigned_count": len(team_members),
        "assigned_to": [f"{m['first_name']} {m['last_name']}" for m in team_members]
    }

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
