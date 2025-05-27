import requests
import json
import unittest
import os
import sys
from datetime import datetime

# Get the backend URL from environment or use default
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://a1f28446-eca0-4698-8c2b-136c521c69e4.preview.emergentagent.com')
API_URL = f"{BACKEND_URL}/api"

class TestForgotPasswordEmailService(unittest.TestCase):
    """Test the forgot password flow with SendGrid email integration"""
    
    def setUp(self):
        """Set up test environment"""
        self.api_url = API_URL
        self.headers = {
            'Content-Type': 'application/json'
        }
        print(f"\nUsing API URL: {self.api_url}")
        
        # Create a test user for our tests
        self.create_test_user()
    
    def create_test_user(self):
        """Create a test user if needed"""
        # Generate a unique email
        timestamp = datetime.now().strftime('%H%M%S%f')
        self.test_email = f"test_user_{timestamp}@example.com"
        
        # Register the user
        register_url = f"{self.api_url}/auth/register"
        user_data = {
            "email": self.test_email,
            "password": "password123",
            "first_name": "Test",
            "last_name": "User",
            "job_title": "Tester",
            "manager_id": None  # Admin role
        }
        
        try:
            response = requests.post(register_url, headers=self.headers, json=user_data)
            if response.status_code == 200:
                print(f"✅ Created test user: {self.test_email}")
                self.test_user_id = response.json()['user']['id']
            else:
                print(f"⚠️ Could not create test user. Using existing user email instead.")
                self.test_email = "testemployee1@demo.com"  # Fallback to demo user
        except Exception as e:
            print(f"⚠️ Error creating test user: {str(e)}")
            self.test_email = "testemployee1@demo.com"  # Fallback to demo user
    
    def test_1_forgot_password_existing_user(self):
        """Test forgot password with an existing user email"""
        forgot_password_url = f"{self.api_url}/auth/forgot-password"
        payload = {"email": self.test_email}
        
        print(f"\nTesting forgot password with existing email: {self.test_email}")
        response = requests.post(forgot_password_url, headers=self.headers, json=payload)
        
        # Print response for debugging
        print(f"Response status code: {response.status_code}")
        print(f"Response body: {json.dumps(response.json(), indent=2)}")
        
        # Assertions
        self.assertEqual(response.status_code, 200, "Should return 200 OK")
        self.assertIn("message", response.json(), "Response should contain a message")
        
        # Check if in simulation mode (no SendGrid API key)
        if "demo_mode" in response.json():
            self.assertTrue(response.json()["demo_mode"], "Should be in demo mode")
            self.assertIn("demo_reset_url", response.json(), "Should include demo reset URL")
            self.assertIn("demo_instructions", response.json(), "Should include demo instructions")
            
            # Verify the reset URL format
            reset_url = response.json()["demo_reset_url"]
            self.assertIn("/reset-password?token=", reset_url, "Reset URL should contain token")
            print(f"✅ Demo reset URL verified: {reset_url}")
            
            # Save the token for the next test
            self.reset_token = reset_url.split("token=")[1]
        else:
            print("⚠️ Not in demo mode - SendGrid API key might be configured")
    
    def test_2_forgot_password_nonexistent_user(self):
        """Test forgot password with a non-existent user email"""
        non_existent_email = f"nonexistent_{datetime.now().timestamp()}@example.com"
        forgot_password_url = f"{self.api_url}/auth/forgot-password"
        payload = {"email": non_existent_email}
        
        print(f"\nTesting forgot password with non-existent email: {non_existent_email}")
        response = requests.post(forgot_password_url, headers=self.headers, json=payload)
        
        # Print response for debugging
        print(f"Response status code: {response.status_code}")
        print(f"Response body: {json.dumps(response.json(), indent=2)}")
        
        # Assertions
        self.assertEqual(response.status_code, 200, "Should return 200 OK even for non-existent email")
        self.assertIn("message", response.json(), "Response should contain a message")
        
        # For security, the API should not reveal if the email exists or not
        self.assertNotIn("error", response.json(), "Should not reveal that email doesn't exist")
        
        # Should not include demo reset URL for non-existent email
        self.assertNotIn("demo_reset_url", response.json(), "Should not include demo reset URL for non-existent email")
        
        print("✅ Security check passed: API doesn't reveal if email exists")
    
    def test_3_reset_password_with_token(self):
        """Test resetting password with the token"""
        # Skip if we don't have a token from the previous test
        if not hasattr(self, 'reset_token'):
            print("⚠️ Skipping reset password test - no token available")
            return
            
        reset_password_url = f"{self.api_url}/auth/reset-password"
        payload = {
            "token": self.reset_token,
            "new_password": "newpassword456"
        }
        
        print(f"\nTesting password reset with token: {self.reset_token}")
        response = requests.post(reset_password_url, headers=self.headers, json=payload)
        
        # Print response for debugging
        print(f"Response status code: {response.status_code}")
        try:
            print(f"Response body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response body: {response.text}")
        
        # Assertions
        self.assertEqual(response.status_code, 200, "Should return 200 OK for valid token")
        
        # Try to login with the new password
        login_url = f"{self.api_url}/auth/login"
        login_payload = {
            "email": self.test_email,
            "password": "newpassword456"
        }
        
        print(f"\nTesting login with new password for: {self.test_email}")
        login_response = requests.post(login_url, headers=self.headers, json=login_payload)
        
        # Print response for debugging
        print(f"Login response status code: {login_response.status_code}")
        try:
            print(f"Login response body: {json.dumps(login_response.json(), indent=2)}")
        except:
            print(f"Login response body: {login_response.text}")
        
        # Assertions
        self.assertEqual(login_response.status_code, 200, "Should be able to login with new password")
        self.assertIn("access_token", login_response.json(), "Login response should contain access token")
        
        print("✅ Password reset successful - able to login with new password")
    
    def test_4_invalid_reset_token(self):
        """Test resetting password with an invalid token"""
        reset_password_url = f"{self.api_url}/auth/reset-password"
        payload = {
            "token": "invalid_token_that_doesnt_exist",
            "new_password": "newpassword789"
        }
        
        print(f"\nTesting password reset with invalid token")
        response = requests.post(reset_password_url, headers=self.headers, json=payload)
        
        # Print response for debugging
        print(f"Response status code: {response.status_code}")
        try:
            print(f"Response body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Response body: {response.text}")
        
        # Assertions
        self.assertEqual(response.status_code, 400, "Should return 400 Bad Request for invalid token")
        
        print("✅ Security check passed: API rejects invalid reset tokens")
    
    def test_5_email_template_verification(self):
        """Verify the email template structure in simulation mode"""
        forgot_password_url = f"{self.api_url}/auth/forgot-password"
        payload = {"email": self.test_email}
        
        print(f"\nVerifying email template structure for: {self.test_email}")
        response = requests.post(forgot_password_url, headers=self.headers, json=payload)
        
        # Check if in simulation mode
        if "demo_mode" in response.json():
            reset_url = response.json().get("demo_reset_url", "")
            
            # Verify URL structure
            self.assertTrue(reset_url.startswith("https://"), "Reset URL should use HTTPS")
            self.assertIn("/reset-password?token=", reset_url, "Reset URL should have correct path format")
            
            # Verify token format (should be UUID)
            token = reset_url.split("token=")[1]
            self.assertRegex(token, r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 
                            "Token should be a valid UUID")
            
            print("✅ Email template verification passed")
            print(f"✅ Reset URL format is correct: {reset_url}")
        else:
            print("⚠️ Not in demo mode - skipping email template verification")

if __name__ == "__main__":
    # Run tests in order
    suite = unittest.TestSuite()
    suite.addTest(TestForgotPasswordEmailService('test_1_forgot_password_existing_user'))
    suite.addTest(TestForgotPasswordEmailService('test_2_forgot_password_nonexistent_user'))
    suite.addTest(TestForgotPasswordEmailService('test_3_reset_password_with_token'))
    suite.addTest(TestForgotPasswordEmailService('test_4_invalid_reset_token'))
    suite.addTest(TestForgotPasswordEmailService('test_5_email_template_verification'))
    
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)