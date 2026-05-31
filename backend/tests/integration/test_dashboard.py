from tests.helpers import (
    API,
    auth_headers,
    create_project,
    create_task,
    first_workspace_id,
    signup,
)


async def test_dashboard_status_counts(client):
    admin = await signup(client, "dash1@acme.test")
    token = admin["access_token"]
    ws = await first_workspace_id(client, token)
    proj = await create_project(client, token, ws)

    for title in ("t1", "t2", "t3"):
        await create_task(client, token, proj["id"], title)

    dash = await client.get(f"{API}/workspaces/{ws}/dashboard", headers=auth_headers(token))
    assert dash.status_code == 200
    body = dash.json()
    assert set(body["status_counts"]) == {"todo", "in_progress", "in_review", "done"}
    assert body["status_counts"]["todo"] == 3
    assert any(p["total"] == 3 for p in body["project_progress"])


async def test_dashboard_detects_overdue(client):
    admin = await signup(client, "dash2@acme.test")
    token = admin["access_token"]
    ws = await first_workspace_id(client, token)
    proj = await create_project(client, token, ws)
    t = await create_task(client, token, proj["id"], "late task")

    upd = await client.patch(
        f"{API}/tasks/{t['id']}",
        json={"due_date": "2020-01-01"},
        headers=auth_headers(token),
    )
    assert upd.status_code == 200

    dash = await client.get(f"{API}/workspaces/{ws}/dashboard", headers=auth_headers(token))
    body = dash.json()
    assert body["overdue_count"] >= 1
    assert any(item["id"] == t["id"] for item in body["overdue"])
