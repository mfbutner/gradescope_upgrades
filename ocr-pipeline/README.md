# OCR Pipeline

FastAPI service that OCRs a public (S3) image URL using either TrOCR or Azure Document Intelligence.

## Setup

```bash
cd ocr-pipeline
uv sync
cp .env.example .env   # fill in Azure Doc Intelligence endpoint + key
```

## Run

```bash
uv run --env-file .env uvicorn app:app --reload
```

## Test

```bash
uv run pytest        # light: mocked, no torch/model
```

Real TrOCR test (heavy, run in Colab, not on your laptop). Put sample images in `tests/images/`
(optional `sample1.txt` next to `sample1.png` = expected text), push the branch, then in a Colab cell:

```python
!pip install -q uv
!git clone -b alex-ocr-pipeline <repo-url> repo
%cd repo/ocr-pipeline
!uv sync --extra trocr
!uv run pytest -m trocr -s
```

Run the server with real TrOCR: `uv run --extra trocr uvicorn app:app`.

## Usage

```bash
curl -X POST localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://your-bucket.s3.amazonaws.com/submission.png", "engine": "trocr"}'
```

`engine` is `"trocr"` or `"azure"`. Response: `{"text": "..."}`.

First `trocr` call downloads the model (~1.3GB) and is slow; subsequent calls reuse it.
