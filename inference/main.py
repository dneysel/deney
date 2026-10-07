import hmac
import json
import os
import asyncio
import time
from typing import Annotated, AsyncIterator

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


app = FastAPI(title="Yerel Sohbet Inference", docs_url=None, redoc_url=None)
SERVICE_TOKEN = os.getenv("INFERENCE_SERVICE_TOKEN", "")
PROVIDER = os.getenv("MODEL_PROVIDER", "simulation").lower()
LLAMACPP_URL = os.getenv("LLAMACPP_URL", "http://127.0.0.1:8080").rstrip("/")
MODEL_NAME = os.getenv("MODEL_NAME", "local-model")
VISION_ENABLED = os.getenv("VISION_ENABLED", "false").lower() == "true"
QUEUE_TIMEOUT = max(1, int(os.getenv("GPU_QUEUE_TIMEOUT_SECONDS", "120")))
GPU_CONCURRENCY = max(1, int(os.getenv("GPU_CONCURRENCY", "1")))
gpu_slots = asyncio.Semaphore(GPU_CONCURRENCY)
metrics = {"requests": 0, "completed": 0, "queue_timeouts": 0, "generated_characters": 0}


class Message(BaseModel):
    role: str
    content: str | list[dict[str, object]] = Field(min_length=1)


class ModelSettings(BaseModel):
    model: str = Field(default=MODEL_NAME, max_length=100)
    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.95, gt=0, le=1)
    max_tokens: int = Field(default=1024, ge=16, le=8192)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=42)
    settings: ModelSettings = Field(default_factory=ModelSettings)


def authorize(authorization: str | None) -> None:
    scheme, _, supplied = (authorization or "").partition(" ")
    if not SERVICE_TOKEN or scheme.lower() != "bearer" or not hmac.compare_digest(supplied, SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


def sse(payload: dict[str, str] | str) -> bytes:
    data = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return f"data: {data}\n\n".encode()


async def simulation(messages: list[Message]) -> AsyncIterator[bytes]:
    content = messages[-1].content
    if isinstance(content, list):
        prompt = " ".join(str(item.get("text", "")) for item in content if item.get("type") == "text")
        prompt = prompt or "gorsel"
    else:
        prompt = content.strip()
    reply = (
        f"Simulasyon yaniti: ‘{prompt}’ istegini aldim. Gercek model baglantisini denemek icin "
        "MODEL_PROVIDER=llamacpp ayarlayin. Bu cevap test amaclidir; bir dil modeli tarafindan uretilmedi."
    )
    for word in reply.split(" "):
        yield sse({"delta": word + " "})
    yield sse("[DONE]")


async def llamacpp(messages: list[Message], settings: ModelSettings) -> AsyncIterator[bytes]:
    request_data = {
        "model": settings.model,
        "messages": [message.model_dump() for message in messages],
        "stream": True,
        "temperature": settings.temperature,
        "top_p": settings.top_p,
        "max_tokens": settings.max_tokens,
    }
    timeout = httpx.Timeout(connect=10, read=None, write=20, pool=5)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", f"{LLAMACPP_URL}/v1/chat/completions", json=request_data) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {}).get("content")
                except (KeyError, IndexError, json.JSONDecodeError):
                    continue
                if delta:
                    yield sse({"delta": delta})
    yield sse("[DONE]")


@app.get("/internal/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "provider": PROVIDER, "gpu_concurrency": str(GPU_CONCURRENCY)}


@app.get("/internal/metrics")
async def internal_metrics(authorization: Annotated[str | None, Header()] = None) -> dict[str, int]:
    authorize(authorization)
    return metrics.copy()


@app.post("/internal/chat/stream")
async def stream_chat(
    body: ChatRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> StreamingResponse:
    authorize(authorization)
    if any(message.role not in {"system", "user", "assistant"} for message in body.messages):
        raise HTTPException(status_code=422, detail="Invalid message role")
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user")
    if any(isinstance(message.content, list) for message in body.messages) and not VISION_ENABLED:
        raise HTTPException(status_code=400, detail="Vision input is disabled")
    context_size = sum(len(json.dumps(message.content, ensure_ascii=False)) for message in body.messages)
    if context_size > 320_000:
        raise HTTPException(status_code=413, detail="Context exceeds the configured limit")
    if PROVIDER not in {"simulation", "llamacpp"}:
        raise HTTPException(status_code=503, detail="Unknown model provider")

    async def events() -> AsyncIterator[bytes]:
        queued_at = time.monotonic()
        metrics["requests"] += 1
        try:
            await asyncio.wait_for(gpu_slots.acquire(), timeout=QUEUE_TIMEOUT)
        except TimeoutError:
            metrics["queue_timeouts"] += 1
            yield sse({"error": "GPU kuyrugu zaman asimina ugradi; daha sonra tekrar deneyin"})
            yield sse("[DONE]")
            return
        metrics["queue_wait_ms"] = int((time.monotonic() - queued_at) * 1000)
        completed = False
        try:
            provider = simulation(body.messages) if PROVIDER == "simulation" else llamacpp(body.messages, body.settings)
            async for chunk in provider:
                try:
                    data = chunk.decode().split("data: ", 1)[1].strip()
                    if data != "[DONE]":
                        metrics["generated_characters"] += len(json.loads(data).get("delta", ""))
                    else:
                        completed = True
                except (IndexError, json.JSONDecodeError):
                    pass
                yield chunk
            if completed:
                metrics["completed"] += 1
        except (httpx.HTTPError, ValueError):
            yield sse({"error": "Model sunucusuna baglanilamadi"})
            yield sse("[DONE]")
        finally:
            gpu_slots.release()

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })