from fastapi.testclient import TestClient

from main import app, current_user


def set_user(user_id: str) -> None:
    app.dependency_overrides[current_user] = lambda: user_id


def test_meetings_are_private_and_transcript_actions_work():
    with TestClient(app) as client:
        set_user("test_owner_a")
        created = client.post("/api/meetings", json={"title": "Private planning", "participants": ["Ava"]})
        assert created.status_code == 201
        meeting_id = created.json()["id"]

        pasted = client.post(f"/api/meetings/{meeting_id}/paste-transcript", json={"content": "[00:05] Ava: Ship the protected workspace.\n[00:12] Ben: I will validate it."})
        assert pasted.status_code == 201
        assert len(pasted.json()["segments"]) == 2

        action = client.post(f"/api/meetings/{meeting_id}/actions", json={"text": "Validate access", "owner": "Ben"})
        assert action.status_code == 201
        action_id = action.json()["id"]
        updated = client.patch(f"/api/actions/{action_id}", json={"text": "Validate private access", "completed": True})
        assert updated.status_code == 200
        assert updated.json()["completed"] is True

        set_user("test_owner_b")
        assert client.get(f"/api/meetings/{meeting_id}").status_code == 404
        assert client.patch(f"/api/actions/{action_id}", json={"completed": False}).status_code == 404
        assert all(m["id"] != meeting_id for m in client.get("/api/meetings").json())

        set_user("test_owner_a")
        assert client.delete(f"/api/actions/{action_id}").status_code == 204
        assert client.delete(f"/api/meetings/{meeting_id}").status_code == 204


def test_api_rejects_requests_without_clerk_identity():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        response = client.get("/api/meetings")
    assert response.status_code == 401
