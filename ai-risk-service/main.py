"""
GigShield AI Risk Engine — Production FastAPI Service
Deploy on Railway / Render / AWS EC2

Run: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import xgboost as xgb
import numpy as np
import os

app = FastAPI(title="GigShield AI Risk Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model ONCE at startup
MODEL_PATH = os.getenv("MODEL_PATH", "model.json")
model = None

@app.on_event("startup")
def load_model():
    global model
    try:
        model = xgb.XGBRegressor()
        model.load_model(MODEL_PATH)
        print(f"✅ XGBoost model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        model = None


class RiskRequest(BaseModel):
    temperature: float = Field(..., ge=-50, le=60, description="Temperature in °C")
    rainfall: float = Field(..., ge=0, le=500, description="Rainfall in mm/hr")
    humidity: float = Field(..., ge=0, le=100, description="Humidity %")
    wind_speed: float = Field(..., ge=0, le=100, description="Wind speed m/s")
    aqi: float = Field(..., ge=0, le=500, description="Air Quality Index")


class RiskResponse(BaseModel):
    risk_score: float
    risk_label: str


@app.post("/predict-risk", response_model=RiskResponse)
def predict_risk(req: RiskRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    features = np.array([[req.temperature, req.rainfall, req.humidity, req.wind_speed, req.aqi]])
    score = float(model.predict(features)[0])
    score = max(0.0, min(1.0, score))

    if score >= 0.6:
        label = "HIGH"
    elif score >= 0.3:
        label = "MEDIUM"
    else:
        label = "LOW"

    return RiskResponse(risk_score=round(score, 4), risk_label=label)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}
