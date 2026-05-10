from fastapi import FastAPI
from functools import lru_cache
from dotenv import load_dotenv
import requests
import os

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
        response: requests.Response = requests.get(OPENROUTER_MODELS_URL, headers=headers)
        model_output = OpenRouterModelList(models=[])
        data = response.json().get("data")
        for model in data:
            model_id: str = model.get("id")
            if model_id.startswith("~"): # then it's an alias
                continue
            model_output.models.append(OpenRouterModel(id=model.get("id"), label=model.get("name")))
        return model_output
    except requests.exceptions.RequestException as e:
        raise SystemExit(e)

@app.get("/models")
def get_models() -> OpenRouterModelList:
    models = fetch_openrouter_models()
    return models


@app.post("/evaluate")
def evaluate_model(req: EvaluateModelRequest) -> EvaluateModelResponse:
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

    response = requests.post(OPENROUTER_RESPONSES_URL, json=payload, headers=headers)
    data = response.json()

    message = data["choices"][0]["message"]["content"]
    usage = data["usage"]

    return EvaluateModelResponse(
        response=message,
        passed=True,
        tokens=TokenBreakdown(
            prompt=usage["prompt_tokens"],
            completion=usage["completion_tokens"],
            total=usage["total_tokens"],
        ),
        eval_mode=req.eval_mode,
    )
