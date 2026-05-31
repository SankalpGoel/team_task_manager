from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from jose import JWTError

from app.api.deps import get_current_user
from app.api.rate_limit_deps import limit_per_ip
from app.core.database import get_db
from app.core.exceptions import ConflictError, UnauthorizedError, ValidationError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import Membership, Role, User, Workspace
from app.schemas.auth import (
    AccessTokenOnly,
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    MeResponse,
    MembershipBrief,
    RefreshRequest,
    SignupRequest,
    UserOut,
    UserUpdateRequest,
    WorkspaceBrief,
)
from app.utils.slug import unique_slug

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limit_per_ip("signup", limit=10, window_seconds=60))],
)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise ConflictError("Email already registered", {"email": "already in use"})

    full_name = payload.full_name.strip()
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=full_name,
    )
    db.add(user)
    await db.flush()

    first = full_name.split()[0] if full_name else "My"
    workspace = Workspace(
        name=f"{first}'s Workspace",
        slug=unique_slug(f"{first}-workspace"),
        owner_id=user.id,
    )
    db.add(workspace)
    await db.flush()

    db.add(Membership(user_id=user.id, workspace_id=workspace.id, role=Role.ADMIN))
    await db.commit()
    await db.refresh(user)

    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    return AuthResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(limit_per_ip("login", limit=10, window_seconds=60))],
)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    # Generic error message to prevent enumeration
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    return AuthResponse(
        user=UserOut.model_validate(user),
        access_token=access,
        refresh_token=refresh,
    )


@router.post(
    "/refresh",
    response_model=AccessTokenOnly,
    dependencies=[Depends(limit_per_ip("refresh", limit=30, window_seconds=60))],
)
async def refresh_access_token(
    payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> AccessTokenOnly:
    try:
        data = decode_token(payload.refresh_token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired refresh token")
    if data.get("type") != "refresh":
        raise UnauthorizedError("Wrong token type")
    sub = data.get("sub")
    if not sub:
        raise UnauthorizedError("Invalid token payload")
    user = (
        await db.execute(select(User).where(User.id == sub, User.is_active.is_(True)))
    ).scalar_one_or_none()
    if not user:
        raise UnauthorizedError("User not found")
    return AccessTokenOnly(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=MeResponse)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    rows = (
        await db.execute(
            select(Membership)
            .options(selectinload(Membership.workspace))
            .where(Membership.user_id == user.id)
        )
    ).scalars().all()
    memberships = [
        MembershipBrief(
            workspace=WorkspaceBrief.model_validate(m.workspace),
            role=m.role,
        )
        for m in rows
        if m.workspace.deleted_at is None
    ]
    return MeResponse(user=UserOut.model_validate(user), memberships=memberships)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url or None
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not verify_password(payload.old_password, user.password_hash):
        raise ValidationError("Current password is incorrect", {"old_password": "incorrect"})
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
