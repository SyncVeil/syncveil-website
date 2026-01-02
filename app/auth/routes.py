from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth.service import login_user, register_user, verify_email
from app.db.session import get_db

router = APIRouter(tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    return register_user(db, payload.email, payload.password)


@router.get("/verify")
def verify(token: str, db: Session = Depends(get_db)):
    return verify_email(db, token)


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, payload.email, payload.password)
