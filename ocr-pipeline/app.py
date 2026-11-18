from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ocr import trocr

app = FastAPI()


class OcrRequest(BaseModel):
    image_url: str


class OcrResponse(BaseModel):
    text: str


@app.post("/ocr", response_model=OcrResponse)
def ocr(req: OcrRequest) -> OcrResponse:
    try:
        text = trocr.run(req.image_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return OcrResponse(text=text)
