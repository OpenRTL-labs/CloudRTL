import os
import sys
from datetime import timedelta
import jwt
from fastapi import HTTPException
from sqlalchemy import text

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, engine, test_database_connection
from app.models import User
from app.auth import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    hash_password,
    verify_password,
    create_access_token,
    register,
    login,
    get_me,
    get_current_user,
    JWT_SECRET,
    JWT_ALGORITHM,
)
from fastapi.security import HTTPAuthorizationCredentials

def run_tests():
    print("=== STARTING AUTHENTICATION VERIFICATION TESTS ===")

    # 1. DB Connection
    test_database_connection()
    print("[PASS] Database connection verified.")

    # Clean up test users if existing
    db = SessionLocal()
    try:
        db.query(User).filter(User.username.in_(["testuser1", "testuser2", "dupuser"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    # 2. Password Hashing Verification
    raw_password = "SuperSecretPassword123!"
    hashed = hash_password(raw_password)
    assert hashed != raw_password, "Password was not hashed!"
    assert "$argon2id$" in hashed, f"Expected argon2id hash, got: {hashed}"
    assert verify_password(raw_password, hashed) is True, "Password verification failed for valid password"
    assert verify_password("WrongPassword!", hashed) is False, "Password verification succeeded for invalid password"
    print("[PASS] Password hashing (Argon2 via pwdlib) verified.")

    # 3. JWT Creation and Verification
    token = create_access_token(user_id=999, username="testjwtuser")
    decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert decoded["sub"] == "999", f"Expected sub '999', got {decoded.get('sub')}"
    assert decoded["username"] == "testjwtuser"
    assert "exp" in decoded and "iat" in decoded
    print("[PASS] JWT creation & decoding verified.")

    # 4. Registration Endpoint Verification
    db = SessionLocal()
    try:
        reg_req = RegisterRequest(
            username="testuser1",
            password="StrongPassword123!",
            email="testuser1@example.com",
        )
        created_user = register(reg_req, db)
        assert created_user.id is not None
        assert created_user.username == "testuser1"
        assert created_user.email == "testuser1@example.com"
        assert created_user.created_at is not None

        # Verify safe UserResponse serialization
        safe_response = UserResponse.model_validate(created_user)
        safe_dict = safe_response.model_dump()
        assert "password_hash" not in safe_dict, "CRITICAL: password_hash exposed in response model!"
        assert set(safe_dict.keys()) == {"id", "username", "email", "created_at"}
        print("[PASS] User registration endpoint returned safe response without password_hash.")

        # 5. Verify Database Row in PostgreSQL
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT id, username, email, password_hash, created_at FROM users WHERE username = 'testuser1'")
            ).fetchone()
            assert row is not None, "User row not found in PostgreSQL!"
            assert row.username == "testuser1"
            assert row.email == "testuser1@example.com"
            assert row.password_hash != "StrongPassword123!", "CRITICAL: plaintext password stored in database!"
            assert "$argon2id$" in row.password_hash, "password_hash is not Argon2 hash!"
            print("[PASS] User verified in PostgreSQL database (stored as Argon2 hash, NEVER plaintext).")

        # 6. Verify Duplicate Username Rejection
        dup_user_req = RegisterRequest(
            username="testuser1",
            password="AnotherPassword123!",
            email="another@example.com",
        )
        try:
            register(dup_user_req, db)
            assert False, "Registration should have failed on duplicate username!"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "Username is already registered" in exc.detail
            print("[PASS] Duplicate username correctly rejected with HTTP 400.")

        # 7. Verify Duplicate Email Rejection
        dup_email_req = RegisterRequest(
            username="testuser2",
            password="AnotherPassword123!",
            email="testuser1@example.com",
        )
        try:
            register(dup_email_req, db)
            assert False, "Registration should have failed on duplicate email!"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "Email is already registered" in exc.detail
            print("[PASS] Duplicate email correctly rejected with HTTP 400.")

        # 8. Verify Successful Login
        login_req = LoginRequest(username="testuser1", password="StrongPassword123!")
        login_res = login(login_req, db)
        assert isinstance(login_res, TokenResponse)
        assert login_res.access_token is not None
        assert login_res.token_type == "bearer"
        print("[PASS] Login succeeded and returned JWT access token.")

        # 9. Verify Invalid Login Rejection
        invalid_login_req = LoginRequest(username="testuser1", password="IncorrectPassword")
        try:
            login(invalid_login_req, db)
            assert False, "Login should have failed for wrong password!"
        except HTTPException as exc:
            assert exc.status_code == 401
            print("[PASS] Invalid login (wrong password) rejected with HTTP 401.")

        unknown_user_login = LoginRequest(username="nonexistentuser", password="SomePassword")
        try:
            login(unknown_user_login, db)
            assert False, "Login should have failed for nonexistent user!"
        except HTTPException as exc:
            assert exc.status_code == 401
            print("[PASS] Invalid login (unknown user) rejected with HTTP 401.")

        # 10. Verify /auth/me with Valid Token
        valid_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=login_res.access_token)
        current_user = get_current_user(valid_creds, db)
        assert current_user.username == "testuser1"
        assert current_user.email == "testuser1@example.com"
        me_response = get_me(current_user)
        assert me_response.username == "testuser1"
        print("[PASS] /auth/me dependency works and loads user from PostgreSQL.")

        # 11. Verify /auth/me rejects missing or invalid tokens
        try:
            get_current_user(None, db)
            assert False, "Should reject missing token!"
        except HTTPException as exc:
            assert exc.status_code == 401
            print("[PASS] Missing token correctly rejected with HTTP 401.")

        try:
            bad_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")
            get_current_user(bad_creds, db)
            assert False, "Should reject invalid token!"
        except HTTPException as exc:
            assert exc.status_code == 401
            print("[PASS] Invalid token correctly rejected with HTTP 401.")

        # Expired token test
        expired_token = create_access_token(user_id=created_user.id, username="testuser1", expires_delta=timedelta(seconds=-10))
        try:
            expired_creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
            get_current_user(expired_creds, db)
            assert False, "Should reject expired token!"
        except HTTPException as exc:
            assert exc.status_code == 401
            print("[PASS] Expired token correctly rejected with HTTP 401.")

    finally:
        # Clean up
        db.query(User).filter(User.username.in_(["testuser1", "testuser2"])).delete(synchronize_session=False)
        db.commit()
        db.close()

    print("=== ALL AUTHENTICATION UNIT TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
