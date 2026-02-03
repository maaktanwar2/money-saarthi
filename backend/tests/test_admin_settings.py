"""
Test suite for Admin Settings endpoints including:
- Theme customization (GET/PUT/POST/presets)
- API provider switching (Yahoo Finance, Upstox, Dhan)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - will be created in setup
TEST_SESSION_TOKEN = None
TEST_USER_ID = None


class TestPublicThemeEndpoint:
    """Test public theme endpoint (no auth required)"""
    
    def test_get_theme_no_auth(self):
        """GET /api/settings/theme - Should return theme without authentication"""
        response = requests.get(f"{BASE_URL}/api/settings/theme")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required theme fields exist
        required_fields = [
            'primary_color', 'secondary_color', 'accent_color',
            'background_color', 'text_color', 'card_background',
            'tab_color', 'tab_active_color', 'font_color',
            'positive_color', 'negative_color', 'mode'
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify mode is valid
        assert data['mode'] in ['dark', 'light']
        print(f"✓ Public theme endpoint returns all {len(required_fields)} required fields")


class TestAdminSettingsEndpoints:
    """Test admin settings endpoints (auth required)"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_session(self):
        """Create admin session for testing"""
        global TEST_SESSION_TOKEN, TEST_USER_ID
        
        # Create admin user and session via mongosh
        import subprocess
        timestamp = int(datetime.now().timestamp() * 1000)
        TEST_USER_ID = f"admin-pytest-{timestamp}"
        TEST_SESSION_TOKEN = f"admin_pytest_session_{timestamp}"
        
        mongo_script = f"""
        use('test_database');
        db.users.deleteMany({{email: 'pytest-admin@test.com'}});
        db.users.insertOne({{
          user_id: '{TEST_USER_ID}',
          email: 'maaktanwar@gmail.com',
          name: 'Pytest Admin',
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
        
        yield
        
        # Cleanup
        cleanup_script = f"""
        use('test_database');
        db.users.deleteMany({{user_id: '{TEST_USER_ID}'}});
        db.user_sessions.deleteMany({{session_token: '{TEST_SESSION_TOKEN}'}});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
    
    def test_get_admin_settings(self):
        """GET /api/admin/settings - Should return API provider and theme settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'api_provider' in data
        assert 'available_providers' in data
        assert 'theme' in data
        
        # Verify available providers include all 3
        provider_ids = [p['id'] for p in data['available_providers']]
        assert 'yahoo_finance' in provider_ids
        assert 'upstox' in provider_ids
        assert 'dhan' in provider_ids
        print(f"✓ Admin settings returns {len(provider_ids)} providers: {provider_ids}")
    
    def test_get_admin_settings_unauthorized(self):
        """GET /api/admin/settings - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 401
        print("✓ Admin settings correctly rejects unauthorized requests")
    
    def test_get_theme_presets(self):
        """GET /api/admin/settings/theme/presets - Should return 6 theme presets"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings/theme/presets",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'presets' in data
        presets = data['presets']
        
        # Should have 6 presets
        assert len(presets) == 6
        
        # Verify preset structure
        expected_preset_ids = ['default_dark', 'ocean_blue', 'midnight_gold', 'forest_green', 'light_clean', 'crimson_red']
        actual_ids = [p['id'] for p in presets]
        for preset_id in expected_preset_ids:
            assert preset_id in actual_ids, f"Missing preset: {preset_id}"
        
        print(f"✓ Theme presets endpoint returns {len(presets)} presets")
    
    def test_update_theme(self):
        """PUT /api/admin/settings/theme - Should update theme settings"""
        new_theme = {
            "primary_color": "#123456",
            "secondary_color": "#654321",
            "mode": "dark"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/theme",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=new_theme
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['message'] == "Theme updated successfully"
        assert data['theme']['primary_color'] == "#123456"
        assert data['theme']['secondary_color'] == "#654321"
        
        # Verify via public endpoint
        verify_response = requests.get(f"{BASE_URL}/api/settings/theme")
        verify_data = verify_response.json()
        assert verify_data['primary_color'] == "#123456"
        print("✓ Theme update persists correctly")
    
    def test_reset_theme(self):
        """POST /api/admin/settings/theme/reset - Should reset theme to defaults"""
        response = requests.post(
            f"{BASE_URL}/api/admin/settings/theme/reset",
            headers={"Authorization": f"Bearer {TEST_SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['message'] == "Theme reset to defaults"
        
        # Verify reset via public endpoint
        verify_response = requests.get(f"{BASE_URL}/api/settings/theme")
        verify_data = verify_response.json()
        # Default primary color is #8b5cf6
        assert verify_data['primary_color'] == "#8b5cf6"
        print("✓ Theme reset to defaults correctly")


class TestAPIProviderSwitching:
    """Test API provider switching functionality"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_session(self):
        """Create admin session for testing"""
        global TEST_SESSION_TOKEN, TEST_USER_ID
        
        import subprocess
        timestamp = int(datetime.now().timestamp() * 1000)
        TEST_USER_ID = f"admin-provider-{timestamp}"
        TEST_SESSION_TOKEN = f"admin_provider_session_{timestamp}"
        
        mongo_script = f"""
        use('test_database');
        db.users.insertOne({{
          user_id: '{TEST_USER_ID}',
          email: 'maaktanwar@gmail.com',
          name: 'Provider Test Admin',
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
        
        yield
        
        cleanup_script = f"""
        use('test_database');
        db.users.deleteMany({{user_id: '{TEST_USER_ID}'}});
        db.user_sessions.deleteMany({{session_token: '{TEST_SESSION_TOKEN}'}});
        """
        subprocess.run(['mongosh', '--quiet', '--eval', cleanup_script], capture_output=True)
    
    def test_switch_to_yahoo_finance(self):
        """PUT /api/admin/settings/provider - Switch to Yahoo Finance"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/provider",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"provider": "yahoo_finance"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['provider'] == "yahoo_finance"
        print("✓ Successfully switched to Yahoo Finance")
    
    def test_switch_to_upstox_without_credentials(self):
        """PUT /api/admin/settings/provider - Upstox should fail without credentials"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/provider",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"provider": "upstox"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "Upstox API credentials not configured" in data['detail']
        print("✓ Upstox correctly requires credentials")
    
    def test_switch_to_dhan_without_credentials(self):
        """PUT /api/admin/settings/provider - Dhan should fail without credentials"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/provider",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"provider": "dhan"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "Dhan API credentials not configured" in data['detail']
        print("✓ Dhan correctly requires credentials")
    
    def test_switch_to_invalid_provider(self):
        """PUT /api/admin/settings/provider - Invalid provider should fail"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/provider",
            headers={
                "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"provider": "invalid_provider"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert data['detail'] == "Invalid provider"
        print("✓ Invalid provider correctly rejected")
    
    def test_provider_switch_unauthorized(self):
        """PUT /api/admin/settings/provider - Should fail without auth"""
        response = requests.put(
            f"{BASE_URL}/api/admin/settings/provider",
            headers={"Content-Type": "application/json"},
            json={"provider": "yahoo_finance"}
        )
        assert response.status_code == 401
        print("✓ Provider switch correctly rejects unauthorized requests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
