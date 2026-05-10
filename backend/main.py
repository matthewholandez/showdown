from fastapi import FastAPI
from functools import lru_cache
from dotenv import load_dotenv
import requests
import os

from openrouter import OpenRouter

from schemas import OpenRouterModel, OpenRouterModelList, EvaluateModelRequest, EvaluateModelResponse, TokenBreakdown, EvalMode

load_dotenv("../.env.local")

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
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
    with OpenRouter(
        api_key=OPENROUTER_API_KEY
    ) as client:
        response = client.chat.send(
            model=req.model_id,
            messages=[
                {"role": "system", "content": req.system_prompt},
                {"role": "user", "content": req.user_input}
            ]
        )
        response_content = str(response.choices[0].message.content)
    return EvaluateModelResponse(
        response=response_content,
        passed=True,
        tokens=TokenBreakdown(prompt=0,completion=1,total=1),
        eval_mode=req.eval_mode
    )