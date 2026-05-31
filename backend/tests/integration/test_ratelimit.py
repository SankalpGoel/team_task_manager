from tests.helpers import API


async def test_signup_rate_limit_enforced(client):
    """Signup is limited to 10/min/IP; the 11th attempt is rejected with 429."""
    statuses = []
    for i in range(12):
        r = await client.post(
            f"{API}/auth/signup",
            json={
                "email": f"rl{i}@acme.test",
                "full_name": f"User {i}",
                "password": "Password123",
            },
        )
        statuses.append(r.status_code)

    assert statuses[:10] == [201] * 10
    assert 429 in statuses[10:]
