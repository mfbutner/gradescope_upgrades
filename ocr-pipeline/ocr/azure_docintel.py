import os

from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials import AzureKeyCredential

_client = None

def _load():
    global _client
    if _client is None:
        endpoint = os.environ["AZURE_DOCINTEL_ENDPOINT"]
        key = os.environ["AZURE_DOCINTEL_KEY"]
        _client = DocumentIntelligenceClient(endpoint, AzureKeyCredential(key))
    return _client

def run(image_url: str) -> str:
    client = _load()

    poller = client.begin_analyze_document(
        "prebuilt-read", AnalyzeDocumentRequest(url_source=image_url)
    )
    result = poller.result()
    return result.content
