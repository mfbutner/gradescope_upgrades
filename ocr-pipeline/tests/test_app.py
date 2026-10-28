from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app

client = TestClient(app)

# LITERALLY ONLY CHECK TO SEE IF MY API IS WIRED CORRECTLY -- DOESNT ACTUALLY CALL OCR
def test_ocr_routes_to_trocr():
    with patch("app.trocr.run", return_value="hello world") as mock_run:
        resp = client.post("/ocr", json={"image_url": "http://x/img.png", "engine": "trocr"})
    assert resp.status_code == 200
    assert resp.json() == {"text": "hello world"}
    mock_run.assert_called_once_with("http://x/img.png")
