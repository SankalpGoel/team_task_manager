from tests.helpers import API, auth_headers, first_workspace_id, signup


async def _add_member(client, admin_token, workspace_id, email, role="member"):
    """Invite + accept flow that lands `email` in the workspace with `role`."""
    inv = await client.post(
        f"{API}/workspaces/{workspace_id}/invitations",
        json={"email": email, "role": role},
        headers=auth_headers(admin_token),
    )
    assert inv.status_code == 201, inv.text
    token = inv.json()["token"]

    member = await signup(client, email)
    accept = await client.post(
        f"{API}/invitations/{token}/accept",
        headers=auth_headers(member["access_token"]),
    )
    assert accept.status_code == 200, accept.text
    return member


async def test_member_cannot_create_project(client):
    admin = await signup(client, "admin1@acme.test", name="Admin One")
    ws = await first_workspace_id(client, admin["access_token"])
    member = await _add_member(client, admin["access_token"], ws, "member1@acme.test")

    r = await client.post(
        f"{API}/workspaces/{ws}/projects",
        json={"name": "Members cannot make this"},
        headers=auth_headers(member["access_token"]),
    )
    assert r.status_code == 403


async def test_member_can_read_projects(client):
    admin = await signup(client, "admin2@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    member = await _add_member(client, admin["access_token"], ws, "member2@acme.test")

    r = await client.get(
        f"{API}/workspaces/{ws}/projects", headers=auth_headers(member["access_token"])
    )
    assert r.status_code == 200


async def test_cross_tenant_access_returns_404(client):
    a = await signup(client, "tenantA@acme.test")
    b = await signup(client, "tenantB@acme.test")
    ws_a = await first_workspace_id(client, a["access_token"])

    # B has no membership in A's workspace → existence must not leak (404, not 403).
    r = await client.get(
        f"{API}/workspaces/{ws_a}/projects", headers=auth_headers(b["access_token"])
    )
    assert r.status_code == 404


async def test_unauthenticated_request_rejected(client):
    a = await signup(client, "tenantC@acme.test")
    ws = await first_workspace_id(client, a["access_token"])
    r = await client.get(f"{API}/workspaces/{ws}/projects")
    assert r.status_code in (401, 403)
