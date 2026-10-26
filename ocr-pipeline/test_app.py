from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)

def test_ocr_routes_to_trocr():
    with patch("app.trocr.run", return_value="hello world") as mock_run:
        resp = client.post("/ocr", json={"image_url": "http://x/img.png", "engine": "trocr"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "hello world"}
    mock_run.assert_called_once_with("http://x/img.png")

def test_ocr_routes_to_azure():
    with patch("app.azure_docintel.run", return_value="hi") as mock_run:
        resp = client.post("/ocr", json={"image_url": "http://x/img.png", "engine": "azure"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "hi"}
    mock_run.assert_called_once_with("http://x/img.png")

def test_ocr_engine_failure_returns_502():
    with patch("app.trocr.run", side_effect=RuntimeError("boom")):
        resp = client.post("/ocr", json={"image_url": "http://x/img.png", "engine": "trocr"})
    assert resp.status_code == 502
