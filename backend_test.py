import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class GoalTrackerAPITester:
    def __init__(self, base_url="https://a57f031a-35f2-4808-be33-a7b5e2b52483.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.employee_token = None
        self.admin_user = None
        self.employee_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    token: Optional[str] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            if not success:
                print(f"   Status: {response.status_code}, Expected: {expected_status}")
                print(f"   Response: {response_data}")

            return success, response_data

        except requests.exceptions.RequestException as e:
            print(f"   Request failed: {str(e)}")
            return False, {"error": str(e)}

    def test_health_check(self):
        """Test API health check endpoint"""
        success, response = self.make_request('GET', '', expected_status=200)
        
        if success and response.get('message') == 'Goal Tracker API is running!':
            self.log_test("API Health Check", True)
            return True
        else:
            self.log_test("API Health Check", False, f"Unexpected response: {response}")
            return False

    def test_get_managers_empty(self):
        """Test getting managers list when empty"""
        success, response = self.make_request('GET', 'managers', expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Managers (Empty)", True, f"Found {len(response)} managers")
            return True
        else:
            self.log_test("Get Managers (Empty)", False, f"Expected list, got: {response}")
            return False

    def test_admin_registration(self):
        """Test admin user registration"""
        timestamp = datetime.now().strftime('%H%M%S%f')
        admin_data = {
            "email": f"admin_{timestamp}@test.com",
            "password": "password123",
            "first_name": "Sarah",
            "last_name": "CEO",
            "job_title": "Chief Executive Officer",
            "manager_id": None
        }
        
        success, response = self.make_request('POST', 'auth/register', admin_data, expected_status=200)
        
        if success and 'access_token' in response and 'user' in response:
            self.admin_token = response['access_token']
            self.admin_user = response['user']
            self.admin_email = admin_data['email']  # Store email for login test
            self.log_test("Admin Registration", True, f"User ID: {self.admin_user['id']}, Role: {self.admin_user['role']}")
            return True
        else:
            self.log_test("Admin Registration", False, f"Response: {response}")
            return False

    def test_admin_login(self):
        """Test admin user login"""
        if not hasattr(self, 'admin_email'):
            self.log_test("Admin Login", False, "No admin email available")
            return False
            
        login_data = {
            "email": self.admin_email,
            "password": "password123"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and 'access_token' in response:
            # Update token in case it's different
            self.admin_token = response['access_token']
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Response: {response}")
            return False

    def test_protected_route_me(self):
        """Test protected route /auth/me"""
        if not self.admin_token:
            self.log_test("Protected Route (/auth/me)", False, "No admin token available")
            return False
            
        success, response = self.make_request('GET', 'auth/me', token=self.admin_token, expected_status=200)
        
        if success and 'email' in response and response['email'] == self.admin_email:
            self.log_test("Protected Route (/auth/me)", True)
            return True
        else:
            self.log_test("Protected Route (/auth/me)", False, f"Response: {response}")
            return False

    def test_get_managers_with_admin(self):
        """Test getting managers list after admin registration"""
        success, response = self.make_request('GET', 'managers', expected_status=200)
        
        if success and isinstance(response, list) and len(response) > 0:
            manager = response[0]
            if 'id' in manager and 'first_name' in manager:
                self.log_test("Get Managers (With Admin)", True, f"Found {len(response)} managers")
                return True
        
        self.log_test("Get Managers (With Admin)", False, f"Expected non-empty list with manager data: {response}")
        return False

    def test_employee_registration(self):
        """Test employee user registration"""
        if not self.admin_user:
            self.log_test("Employee Registration", False, "No admin user available for manager_id")
            return False
            
        employee_data = {
            "email": "employee@test.com",
            "password": "password123",
            "first_name": "Jane",
            "last_name": "Employee",
            "job_title": "Sales Rep",
            "manager_id": self.admin_user['id']
        }
        
        success, response = self.make_request('POST', 'auth/register', employee_data, expected_status=200)
        
        if success and 'access_token' in response and 'user' in response:
            self.employee_token = response['access_token']
            self.employee_user = response['user']
            self.log_test("Employee Registration", True, f"User ID: {self.employee_user['id']}")
            return True
        else:
            self.log_test("Employee Registration", False, f"Response: {response}")
            return False

    def test_duplicate_registration(self):
        """Test duplicate email registration"""
        duplicate_data = {
            "email": "admin@test.com",  # Same email as admin
            "password": "password123",
            "first_name": "Duplicate",
            "last_name": "User",
            "job_title": "Test",
            "manager_id": None
        }
        
        success, response = self.make_request('POST', 'auth/register', duplicate_data, expected_status=400)
        
        if success and 'detail' in response and 'already registered' in response['detail'].lower():
            self.log_test("Duplicate Registration Prevention", True)
            return True
        else:
            self.log_test("Duplicate Registration Prevention", False, f"Expected 400 error: {response}")
            return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        invalid_login = {
            "email": "admin@test.com",
            "password": "wrongpassword"
        }
        
        success, response = self.make_request('POST', 'auth/login', invalid_login, expected_status=401)
        
        if success:
            self.log_test("Invalid Login Prevention", True)
            return True
        else:
            self.log_test("Invalid Login Prevention", False, f"Expected 401 error: {response}")
            return False

    def test_unauthorized_access(self):
        """Test accessing protected route without token"""
        success, response = self.make_request('GET', 'auth/me', expected_status=403)
        
        # FastAPI with HTTPBearer returns 403 for missing token
        if success or response.get('status_code') == 403:
            self.log_test("Unauthorized Access Prevention", True)
            return True
        else:
            self.log_test("Unauthorized Access Prevention", False, f"Expected 403 error: {response}")
            return False

    def test_get_team_members(self):
        """Test admin getting team members"""
        if not self.admin_token:
            self.log_test("Get Team Members", False, "No admin token available")
            return False
            
        success, response = self.make_request('GET', 'users/team', token=self.admin_token, expected_status=200)
        
        if success and isinstance(response, list):
            self.log_test("Get Team Members", True, f"Found {len(response)} team members")
            return True
        else:
            self.log_test("Get Team Members", False, f"Response: {response}")
            return False

    def test_employee_access_team_members(self):
        """Test employee trying to access team members (should fail)"""
        if not self.employee_token:
            self.log_test("Employee Access Team Members (Should Fail)", False, "No employee token available")
            return False
            
        success, response = self.make_request('GET', 'users/team', token=self.employee_token, expected_status=403)
        
        if success:
            self.log_test("Employee Access Team Members (Should Fail)", True)
            return True
        else:
            self.log_test("Employee Access Team Members (Should Fail)", False, f"Expected 403 error: {response}")
            return False

    def test_get_goals_empty(self):
        """Test getting goals when none exist"""
        if not self.admin_token:
            self.log_test("Get Goals (Empty)", False, "No admin token available")
            return False
            
        success, response = self.make_request('GET', 'goals', token=self.admin_token, expected_status=200)
        
        if success and isinstance(response, list) and len(response) == 0:
            self.log_test("Get Goals (Empty)", True)
            return True
        else:
            self.log_test("Get Goals (Empty)", False, f"Expected empty list: {response}")
            return False

    def create_sample_goal(self):
        """Helper method to create a sample goal"""
        if not self.admin_token or not self.employee_user:
            return None
            
        goal_data = {
            "title": "Sales Target Q1",
            "description": "Achieve 100 sales calls this quarter",
            "goal_type": "target",
            "target_value": 100.0,
            "unit": "calls",
            "assigned_to": [self.employee_user['id']],
            "cycle_type": "quarterly",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=90)).isoformat()
        }
        
        success, response = self.make_request('POST', 'goals', goal_data, token=self.admin_token, expected_status=200)
        
        if success and 'id' in response:
            return response
        return None

    def test_create_goal(self):
        """Test creating a goal as admin"""
        goal = self.create_sample_goal()
        
        if goal:
            self.log_test("Create Goal", True, f"Goal ID: {goal['id']}")
            return goal
        else:
            self.log_test("Create Goal", False, "Failed to create goal")
            return None

    def test_employee_create_goal(self):
        """Test employee trying to create goal (should fail)"""
        if not self.employee_token or not self.employee_user:
            self.log_test("Employee Create Goal (Should Fail)", False, "No employee token available")
            return False
            
        goal_data = {
            "title": "Unauthorized Goal",
            "description": "This should fail",
            "goal_type": "target",
            "target_value": 50.0,
            "unit": "units",
            "assigned_to": [self.employee_user['id']],
            "cycle_type": "monthly",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=30)).isoformat()
        }
        
        success, response = self.make_request('POST', 'goals', goal_data, token=self.employee_token, expected_status=403)
        
        if success:
            self.log_test("Employee Create Goal (Should Fail)", True)
            return True
        else:
            self.log_test("Employee Create Goal (Should Fail)", False, f"Expected 403 error: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Goal Tracker API Tests")
        print("=" * 50)
        
        # Basic API tests
        if not self.test_health_check():
            print("❌ Health check failed - stopping tests")
            return False
            
        self.test_get_managers_empty()
        
        # Authentication tests
        if not self.test_admin_registration():
            print("❌ Admin registration failed - stopping tests")
            return False
            
        self.test_admin_login()
        self.test_protected_route_me()
        self.test_get_managers_with_admin()
        
        # Employee registration
        self.test_employee_registration()
        
        # Security tests
        self.test_duplicate_registration()
        self.test_invalid_login()
        self.test_unauthorized_access()
        
        # Role-based access tests
        self.test_get_team_members()
        self.test_employee_access_team_members()
        
        # Goal management tests
        self.test_get_goals_empty()
        goal = self.test_create_goal()
        self.test_employee_create_goal()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            failed_tests = [test for test in self.test_results if not test['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['name']}: {test['details']}")
            return False

def main():
    """Main test runner"""
    tester = GoalTrackerAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"❌ Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())