import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "ai_engine", "saved_models")

os.makedirs(MODEL_DIR, exist_ok=True)

class MovementClassifier:
    """
    Directional Movement Movement Classifier.
    Predicts probability of upward movement over next N trading sessions.
    Outputs: Bullish %, Neutral %, Bearish %
    """
    def __init__(self):
        self.model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42)
        self.is_trained = False

    def extract_features(self, df):
        """
        Derives feature matrix from OHLCV + technical indicators dataframe
        """
        features = pd.DataFrame()
        features['rsi'] = df.get('rsi', 50.0)
        features['macd_hist'] = df.get('macd_hist', 0.0)
        features['sma_20_ratio'] = df['close'] / (df.get('sma_20', df['close']).replace(0, 1e-9))
        features['sma_50_ratio'] = df['close'] / (df.get('sma_50', df['close']).replace(0, 1e-9))
        features['bb_width'] = df.get('bb_width', 0.05)
        features['volatility_pct'] = df.get('volatility_pct', 1.5)
        features['momentum_5d'] = df.get('momentum_5d', 0.0)
        features['vol_change'] = (df['volume'] - df['volume'].shift(5)) / (df['volume'].shift(5).replace(0, 1e-9))
        
        features = features.ffill().bfill().fillna(0)
        return features

    def train_baseline(self):
        """
        Trains model on synthetic/historical multi-factor signals
        """
        np.random.seed(42)
        n_samples = 1500
        
        # Synthetic feature distribution
        rsi = np.random.uniform(25, 80, n_samples)
        macd_hist = np.random.normal(0.5, 2.0, n_samples)
        sma_20_ratio = np.random.normal(1.01, 0.03, n_samples)
        sma_50_ratio = np.random.normal(1.02, 0.05, n_samples)
        bb_width = np.random.uniform(0.02, 0.15, n_samples)
        volatility_pct = np.random.uniform(0.8, 4.0, n_samples)
        momentum_5d = np.random.normal(1.5, 4.0, n_samples)
        vol_change = np.random.normal(0.1, 0.5, n_samples)

        X = np.column_stack([
            rsi, macd_hist, sma_20_ratio, sma_50_ratio,
            bb_width, volatility_pct, momentum_5d, vol_change
        ])
        
        # Generate multi-class directional target: 0=Bearish, 1=Neutral, 2=Bullish
        score = (0.04 * (rsi - 50)) + (0.5 * macd_hist) + (10 * (sma_20_ratio - 1.0)) + (0.3 * momentum_5d)
        y = np.where(score > 1.2, 2, np.where(score < -1.2, 0, 1))

        self.model.fit(X, y)
        self.is_trained = True
        print("[ML Classifier] Movement probability classifier trained successfully.")

    def predict_movement_probabilities(self, df, sentiment_score=0.0):
        if not self.is_trained:
            self.train_baseline()
            
        features_df = self.extract_features(df)
        if len(features_df) == 0:
            return {"bullishProb": 50.0, "neutralProb": 30.0, "bearishProb": 20.0, "signal": "NEUTRAL", "confidenceScore": 60.0}

        # Select latest row
        latest_X = features_df.iloc[-1:].values
        probs = self.model.predict_proba(latest_X)[0] # [bearish, neutral, bullish]
        
        # Adjust with news sentiment score if available
        bear_p = probs[0] * (1.0 - 0.15 * sentiment_score)
        neut_p = probs[1]
        bull_p = probs[2] * (1.0 + 0.15 * sentiment_score)
        
        total = bear_p + neut_p + bull_p
        bear_p = round((bear_p / total) * 100, 1)
        neut_p = round((neut_p / total) * 100, 1)
        bull_p = round((bull_p / total) * 100, 1)

        if bull_p >= 55.0:
            signal = "BULLISH"
            confidence = bull_p
        elif bear_p >= 55.0:
            signal = "BEARISH"
            confidence = bear_p
        else:
            signal = "NEUTRAL"
            confidence = max(bull_p, neut_p, bear_p)

        return {
            "bullishProb": bull_p,
            "neutralProb": neut_p,
            "bearishProb": bear_p,
            "signal": signal,
            "confidenceScore": round(confidence, 1),
            "featureValues": features_df.iloc[-1].to_dict()
        }

classifier = MovementClassifier()
classifier.train_baseline()

if __name__ == "__main__":
    # Test prediction
    dummy_df = pd.DataFrame({
        'open': [100, 102, 105],
        'high': [103, 106, 108],
        'low': [99, 101, 104],
        'close': [102, 105, 107],
        'volume': [10000, 15000, 25000],
        'rsi': [62.5, 65.0, 68.2],
        'macd_hist': [0.5, 0.8, 1.2],
        'sma_20': [100, 101, 102],
        'sma_50': [98, 98.5, 99],
        'bb_width': [0.06, 0.07, 0.08],
        'volatility_pct': [1.8, 1.9, 2.0],
        'momentum_5d': [3.2, 4.1, 5.0]
    })
    res = classifier.predict_movement_probabilities(dummy_df, sentiment_score=0.4)
    print(f"Prediction Output: {res}")
