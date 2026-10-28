import io

import requests
from PIL import Image

_MODEL_NAME = "microsoft/trocr-base-handwritten"

_processor = None
_model = None

def _load():
    global _processor, _model
    if _model is None:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        _processor = TrOCRProcessor.from_pretrained(_MODEL_NAME)
        _model = VisionEncoderDecoderModel.from_pretrained(_MODEL_NAME)
    return _processor, _model

def run(image_url: str) -> str:
    processor, model = _load()

    resp = requests.get(image_url, timeout=30)
    resp.raise_for_status()
    image = Image.open(io.BytesIO(resp.content)).convert("RGB")

    pixel_values = processor(images=image, return_tensors="pt").pixel_values
    generated_ids = model.generate(pixel_values)
    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
