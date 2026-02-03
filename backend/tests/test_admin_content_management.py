"""
Test suite for Admin Content Management endpoints including:
- Payment Settings (Razorpay keys management)
- Courses CRUD (Create, Read, Update, Delete)
- Strategies CRUD (Create, Read, Update, Delete)
- Public Strategies endpoint
"""
import pytest
import requests
import os
import subprocess
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - will be created in setup
TEST_SESSION_TOKEN = None
TEST_USER_ID = None


def create_admin_session():
    """Create admin session for testing"""
    global TEST_SESSION_TOKEN, TEST_USER_ID
    
    timestamp = int(datetime.now().timestamp() * 1000)
    TEST_USER_ID = f"admin-content-{timestamp}"
    TEST_SESSION_TOKEN = f"admin_content_session_{timestamp}"
    
    mongo_script = f"""
    use('test_database');
    db.users.deleteMany({{user_id: /admin-content-/}});
    db.user_sessions.deleteMany({{session_token: /admin_content_session_/}});
    db.users.insertOne({{
      user_id: '{TEST_USER_ID}',
      email: 'maaktanwar@gmail.com',
      name: 'Content Test Admin',
      is_admin: true,
      is_blocked: false,
      has_free_access: true,
      created_at: new Date()
    }});
    db.user_sessions.insertOne({{
      user_id: '{TEST_USER_ID}',
      session_token: '{TEST_SESSION_TOKEN}',
      expires_at: new Date(Date.now() + 7*24*60*60*1000),
      created_at: new Date()
    }});
    """
    subprocess.run(['mongosh', '--quiet', '--eval', mongo_script], capture_output=True)
    return TEST_SESSION_TOKEN


def cleanup_admin_session():
    """Cleanup admin session after testing"""
    cleanup_script = f"""
    use('test_database');
    db.users.deleteMany({{user_id: /admin-content-/}});
    db.user_sessions.deleteMany({{session_token: /admin_content_session_/}});
    db.courses.deleteMany({{id: /TEST_/}});
    db.strategies.deleteMany({{id: /TEST_/}});
    """
    subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)


class TestPaymentSettings:
    """Test Payment Settings endpoints (Razorpay keys management)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        create_admin_session()
        yield
        cleanup_admin_session()
    
    def test_get_payment_settings(self):
        """GET /api/admin/settings/payment - Should return payment settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings/payment",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'razorpay_key_id' in data
        assert 'razorpay_key_secret' in data
        assert 'is_configured' in data
        
        # is_configured should be boolean
        assert isinstance(data['is_configured'], bool)
        print(f"✓ Payment settings endpoint returns correct structure, is_configured={data['is_configured']}")
    
    def test_get_payment_settings_unauthorized(self):
        """GET /api/admin/settings/payment - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/settings/payment")
        assert response.status_code == 401
        print("✓ Payment settings correctly rejects unauthorized requests")
    
    def test_update_payment_settings(self):
        """PUT /api/admin/settings/payment - Should update Razorpay keys"""
        new_settings = {
            "razorpay_key_id": "rzp_test_pytest123456",
            "razorpay_key_secret": "secret_pytest_test123"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/payment",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=new_settings
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['message'] == "Payment settings updated successfully"
        
        # Verify via GET
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/settings/payment",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        verify_data = verify_response.json()
        assert verify_data['razorpay_key_id'] == "rzp_test_pytest123456"
        assert verify_data['razorpay_key_secret'] == "***"  # Secret should be masked
        assert verify_data['is_configured'] == True
        print("✓ Payment settings update persists correctly")
    
    def test_update_payment_settings_partial(self):
        """PUT /api/admin/settings/payment - Should allow partial updates"""
        # Only update key_id
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/payment",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"razorpay_key_id": "rzp_test_partial_update"}
        )
        assert response.status_code == 200
        print("✓ Partial payment settings update works")
    
    def test_update_payment_settings_unauthorized(self):
        """PUT /api/admin/settings/payment - Should fail without auth"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/payment",
            headers={"Content-Type": "application/json"},
            json={"razorpay_key_id": "test"}
        )
        assert response.status_code == 401
        print("✓ Payment settings update correctly rejects unauthorized requests")


class TestPublicStrategiesEndpoint:
    """Test public strategies endpoint (no auth required)"""
    
    def test_get_strategies_no_auth(self):
        """GET /api/strategies - Should return strategies without authentication"""
        response = requests.get(f"{BASE_URL}/api/strategies")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # Should have at least 5 default strategies
        
        # Verify strategy structure
        strategy = data[0]
        required_fields = ['id', 'title', 'description', 'category', 'content', 'difficulty']
        for field in required_fields:
            assert field in strategy, f"Missing field: {field}"
        
        print(f"✓ Public strategies endpoint returns {len(data)} strategies")
    
    def test_strategies_have_markdown_content(self):
        """GET /api/strategies - Strategies should have markdown content"""
        response = requests.get(f"{BASE_URL}/api/strategies")
        data = response.json()
        
        for strategy in data:
            assert len(strategy['content']) > 50, f"Strategy {strategy['id']} has insufficient content"
            # Check for markdown indicators
            assert '##' in strategy['content'] or '**' in strategy['content'] or '-' in strategy['content'], \
                f"Strategy {strategy['id']} content doesn't appear to be markdown"
        
        print("✓ All strategies have markdown content")


