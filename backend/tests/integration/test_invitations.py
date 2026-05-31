from tests.helpers import API, auth_headers, first_workspace_id, signup


async def test_invitation_preview_and_accept(client):
    admin = await signup(client, "inviteadmin@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])

    inv = await client.post(
        f"{API}/workspaces/{ws}/invitations",
        json={"email": "invitee@acme.test", "role": "manager"},
        headers=auth_headers(admin["access_token"]),
    )
    assert inv.status_code == 201
    token = inv.json()["token"]

    preview = await client.get(f"{API}/invitations/{token}")
    assert preview.status_code == 200
    body = preview.json()
    assert body["valid"] is True
    assert body["email"] == "invitee@acme.test"
    assert body["role"] == "manager"

    invitee = await signup(client, "invitee@acme.test")
    accept = await client.post(
        f"{API}/invitations/{token}/accept",
        headers=auth_headers(invitee["access_token"]),
    )
    assert accept.status_code == 200

    me = await client.get(f"{API}/auth/me", headers=auth_headers(invitee["access_token"]))
    roles = {m["role"] for m in me.json()["memberships"]}
    assert "manager" in roles


async def test_accept_with_wrong_email_rejected(client):
    admin = await signup(client, "inviteadmin2@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    inv = await client.post(
        f"{API}/workspaces/{ws}/invitations",
        json={"email": "intended@acme.test", "role": "member"},
        headers=auth_headers(admin["access_token"]),
    )
    token = inv.json()["token"]

    other = await signup(client, "someoneelse@acme.test")
    accept = await client.post(
        f"{API}/invitations/{token}/accept",
        headers=auth_headers(other["access_token"]),
    )
    assert accept.status_code == 400


async def test_non_admin_cannot_invite(client):
    admin = await signup(client, "inviteadmin3@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])

    # Land a plain member in the workspace.
    inv = await client.post(
        f"{API}/workspaces/{ws}/invitations",
        json={"email": "plainmember@acme.test", "role": "member"},
        headers=auth_headers(admin["access_token"]),
    )
    member = await signup(client, "plainmember@acme.test")
    await client.post(
        f"{API}/invitations/{inv.json()['token']}/accept",
        headers=auth_headers(member["access_token"]),
    )

    # Member tries to invite someone — admin-only.
    r = await client.post(
        f"{API}/workspaces/{ws}/invitations",
        json={"email": "x@acme.test", "role": "member"},
        headers=auth_headers(member["access_token"]),
    )
    assert r.status_code == 403
