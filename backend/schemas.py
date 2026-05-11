from pydantic import BaseModel, ConfigDict, Field
from enum import Enum
from typing import Annotated

class OpenRouterModel(BaseModel):
    id: str
    label: str

class OpenRouterModelList(BaseModel):
    models: list[OpenRouterModel]

class EvalMode(str, Enum):
    CONTAINS = "contains"
    EXACT = "exact"
    REGEX = "regex"

class EvaluateModelRequest(BaseModel):
    system_prompt: Annotated[str, Field(
        description="The system prompt to test",
        alias="systemPrompt"
    )]
    user_input: Annotated[str, Field(
        description="The user input to test",
        alias="userInput"
    )]
    expected: Annotated[str, Field(
        description="The expected value when the input passes through the model",
        alias="expected"
    )]
    model_id: Annotated[str, Field(
        description="The id of the model to test",
        alias="modelId"
    )]
    eval_mode: Annotated[EvalMode, Field(
        description="The eval mode to test with",
        alias="evalMode"
    )]

class TokenBreakdown(BaseModel):
    prompt: int
    completion: int
    total: int

class EvaluateModelResponse(BaseModel):
    response: Annotated[str, Field(
        description="The model's response",
    )]
    passed: Annotated[bool, Field(
        description="Whether or not the model's response passed validation against expected output"
    )]
    tokens: Annotated[TokenBreakdown, Field(
        description="Tokens consumed by the model"
    )]
    eval_mode: Annotated[EvalMode, Field(
        description="The eval mode tested with"
    )]