class TestAdminCoursesEndpoints:
    """Test Admin Courses CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        create_admin_session()
        yield
        cleanup_admin_session()
    
    def test_get_admin_courses(self):
        """GET /api/admin/courses - Should return courses list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/courses",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin courses endpoint returns {len(data)} courses")
    
    def test_get_admin_courses_unauthorized(self):
        """GET /api/admin/courses - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/courses")
        assert response.status_code == 401
        print("✓ Admin courses correctly rejects unauthorized requests")
    
    def test_create_course(self):
        """POST /api/admin/courses - Should create a new course"""
        new_course = {
            "id": "TEST_pytest_course_001",
            "title": "Pytest Test Course",
            "description": "A test course created by pytest",
            "video_url": "https://youtube.com/test",
            "duration": "2 hours",
            "level": "Beginner",
            "category": "Technical Analysis",
            "modules": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/courses",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=new_course
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['message'] == "Course created successfully"
        assert data['course']['id'] == "TEST_pytest_course_001"
        assert data['course']['title'] == "Pytest Test Course"
        
        # Verify via GET
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/courses",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        courses = verify_response.json()
        course_ids = [c['id'] for c in courses]
        assert "TEST_pytest_course_001" in course_ids
        print("✓ Course created and persisted successfully")
    
    def test_create_duplicate_course(self):
        """POST /api/admin/courses - Should fail for duplicate course ID"""
        course = {
            "id": "TEST_duplicate_course",
            "title": "Duplicate Test",
            "description": "Test",
            "duration": "1 hour",
            "level": "Beginner",
            "category": "Technical Analysis",
            "modules": []
        }
        
        # Create first
        requests.post(
            f"{BASE_URL}/api/admin/courses",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=course
        )
        
        # Try to create duplicate
        response = requests.post(
            f"{BASE_URL}/api/admin/courses",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=course
        )
        assert response.status_code == 400
        assert "already exists" in response.json()['detail']
        print("✓ Duplicate course creation correctly rejected")
    
    def test_update_course(self):
        """PUT /api/admin/courses/{id} - Should update an existing course"""
        # First create a course
        course = {
            "id": "TEST_update_course",
            "title": "Original Title",
            "description": "Original description",
            "duration": "1 hour",
            "level": "Beginner",
            "category": "Technical Analysis",
            "modules": []
        }
        requests.post(
            f"{BASE_URL}/api/admin/courses",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=course
        )
        
        # Update the course
        updated_course = {
            "id": "TEST_update_course",
            "title": "Updated Title",
            "description": "Updated description",
            "duration": "3 hours",
            "level": "Advanced",
            "category": "Options Trading",
            "modules": []
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/courses/TEST_update_course",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=updated_course
        )
        assert response.status_code == 200
        assert response.json()['message'] == "Course updated successfully"
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/courses",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        courses = verify_response.json()
        updated = next((c for c in courses if c['id'] == "TEST_update_course"), None)
        assert updated is not None
        assert updated['title'] == "Updated Title"
        assert updated['level'] == "Advanced"
        print("✓ Course updated successfully")
    
    def test_delete_course(self):
        """DELETE /api/admin/courses/{id} - Should delete a course"""
        # First create a course
        course = {
            "id": "TEST_delete_course",
            "title": "To Be Deleted",
            "description": "This will be deleted",
            "duration": "1 hour",
            "level": "Beginner",
            "category": "Technical Analysis",
            "modules": []
        }
        requests.post(
            f"{BASE_URL}/api/admin/courses",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=course
        )
        
        # Delete the course
        response = requests.delete(
            f"{BASE_URL}/api/admin/courses/TEST_delete_course",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        assert response.json()['message'] == "Course deleted successfully"
        
        # Verify deletion
        verify_response = requests.get(
            f"{BASE_URL}/api/admin/courses",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        courses = verify_response.json()
        course_ids = [c['id'] for c in courses]
        assert "TEST_delete_course" not in course_ids
        print("✓ Course deleted successfully")
    
    def test_delete_nonexistent_course(self):
        """DELETE /api/admin/courses/{id} - Should return 404 for nonexistent course"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/courses/nonexistent_course_xyz",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 404
        print("✓ Delete nonexistent course returns 404")


