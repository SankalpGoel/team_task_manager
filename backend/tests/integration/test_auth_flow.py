from tests.helpers import API, auth_headers, signup


async def test_signup_creates_user_and_admin_workspace(client):
    data = await signup(client, "owner@acme.test", name="Owner One")
    assert data["user"]["email"] == "owner@acme.test"
    assert data["access_token"] and data["refresh_token"]

    me = await client.get(f"{API}/auth/me", headers=auth_headers(data["access_token"]))
    assert me.status_code == 200
    memberships = me.json()["memberships"]
    assert len(memberships) == 1
    assert memberships[0]["role"] == "admin"


async def test_duplicate_signup_conflicts(client):
    await signup(client, "dupe@acme.test")
    r = await client.post(
        f"{API}/auth/signup",
        json={"email": "dupe@acme.test", "full_name": "X", "password": "Password123"},
    )
    assert r.status_code == 409


async def test_login_success_and_generic_failure(client):
    await signup(client, "login@acme.test", password="Password123")

    ok = await client.post(
        f"{API}/auth/login", json={"email": "login@acme.test", "password": "Password123"}
    )
    assert ok.status_code == 200
    assert ok.json()["access_token"]

    bad = await client.post(
        f"{API}/auth/login", json={"email": "login@acme.test", "password": "wrong"}
    )
    assert bad.status_code == 401

    unknown = await client.post(
        f"{API}/auth/login", json={"email": "nobody@acme.test", "password": "whatever"}
    )
    assert unknown.status_code == 401


async def test_refresh_rejects_access_token(client):
    data = await signup(client, "refresh@acme.test")

    good = await client.post(
        f"{API}/auth/refresh", json={"refresh_token": data["refresh_token"]}
    )
    assert good.status_code == 200
    assert good.json()["access_token"]

    # Passing an access token where a refresh token is expected must fail.
    bad = await client.post(
        f"{API}/auth/refresh", json={"refresh_token": data["access_token"]}
    )
    assert bad.status_code == 401


async def test_change_password_then_login(client):
    data = await signup(client, "changepw@acme.test", password="Password123")
    headers = auth_headers(data["access_token"])

    r = await client.post(
        f"{API}/auth/change-password",
        json={"old_password": "Password123", "new_password": "NewPass456"},
        headers=headers,
    )
    assert r.status_code == 204

    old = await client.post(
        f"{API}/auth/login", json={"email": "changepw@acme.test", "password": "Password123"}
    )
    assert old.status_code == 401

    new = await client.post(
        f"{API}/auth/login", json={"email": "changepw@acme.test", "password": "NewPass456"}
    )
    assert new.status_code == 200


async def test_weak_password_rejected(client):
    r = await client.post(
        f"{API}/auth/signup",
        json={"email": "weak@acme.test", "full_name": "Weak", "password": "short"},
    )
    assert r.status_code == 422
