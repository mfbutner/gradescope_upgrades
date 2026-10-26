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
uv run pytest
```

## Usage

```bash
curl -X POST localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://your-bucket.s3.amazonaws.com/submission.png", "engine": "trocr"}'
```

`engine` is `"trocr"` or `"azure"`. Response: `{"text": "..."}`.

First `trocr` call downloads the model (~1.3GB) and is slow; subsequent calls reuse it.
