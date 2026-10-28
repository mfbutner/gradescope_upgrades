from enum import Enum

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from ocr import azure_docintel, trocr

app = FastAPI()


class Engine(str, Enum):
    trocr = "trocr"
    azure = "azure"


class OcrRequest(BaseModel):
    image_url: str
    engine: Engine


class OcrResponse(BaseModel):
    text: str


@app.post("/ocr", response_model=OcrResponse)
def ocr(req: OcrRequest) -> OcrResponse:
    try:
        if req.engine == Engine.trocr:
            text = trocr.run(req.image_url)
        else:
            text = azure_docintel.run(req.image_url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return OcrResponse(text=text)
