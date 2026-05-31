from tests.helpers import (
    API,
    auth_headers,
    create_project,
    create_task,
    first_workspace_id,
    signup,
)


async def test_task_create_lands_in_todo(client):
    admin = await signup(client, "tasks1@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    proj = await create_project(client, admin["access_token"], ws)

    t = await create_task(client, admin["access_token"], proj["id"], "First task")
    assert t["status"] == "todo"
    assert t["position"] > 0


async def test_board_groups_by_status_in_order(client):
    admin = await signup(client, "tasks2@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    proj = await create_project(client, admin["access_token"], ws)
    for title in ("a", "b", "c"):
        await create_task(client, admin["access_token"], proj["id"], title)

    board = await client.get(
        f"{API}/projects/{proj['id']}/tasks",
        params={"group_by": "status"},
        headers=auth_headers(admin["access_token"]),
    )
    assert board.status_code == 200
    cols = board.json()["columns"]
    assert [c["status"] for c in cols] == ["todo", "in_progress", "in_review", "done"]
    todo = next(c for c in cols if c["status"] == "todo")
    # Created in order, positions strictly ascending.
    positions = [item["position"] for item in todo["items"]]
    assert positions == sorted(positions)
    assert len(positions) == 3


async def test_move_between_neighbours_assigns_midpoint_position(client):
    admin = await signup(client, "tasks3@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    proj = await create_project(client, admin["access_token"], ws)

    t1 = await create_task(client, admin["access_token"], proj["id"], "one")
    t2 = await create_task(client, admin["access_token"], proj["id"], "two")
    t3 = await create_task(client, admin["access_token"], proj["id"], "three")

    # Move t3 to sit between t1 and t2 within the todo column.
    moved = await client.patch(
        f"{API}/tasks/{t3['id']}/move",
        json={"status": "todo", "before_id": t1["id"], "after_id": t2["id"]},
        headers=auth_headers(admin["access_token"]),
    )
    assert moved.status_code == 200
    new_pos = moved.json()["position"]
    assert t1["position"] < new_pos < t2["position"]


async def test_move_changes_status(client):
    admin = await signup(client, "tasks4@acme.test")
    ws = await first_workspace_id(client, admin["access_token"])
    proj = await create_project(client, admin["access_token"], ws)
    t = await create_task(client, admin["access_token"], proj["id"], "to move")

    moved = await client.patch(
        f"{API}/tasks/{t['id']}/move",
        json={"status": "in_progress"},
        headers=auth_headers(admin["access_token"]),
    )
    assert moved.status_code == 200
    assert moved.json()["status"] == "in_progress"