class TestAdminStrategiesEndpoints:
    """Test Admin Strategies CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        create_admin_session()
        yield
        cleanup_admin_session()
    
    def test_get_admin_strategies(self):
        """GET /api/admin/strategies - Should return strategies list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/strategies",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # Should have at least 5 default strategies
        print(f"✓ Admin strategies endpoint returns {len(data)} strategies")
    
    def test_get_admin_strategies_unauthorized(self):
        """GET /api/admin/strategies - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/strategies")
        assert response.status_code == 401
        print("✓ Admin strategies correctly rejects unauthorized requests")
    
    def test_create_strategy(self):
        """POST /api/admin/strategies - Should create a new strategy"""
        new_strategy = {
            "id": "TEST_pytest_strategy_001",
            "title": "Pytest Test Strategy",
            "description": "A test strategy created by pytest",
            "category": "Swing Trading",
            "content": "## Test Strategy\n\nThis is a test strategy with **markdown** content.\n\n- Point 1\n- Point 2",
            "difficulty": "Intermediate",
            "tags": ["pytest", "test", "swing"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/strategies",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=new_strategy
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['message'] == "Strategy created successfully"
        assert data['strategy']['title'] == "Pytest Test Strategy"
        print("✓ Strategy created successfully")
    
    def test_create_strategy_auto_id(self):
        """POST /api/admin/strategies - Should auto-generate ID if not provided"""
        new_strategy = {
            "title": "Auto ID Strategy",
            "description": "Strategy without explicit ID",
            "category": "Intraday",
            "content": "## Auto ID\n\nContent here",
            "difficulty": "Beginner",
            "tags": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/strategies",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=new_strategy
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'id' in data['strategy']
        assert data['strategy']['id'].startswith('strategy-')
        print(f"✓ Strategy auto-generated ID: {data['strategy']['id']}")
    
    def test_update_strategy(self):
        """PUT /api/admin/strategies/{id} - Should update an existing strategy"""
        # First create a strategy
        strategy = {
            "id": "TEST_update_strategy",
            "title": "Original Strategy",
            "description": "Original description",
            "category": "Price Action",
            "content": "## Original\n\nOriginal content",
            "difficulty": "Beginner",
            "tags": ["original"]
        }
        requests.post(
            f"{BASE_URL}/api/admin/strategies",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=strategy
        )
        
        # Update the strategy
        updated_strategy = {
            "title": "Updated Strategy",
            "description": "Updated description",
            "category": "Options",
            "content": "## Updated\n\nUpdated content with more details",
            "difficulty": "Advanced",
            "tags": ["updated", "options"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/strategies/TEST_update_strategy",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=updated_strategy
        )
        assert response.status_code == 200
        assert response.json()['message'] == "Strategy updated successfully"
        print("✓ Strategy updated successfully")
    
    def test_delete_strategy(self):
        """DELETE /api/admin/strategies/{id} - Should delete a strategy"""
        # First create a strategy
        strategy = {
            "id": "TEST_delete_strategy",
            "title": "To Be Deleted",
            "description": "This will be deleted",
            "category": "Risk Management",
            "content": "## Delete Me\n\nContent",
            "difficulty": "Beginner",
            "tags": []
        }
        requests.post(
            f"{BASE_URL}/api/admin/strategies",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=strategy
        )
        
        # Delete the strategy
        response = requests.delete(
            f"{BASE_URL}/api/admin/strategies/TEST_delete_strategy",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        assert response.json()['message'] == "Strategy deleted successfully"
        print("✓ Strategy deleted successfully")
    
    def test_create_strategy_unauthorized(self):
        """POST /api/admin/strategies - Should fail without auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/strategies",
            headers={"Content-Type": "application/json"},
            json={"title": "Test", "description": "Test", "category": "Test", "content": "Test", "difficulty": "Beginner"}
        )
        assert response.status_code == 401
        print("✓ Strategy creation correctly rejects unauthorized requests")


class TestDefaultStrategiesContent:
    """Test that default strategies have proper content"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Clean up custom strategies to test defaults"""
        # Clean up any custom strategies to ensure defaults are returned
        cleanup_script = """
        use('test_database');
        db.strategies.deleteMany({});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
        yield
    
    def test_default_strategies_categories(self):
        """Verify default strategies cover different categories"""
        response = requests.get(f"{BASE_URL}/api/strategies")
        strategies = response.json()
        
        categories = set(s['category'] for s in strategies)
        expected_categories = {'Price Action', 'Swing Trading', 'Options', 'Intraday', 'Risk Management'}
        
        # At least 4 of the 5 expected categories should be present
        matching = categories.intersection(expected_categories)
        assert len(matching) >= 4, f"Expected at least 4 categories, got {len(matching)}: {matching}"
        print(f"✓ Default strategies cover {len(matching)} categories: {matching}")
    
    def test_default_strategies_difficulty_levels(self):
        """Verify default strategies have different difficulty levels"""
        response = requests.get(f"{BASE_URL}/api/strategies")
        strategies = response.json()
        
        difficulties = set(s['difficulty'] for s in strategies)
        expected = {'Beginner', 'Intermediate', 'Advanced'}
        
        # At least 2 difficulty levels should be present
        matching = difficulties.intersection(expected)
        assert len(matching) >= 2, f"Expected at least 2 difficulty levels, got {len(matching)}: {matching}"
        print(f"✓ Default strategies have {len(matching)} difficulty levels: {matching}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
