import requests
import json
import time
from datetime import datetime
import unittest
import sys

# Base URL from frontend/.env
BASE_URL = "https://a1f28446-eca0-4698-8c2b-136c521c69e4.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

class GoalSparkEnhancedAPITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Set up test data and authentication once for all tests"""
        cls.admin_credentials = {
            "email": f"testadmin_{int(time.time())}@example.com",
            "password": "TestPassword123!"
        }
        
        # Register admin user
        register_data = {
            "email": cls.admin_credentials["email"],
            "password": cls.admin_credentials["password"],
            "first_name": "Test",
            "last_name": "Admin",
            "job_title": "Test Manager"
        }
        
        response = requests.post(f"{API_URL}/auth/register", json=register_data)
        if response.status_code != 200:
            raise Exception(f"Failed to register admin user: {response.text}")
        
        cls.admin_token = response.json()["access_token"]
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}
        cls.admin_user_id = response.json()["user"]["id"]
        
        # Generate demo data
        response = requests.post(f"{API_URL}/demo/generate-data", headers=cls.admin_headers)
        if response.status_code != 200:
            raise Exception(f"Failed to generate demo data: {response.text}")
        
        print(f"Demo data generation response: {response.json()}")
        
        # Get goals to use in tests
        response = requests.get(f"{API_URL}/goals", headers=cls.admin_headers)
        if response.status_code != 200 or not response.json():
            raise Exception(f"Failed to get goals or no goals found: {response.text}")
        
        cls.test_goals = response.json()
        cls.test_goal_id = cls.test_goals[0]["id"] if cls.test_goals else None
        
        print(f"Setup complete. Admin user: {cls.admin_credentials['email']}")
        print(f"Found {len(cls.test_goals)} goals for testing")

    def test_01_goals_endpoint_with_status_filter(self):
        """Test the enhanced goals endpoint with status filtering"""
        print("\n=== Testing GET /api/goals with status filtering ===")
        
        # Test with on_track filter
        response = requests.get(f"{API_URL}/goals?status_filter=on_track", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get goals with status filter: {response.text}")
        
        goals = response.json()
        print(f"Found {len(goals)} on_track goals")
        
        # Verify all returned goals have on_track status
        for goal in goals:
            self.assertEqual(goal["status"], "on_track", f"Goal {goal['id']} has incorrect status: {goal['status']}")
            
        # Test with at_risk filter
        response = requests.get(f"{API_URL}/goals?status_filter=at_risk", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get goals with at_risk filter: {response.text}")
        
        goals = response.json()
        print(f"Found {len(goals)} at_risk goals")
        
        # Verify all returned goals have at_risk status
        for goal in goals:
            self.assertEqual(goal["status"], "at_risk", f"Goal {goal['id']} has incorrect status: {goal['status']}")
            
        # Test with off_track filter
        response = requests.get(f"{API_URL}/goals?status_filter=off_track", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get goals with off_track filter: {response.text}")
        
        goals = response.json()
        print(f"Found {len(goals)} off_track goals")
        
        # Verify all returned goals have off_track status
        for goal in goals:
            self.assertEqual(goal["status"], "off_track", f"Goal {goal['id']} has incorrect status: {goal['status']}")
            
        # Test with comments included
        response = requests.get(f"{API_URL}/goals?include_comments=true", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get goals with comments: {response.text}")
        
        goals = response.json()
        print(f"Found {len(goals)} goals with comments field")
        
        # Verify goals have the latest_comment field (may be null for some)
        for goal in goals:
            self.assertIn("latest_comment", goal, f"Goal {goal['id']} missing latest_comment field")
            self.assertIn("latest_comment_timestamp", goal, f"Goal {goal['id']} missing latest_comment_timestamp field")
            self.assertIn("latest_comment_user", goal, f"Goal {goal['id']} missing latest_comment_user field")
            
        print("✅ Goals endpoint with status filtering test passed")

    def test_02_activities_endpoint(self):
        """Test the activities endpoint"""
        print("\n=== Testing GET /api/activities ===")
        
        # Test activities endpoint
        response = requests.get(f"{API_URL}/activities", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get activities: {response.text}")
        
        activities = response.json()
        print(f"Found {len(activities)} activities")
        
        # Verify activities have required fields
        if activities:
            activity = activities[0]
            required_fields = ["id", "type", "title", "description", "user_id", "user_name", "timestamp"]
            for field in required_fields:
                self.assertIn(field, activity, f"Activity missing required field: {field}")
                
        # Test with activity type filter
        if activities and "type" in activities[0]:
            activity_type = activities[0]["type"]
            response = requests.get(f"{API_URL}/activities?activity_type={activity_type}", headers=self.admin_headers)
            self.assertEqual(response.status_code, 200, f"Failed to get activities with type filter: {response.text}")
            
            filtered_activities = response.json()
            print(f"Found {len(filtered_activities)} activities with type {activity_type}")
            
            # Verify all returned activities have the specified type
            for activity in filtered_activities:
                self.assertEqual(activity["type"], activity_type, f"Activity {activity['id']} has incorrect type: {activity['type']}")
                
        # Test with limit parameter
        limit = 5
        response = requests.get(f"{API_URL}/activities?limit={limit}", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get activities with limit: {response.text}")
        
        limited_activities = response.json()
        self.assertLessEqual(len(limited_activities), limit, f"Got {len(limited_activities)} activities, expected at most {limit}")
        
        print("✅ Activities endpoint test passed")

    def test_03_unread_activities_count_endpoint(self):
        """Test the unread activities count endpoint"""
        print("\n=== Testing GET /api/activities/unread-count ===")
        
        # Test unread activities count endpoint
        response = requests.get(f"{API_URL}/activities/unread-count", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get unread activities count: {response.text}")
        
        data = response.json()
        self.assertIn("unread_count", data, "Response missing unread_count field")
        self.assertIsInstance(data["unread_count"], int, "unread_count should be an integer")
        
        print(f"Unread activities count: {data['unread_count']}")
        print("✅ Unread activities count endpoint test passed")

    def test_04_comment_prompt_endpoint(self):
        """Test the comment prompt endpoint"""
        print("\n=== Testing GET /api/goals/{goal_id}/comment-prompt ===")
        
        if not self.test_goal_id:
            self.skipTest("No test goal available")
            
        # Test with different statuses
        for status in ["on_track", "at_risk", "off_track"]:
            response = requests.get(
                f"{API_URL}/goals/{self.test_goal_id}/comment-prompt?status={status}", 
                headers=self.admin_headers
            )
            self.assertEqual(response.status_code, 200, f"Failed to get comment prompt for status {status}: {response.text}")
            
            data = response.json()
            required_fields = ["prompt", "status", "goal_title", "additional_context"]
            for field in required_fields:
                self.assertIn(field, data, f"Comment prompt response missing required field: {field}")
                
            # Verify additional_context has expected fields
            additional_context = data["additional_context"]
            self.assertIn("current_progress", additional_context, "Missing current_progress in additional_context")
            self.assertIn("progress_percentage", additional_context, "Missing progress_percentage in additional_context")
            self.assertIn("time_remaining", additional_context, "Missing time_remaining in additional_context")
            
            print(f"Comment prompt for {status}: {data['prompt']}")
            
        print("✅ Comment prompt endpoint test passed")

    def test_05_goal_progress_update_endpoint(self):
        """Test the goal progress update endpoint"""
        print("\n=== Testing POST /api/goals/{goal_id}/progress ===")
        
        if not self.test_goal_id:
            self.skipTest("No test goal available")
            
        # Get current goal details
        response = requests.get(f"{API_URL}/goals/{self.test_goal_id}", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get goal details: {response.text}")
        
        goal = response.json()
        current_value = goal["current_value"]
        target_value = goal["target_value"]
        current_status = goal["status"]
        
        # Create progress update with status change
        new_value = current_value + (target_value - current_value) * 0.1  # Increase by 10% of remaining
        new_status = "at_risk" if current_status != "at_risk" else "on_track"
        
        progress_data = {
            "goal_id": self.test_goal_id,
            "new_value": new_value,
            "status": new_status,
            "comment": "Test comment for enhanced progress update"
        }
        
        response = requests.post(
            f"{API_URL}/goals/{self.test_goal_id}/progress", 
            json=progress_data,
            headers=self.admin_headers
        )
        self.assertEqual(response.status_code, 200, f"Failed to update goal progress: {response.text}")
        
        data = response.json()
        self.assertIn("message", data, "Response missing message field")
        self.assertIn("progress_percentage", data, "Response missing progress_percentage field")
        
        print(f"Progress update response: {data}")
        
        # Verify goal was updated
        response = requests.get(f"{API_URL}/goals/{self.test_goal_id}", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get updated goal: {response.text}")
        
        updated_goal = response.json()
        self.assertEqual(updated_goal["current_value"], new_value, "Goal current_value not updated correctly")
        self.assertEqual(updated_goal["status"], new_status, "Goal status not updated correctly")
        
        # Verify activities were created
        response = requests.get(f"{API_URL}/activities", headers=self.admin_headers)
        self.assertEqual(response.status_code, 200, f"Failed to get activities after update: {response.text}")
        
        activities = response.json()
        
        # Check for progress_updated activity
        found_progress_activity = False
        for activity in activities:
            if (activity["goal_id"] == self.test_goal_id and 
                activity["type"] == "progress_updated" and
                self.admin_user_id == activity["user_id"]):
                found_progress_activity = True
                # Verify metadata contains expected fields
                self.assertIn("metadata", activity, "Activity missing metadata field")
                metadata = activity["metadata"]
                self.assertIn("progress_value", metadata, "Metadata missing progress_value field")
                self.assertIn("target_value", metadata, "Metadata missing target_value field")
                self.assertIn("status", metadata, "Metadata missing status field")
                self.assertIn("has_comment", metadata, "Metadata missing has_comment field")
                break
                
        self.assertTrue(found_progress_activity, "No progress_updated activity created")
        
        # If status changed, check for status_changed activity
        if current_status != new_status:
            found_status_activity = False
            for activity in activities:
                if (activity["goal_id"] == self.test_goal_id and 
                    activity["type"] == "status_changed" and
                    self.admin_user_id == activity["user_id"]):
                    found_status_activity = True
                    # Verify metadata contains expected fields
                    self.assertIn("metadata", activity, "Activity missing metadata field")
                    metadata = activity["metadata"]
                    self.assertIn("previous_status", metadata, "Metadata missing previous_status field")
                    self.assertIn("new_status", metadata, "Metadata missing new_status field")
                    self.assertEqual(metadata["previous_status"], current_status, "Incorrect previous_status in metadata")
                    self.assertEqual(metadata["new_status"], new_status, "Incorrect new_status in metadata")
                    break
                    
            self.assertTrue(found_status_activity, "No status_changed activity created")
        
        print("✅ Goal progress update endpoint test passed")

def main():
    """Main test runner"""
    unittest.main(verbosity=2)

if __name__ == "__main__":
    sys.exit(main())