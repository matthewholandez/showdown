from fastapi import FastAPI
from functools import lru_cache
from dotenv import load_dotenv
import httpx
import os
import re

from schemas import OpenRouterModel, OpenRouterModelList, EvaluateModelRequest, EvaluateModelResponse, TokenBreakdown, EvalMode

load_dotenv("../.env.local")

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
OPENROUTER_RESPONSES_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

app = FastAPI()

@lru_cache()
def fetch_openrouter_models() -> OpenRouterModelList:
    print("Fetching models from OpenRouter")
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}"
    }
    try:
        response = httpx.get(OPENROUTER_MODELS_URL, headers=headers, timeout=30.0)
        model_output = OpenRouterModelList(models=[])
        data = response.json().get("data")
        for model in data:
            model_id: str = model.get("id")
            if model_id.startswith("~"): # then it's an alias
                continue
            model_output.models.append(OpenRouterModel(id=model.get("id"), label=model.get("name")))
        return model_output
    except httpx.HTTPError as e:
        raise SystemExit(e)

@app.get("/models")
def get_models() -> OpenRouterModelList:
    models = fetch_openrouter_models()
    return models


def check_eval(response: str, expected: str, mode: EvalMode) -> bool:
    if mode == EvalMode.CONTAINS:
        return expected in response
    if mode == EvalMode.EXACT:
        return response.strip() == expected.strip()
    if mode == EvalMode.REGEX:
        try:
            return re.search(expected, response) is not None
        except re.error:
            return False
    return False


@app.post("/evaluate")
async def evaluate_model(req: EvaluateModelRequest) -> EvaluateModelResponse:
    payload = {
        "messages": [
            {
                "role": "system",
                "content": req.system_prompt
            },
            {
                "role": "user",
                "content": req.user_input
            }
        ],
        "model": req.model_id
    }

    headers = {
        "X-OpenRouter-Experimental-Metadata": "enabled",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OPENROUTER_RESPONSES_URL, json=payload, headers=headers)
    data = response.json()

    message = data["choices"][0]["message"]["content"]
    usage = data["usage"]

    return EvaluateModelResponse(
        response=message,
        passed=check_eval(message, req.expected, req.eval_mode),
        tokens=TokenBreakdown(
            prompt=usage["prompt_tokens"],
            completion=usage["completion_tokens"],
            total=usage["total_tokens"],
        ),
        eval_mode=req.eval_mode,
    )
