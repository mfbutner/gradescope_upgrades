"""Real TrOCR on tests/images/*.png|jpg. Heavy: run in Colab with `uv run --extra trocr pytest -m trocr -s`."""
import functools
import http.server
import threading
from difflib import SequenceMatcher
from pathlib import Path

import pytest

IMAGES = Path(__file__).parent / "images"
SAMPLES = sorted(p for ext in ("png", "jpg", "jpeg") for p in IMAGES.glob(f"*.{ext}"))

pytestmark = pytest.mark.trocr


@pytest.fixture(scope="module")
def base_url():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(IMAGES))
    handler.log_message = lambda *a: None
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


KNOWN_BAD = {"cout_hi_endl.jpg": "TrOCR can't read code symbols like <<"}


def _case(p):
    mark = pytest.mark.xfail(reason=KNOWN_BAD[p.name]) if p.name in KNOWN_BAD else ()
    return pytest.param(p, id=p.name, marks=mark)


@pytest.mark.parametrize("image", [_case(p) for p in SAMPLES])
def test_trocr_reads_image(base_url, image):
    from ocr import trocr

    text = trocr.run(f"{base_url}/{image.name}")
    print(f"\n{image.name} -> {text!r}")
    assert text.strip()

    expected = image.with_suffix(".txt")  # optional ground truth
    if expected.exists():
        ratio = SequenceMatcher(None, text.strip(), expected.read_text().strip()).ratio()
        assert ratio > 0.9, f"similarity {ratio:.2f}"


def test_samples_present():
    assert SAMPLES, "add sample images to tests/images/ (e.g. sample1.png, sample2.png)"
