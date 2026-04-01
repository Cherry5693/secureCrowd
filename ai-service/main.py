from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline
import torch
import re
from datetime import datetime
from functools import lru_cache
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple

app = FastAPI()

DEVICE = 0 if torch.cuda.is_available() else -1

# Load model once
classifier = pipeline(
    "zero-shot-classification",
    model="typeform/distilbert-base-uncased-mnli",
    device=DEVICE
)

LABELS = [
    "a child is missing in a crowded place",
    "someone needs urgent medical help",
    "there is a dangerous security threat",
    "normal casual conversation"
]

CATEGORY_MAP = {
    LABELS[0]: "missing_child",
    LABELS[1]: "medical_emergency",
    LABELS[2]: "security_threat",
    LABELS[3]: "normal"
}

CATEGORY_THRESHOLDS = {
    "missing_child": 0.60,
    "medical_emergency": 0.55,
    "security_threat": 0.65,
    "normal": 0.70
}

KEYWORD_CATEGORIES = {
    "missing_child": ["lost child", "missing child", "child is lost", "child missing", "kid lost"],
    "medical_emergency": ["bleeding", "unconscious", "injured", "collapsed", "not breathing", "cpr"],
    "security_threat": ["gun", "knife", "bomb", "fire", "attack", "shooting", "weapon", "explosion"]
}

MIN_LENGTH = 5
ML_CACHE_MAX = 2048
ML_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()


class MessageRequest(BaseModel):
    message: str
    section: Optional[str] = None


def normalize_message(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text.lower())).strip()


def is_spam(message: str) -> bool:
    stripped = message.strip()
    if len(stripped) < MIN_LENGTH:
        return True

    # repeated characters like "aaaaaa" or "!!!!!"
    if re.search(r"(.)\1{4,}", stripped):
        return True

    return False


def build_keyword_index() -> Dict[str, Tuple[str, ...]]:
    return {
        category: tuple(normalize_message(k) for k in keywords if normalize_message(k))
        for category, keywords in KEYWORD_CATEGORIES.items()
    }


KEYWORD_INDEX = build_keyword_index()


def keyword_detect(message: str) -> Optional[str]:
    message_norm = normalize_message(message)
    if not message_norm:
        return None

    for category, keywords in KEYWORD_INDEX.items():
        for keyword in keywords:
            if keyword in message_norm:
                return category

    return None


def calculate_severity(confidence: float) -> str:
    if confidence >= 0.80:
        return "high"
    elif confidence >= 0.65:
        return "medium"
    else:
        return "low"


def cache_ml_result(key: str, value: Dict[str, Any]) -> Dict[str, Any]:
    if key in ML_CACHE:
        del ML_CACHE[key]
    ML_CACHE[key] = value

    if len(ML_CACHE) > ML_CACHE_MAX:
        ML_CACHE.popitem(last=False)

    return value


def get_cached_ml_result(message: str) -> Dict[str, Any]:
    cache_key = normalize_message(message)

    if cache_key in ML_CACHE:
        value = ML_CACHE[cache_key]
        ML_CACHE.move_to_end(cache_key)
        return value

    with torch.inference_mode():
        result = classifier(
            message,
            LABELS,
            truncation=True
        )

    top_label = result["labels"][0]
    confidence = float(result["scores"][0])
    mapped_category = CATEGORY_MAP[top_label]
    threshold = CATEGORY_THRESHOLDS[mapped_category]

    emergency = mapped_category != "normal" and confidence >= threshold
    severity = calculate_severity(confidence)

    payload = {
        "emergency": emergency,
        "category": mapped_category,
        "confidence": round(confidence, 4),
        "severity": severity,
        "requires_security": emergency and severity != "low"
    }

    return cache_ml_result(cache_key, payload)


@app.on_event("startup")
def warmup_model():
    try:
        with torch.inference_mode():
            classifier("warmup message", LABELS, truncation=True)
    except Exception:
        # Keep startup safe even if warmup fails
        pass


@app.post("/analyze")
async def analyze_message(data: MessageRequest):
    message = data.message.strip()
    section = data.section or "unknown"
    timestamp = datetime.utcnow().isoformat()

    # 1) Spam / invalid
    if is_spam(message):
        return {
            "timestamp": timestamp,
            "section": section,
            "emergency": False,
            "category": "spam",
            "confidence": 1.0,
            "severity": "low",
            "requires_security": False
        }

    # 2) Fast keyword detection
    keyword_category = keyword_detect(message)
    if keyword_category:
        return {
            "timestamp": timestamp,
            "section": section,
            "emergency": True,
            "category": keyword_category,
            "confidence": 1.0,
            "severity": "high",
            "requires_security": True
        }

    # 3) Skip ML for short messages
    if len(message) < 20:
        return {
            "timestamp": timestamp,
            "section": section,
            "emergency": False,
            "category": "normal",
            "confidence": 0.9,
            "severity": "low",
            "requires_security": False
        }

    # 4) Cached ML classification
    ml_result = get_cached_ml_result(message)

    return {
        "timestamp": timestamp,
        "section": section,
        **ml_result
    }