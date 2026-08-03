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

    def train_baseline(self, df=None):
        """
        Trains model on real historical data with technical indicators.
        Refuses to train on synthetic data — requires at least 30 rows of real data.
        """
        if df is not None and len(df) >= 30:
            features_df = self.extract_features(df)
            # Generate labels from actual future price movement
            future_returns = df['close'].pct_change(5).shift(-5)
            y = np.where(future_returns > 0.02, 2, np.where(future_returns < -0.02, 0, 1))
            
            # Trim to match features
            valid_mask = ~np.isnan(future_returns) & (features_df.sum(axis=1) != 0)
            X = features_df[valid_mask].values
            y_valid = y[valid_mask]
            
            if len(X) >= 30:
                self.model.fit(X, y_valid)
                self.is_trained = True
                print(f"[ML Classifier] Trained on {len(X)} real data points.")
                return
        
        print("[ML Classifier] Insufficient real data for training. Model will use rule-based fallback.")
        self.is_trained = False

    def predict_movement_probabilities(self, df, sentiment_score=0.0):
        if not self.is_trained:
            # Try training on the provided data first
            self.train_baseline(df)
            
        features_df = self.extract_features(df)
        if len(features_df) == 0:
            return {"bullishProb": 33.3, "neutralProb": 33.4, "bearishProb": 33.3, "signal": "NEUTRAL", "confidenceScore": 0.0, "dataQuality": "insufficient"}

        if not self.is_trained:
            # Rule-based fallback using RSI when ML model can't train
            rsi = features_df['rsi'].iloc[-1] if 'rsi' in features_df.columns else 50.0
            if rsi > 70: bear_p, neut_p, bull_p = 15.0, 25.0, 60.0
            elif rsi < 30: bear_p, neut_p, bull_p = 60.0, 25.0, 15.0
            else: bear_p, neut_p, bull_p = 30.0, 40.0, 30.0
            signal = "BULLISH" if bull_p > 50 else ("BEARISH" if bear_p > 50 else "NEUTRAL")
            return {"bullishProb": bull_p, "neutralProb": neut_p, "bearishProb": bear_p, "signal": signal, "confidenceScore": 0.0, "dataQuality": "rule-based (insufficient training data)"}

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
