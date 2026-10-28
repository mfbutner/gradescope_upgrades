# OCR Pipeline

FastAPI service that OCRs a public (S3) image URL. `POST /ocr` takes `{"image_url": ..., "engine": ...}` and returns `{"text": ...}`.

Engines:
- `trocr`: Hugging Face TrOCR model, runs inside this service (heavy, needs the `trocr` extra).
- `azure`: Azure Document Intelligence. Not integrated or tested yet; owned by someone else.

## Setup

```bash
cd ocr-pipeline
uv sync                # light install: API + test deps only (no torch)
cp .env.example .env   # only needed for the azure engine
```

`uv sync` installs the light dependencies. `uv sync --extra trocr` additionally installs torch + transformers (several GB); avoid this on a laptop.

## Tests

| Test file | What it checks | Runs real OCR? | Where to run |
|---|---|---|---|
| `tests/test_app.py` | The API is wired correctly: `POST /ocr` with `engine: trocr` calls `trocr.run` and returns its text. `trocr.run` is mocked. | No | Anywhere (about 1 second) |
| `tests/test_trocr_integration.py` | The real TrOCR model reads every image in `tests/images/`. Fails if the output is empty. If a `.txt` with the same name sits next to an image (e.g. `hello_world.txt` for `hello_world.jpg`), it also fails when the text is less than 90% similar to it. | Yes | Colab (downloads a ~1.3GB model) |

### Run the real TrOCR tests (Colab)

Add images to `tests/images/` (optionally with a `.txt` of the expected text), push the branch, then in a Colab cell:

```python
%cd /content
!rm -rf repo
!pip install -q uv
!git clone -b alex-ocr-pipeline https://github.com/mfbutner/gradescope_upgrades repo
%cd repo/ocr-pipeline
!uv sync --extra trocr
!uv run pytest -m trocr -s
```

## Run the server

```bash
uv run uvicorn app:app --reload                   # API only; the trocr engine fails without the extra
uv run --extra trocr uvicorn app:app              # API + real TrOCR (heavy)
uv run --env-file .env uvicorn app:app            # API + azure credentials
```

Try it:

```bash
curl -X POST localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://your-bucket.s3.amazonaws.com/submission.png", "engine": "trocr"}'
```

The first `trocr` request downloads the model (~1.3GB) and is slow; later requests reuse it.
