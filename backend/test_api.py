from fastapi.testclient import TestClient

from database import SessionLocal
from main import app, current_user
from models import MeetingQuestion


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
        with SessionLocal() as db:
            db.add(MeetingQuestion(meeting_id=meeting_id, question="What changed?", answer="Access was validated."))
            db.commit()
        assert client.delete(f"/api/meetings/{meeting_id}").status_code == 204


def test_api_rejects_requests_without_clerk_identity():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["database"] == "ok"
        response = client.get("/api/meetings")
    assert response.status_code == 401


def test_global_search_and_pdf_export():
    with TestClient(app) as client:
        set_user("test_search_owner")
        created = client.post("/api/meetings", json={"title": "Searchable sync", "participants": ["Ava"]})
        meeting_id = created.json()["id"]
        client.post(
            f"/api/meetings/{meeting_id}/paste-transcript",
            json={"content": "[00:05] Ava: Ship the analytics event pipeline next week."},
        )
        hits = client.get("/api/meetings", params={"query": "analytics event pipeline"})
        assert hits.status_code == 200
        assert any(m["id"] == meeting_id for m in hits.json())
        by_person = client.get("/api/meetings", params={"participant": "Ava"})
        assert by_person.status_code == 200
        assert any(m["id"] == meeting_id for m in by_person.json())
        pdf = client.get(f"/api/meetings/{meeting_id}/export", params={"format": "pdf"})
        assert pdf.status_code == 200
        assert pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        client.delete(f"/api/meetings/{meeting_id}")
