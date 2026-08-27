from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from app.auth.service import (
    forgot_password, login_user, logout_user, refresh_access_token,
    register_user, resend_verification_code, reset_password,
    verify_email, verify_login_challenge, verify_totp_login_challenge, update_user_profile,
)
from app.core.request_context import get_request_context
from app.db.session import get_db

router = APIRouter(tags=["auth"])

class SignupRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]

class ChallengeRequest(BaseModel):
    email: EmailStr
    code: Annotated[str, Field(min_length=4, max_length=12)]

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: Annotated[str, Field(min_length=4, max_length=12)]
    new_password: Annotated[str, Field(min_length=8)]

class ResendRequest(BaseModel):
    email: EmailStr

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None
    all_devices: bool = False

@router.post("/signup")
def signup(p: SignupRequest, db: Session = Depends(get_db)):
    return register_user(db, p.email, p.password, full_name=p.full_name, phone=p.phone, country=p.country, date_of_birth=p.date_of_birth)

@router.get("/verify")
def verify(token: str, db: Session = Depends(get_db)):
    return verify_email(db, token)

@router.post("/resend-verification")
def resend(p: ResendRequest, db: Session = Depends(get_db)):
    return resend_verification_code(db, p.email)

@router.post("/login")
def login(p: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return login_user(db, p.email, p.password, ip=ctx.ip_address, ua=ctx.user_agent)

@router.post("/login/challenge")
def challenge(p: ChallengeRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return verify_login_challenge(db, p.email, p.code, ip=ctx.ip_address, ua=ctx.user_agent)

@router.post("/login/totp")
def totp_challenge(p: ChallengeRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return verify_totp_login_challenge(db, p.email, p.code, ip=ctx.ip_address, ua=ctx.user_agent)

@router.post("/forgot-password")
def forgot(p: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return forgot_password(db, p.email, ip=ctx.ip_address)

@router.post("/reset-password")
def reset(p: ResetPasswordRequest, db: Session = Depends(get_db)):
    return reset_password(db, p.email, p.code, p.new_password)

@router.post("/refresh")
def refresh(p: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return refresh_access_token(db, p.refresh_token, ip=ctx.ip_address, ua=ctx.user_agent)

@router.post("/logout")
def logout(p: LogoutRequest, request: Request, db: Session = Depends(get_db)):
    ctx = get_request_context(request)
    return logout_user(db, refresh_token=p.refresh_token, ip=ctx.ip_address, ua=ctx.user_agent, all_devices=p.all_devices)
