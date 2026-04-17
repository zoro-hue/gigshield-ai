"""
Train XGBoost risk model on synthetic weather-risk data.
Run once: python train_model.py
Produces: model.json
"""
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
import json

np.random.seed(42)
N = 5000

# Generate realistic weather scenarios
temperature = np.random.uniform(15, 50, N)
rainfall = np.random.exponential(10, N)
humidity = np.random.uniform(20, 100, N)
wind_speed = np.random.exponential(5, N)
aqi = np.random.exponential(80, N).clip(0, 500)

# Deterministic risk label based on real thresholds
# Risk increases with extreme weather
heat_risk = np.where(temperature > 45, 0.35, np.where(temperature > 40, 0.2, np.where(temperature > 35, 0.1, 0.0)))
rain_risk = np.where(rainfall > 65, 0.4, np.where(rainfall > 30, 0.2, np.where(rainfall > 10, 0.1, 0.0)))
wind_risk = np.where(wind_speed > 20, 0.3, np.where(wind_speed > 12, 0.15, 0.0))
aqi_risk = np.where(aqi > 400, 0.35, np.where(aqi > 300, 0.2, np.where(aqi > 200, 0.1, 0.0)))
humidity_risk = np.where(humidity > 90, 0.1, 0.0)

risk_score = (heat_risk + rain_risk + wind_risk + aqi_risk + humidity_risk).clip(0, 1)
# Add small noise for realism
risk_score = (risk_score + np.random.normal(0, 0.02, N)).clip(0, 1)

X = np.column_stack([temperature, rainfall, humidity, wind_speed, aqi])
y = risk_score

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = xgb.XGBRegressor(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.1,
    objective='reg:squarederror',
    random_state=42,
)
model.fit(X_train, y_train)

# Evaluate
from sklearn.metrics import mean_absolute_error, r2_score
y_pred = model.predict(X_test)
print(f"MAE: {mean_absolute_error(y_test, y_pred):.4f}")
print(f"R²:  {r2_score(y_test, y_pred):.4f}")

model.save_model("model.json")
print("Model saved to model.json")

# Save feature names
with open("feature_names.json", "w") as f:
    json.dump(["temperature", "rainfall", "humidity", "wind_speed", "aqi"], f)
print("Feature names saved.")
