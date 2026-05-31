from __future__ import annotations

from httpx import AsyncClient

API = "/api/v1"


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def signup(
    client: AsyncClient,
    email: str,
    *,
    name: str = "Test User",
    password: str = "Password123",
) -> dict:
    r = await client.post(
        f"{API}/auth/signup",
        json={"email": email, "full_name": name, "password": password},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def first_workspace_id(client: AsyncClient, token: str) -> str:
    r = await client.get(f"{API}/auth/me", headers=auth_headers(token))
    assert r.status_code == 200, r.text
    return r.json()["memberships"][0]["workspace"]["id"]


async def create_project(client: AsyncClient, token: str, workspace_id: str, name: str = "P1") -> dict:
    r = await client.post(
        f"{API}/workspaces/{workspace_id}/projects",
        json={"name": name},
        headers=auth_headers(token),
    )
    assert r.status_code == 201, r.text
    return r.json()


async def create_task(client: AsyncClient, token: str, project_id: str, title: str) -> dict:
    r = await client.post(
        f"{API}/projects/{project_id}/tasks",
        json={"title": title},
        headers=auth_headers(token),
    )
    assert r.status_code == 201, r.text
    return r.json()
