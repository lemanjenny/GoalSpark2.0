import requests
import json
import unittest
import os
import sys
from datetime import datetime

# Get the backend URL from environment or use default
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://a1f28446-eca0-4698-8c2b-136c521c69e4.preview.emergentagent.com')
API_URL = f"{BACKEND_URL}/api"

def test_full_password_reset_flow():
    """Test the complete password reset flow from forgot password to login with new password"""
    headers = {
        'Content-Type': 'application/json'
    }
    
    # Step 1: Create a test user
    timestamp = datetime.now().strftime('%H%M%S%f')
    test_email = f"test_user_{timestamp}@example.com"
    test_password = "password123"
    
    register_url = f"{API_URL}/auth/register"
    user_data = {
        "email": test_email,
        "password": test_password,
        "first_name": "Test",
        "last_name": "User",
        "job_title": "Tester",
        "manager_id": None  # Admin role
    }
    
    print(f"\n1. Creating test user: {test_email}")
    response = requests.post(register_url, headers=headers, json=user_data)
    
    if response.status_code != 200:
        print(f"❌ Failed to create test user: {response.text}")
        return
    
    print(f"✅ Created test user: {test_email}")
    
    # Step 2: Request password reset
    forgot_password_url = f"{API_URL}/auth/forgot-password"
    payload = {"email": test_email}
    
    print(f"\n2. Requesting password reset for: {test_email}")
    response = requests.post(forgot_password_url, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"❌ Failed to request password reset: {response.text}")
        return
    
    print(f"✅ Password reset requested successfully")
    
    # Check if in demo mode and get reset token
    if "demo_mode" not in response.json():
        print("❌ Not in demo mode - test cannot continue")
        return
    
    reset_url = response.json()["demo_reset_url"]
    token = reset_url.split("token=")[1]
    
    print(f"✅ Got reset token: {token}")
    
    # Step 3: Reset password with token
    reset_password_url = f"{API_URL}/auth/reset-password"
    new_password = "newpassword456"
    payload = {
        "token": token,
        "new_password": new_password
    }
    
    print(f"\n3. Resetting password with token")
    response = requests.post(reset_password_url, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"❌ Failed to reset password: {response.text}")
        return
    
    print(f"✅ Password reset successful")
    
    # Step 4: Try to login with the new password
    login_url = f"{API_URL}/auth/login"
    login_payload = {
        "email": test_email,
        "password": new_password
    }
    
    print(f"\n4. Logging in with new password")
    response = requests.post(login_url, headers=headers, json=login_payload)
    
    if response.status_code != 200:
        print(f"❌ Failed to login with new password: {response.text}")
        return
    
    if "access_token" not in response.json():
        print(f"❌ Login response missing access token: {response.json()}")
        return
    
    print(f"✅ Successfully logged in with new password")
    print(f"✅ FULL PASSWORD RESET FLOW TEST PASSED")

if __name__ == "__main__":
    test_full_password_reset_flow()