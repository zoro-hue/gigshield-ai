# GigShield AI Risk Engine

Production XGBoost-based risk prediction microservice.

## Deploy

### Railway / Render
1. Push this folder to a Git repo
2. Connect to Railway/Render
3. It auto-detects the Dockerfile
4. Set env `AI_RISK_SERVICE_URL` in your Supabase edge function secrets

### Local
```bash
pip install -r requirements.txt
python train_model.py
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Test
```bash
curl -X POST http://localhost:8000/predict-risk \
  -H "Content-Type: application/json" \
  -d '{"temperature":45,"rainfall":70,"humidity":85,"wind_speed":15,"aqi":350}'
```

## API

**POST /predict-risk**
- Input: `{ temperature, rainfall, humidity, wind_speed, aqi }`
- Output: `{ risk_score: 0.0-1.0, risk_label: "LOW"|"MEDIUM"|"HIGH" }`

**GET /health**
- Output: `{ status: "ok", model_loaded: true }`
