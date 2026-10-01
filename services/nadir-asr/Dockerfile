# Nadir speech service for Cloud Run: Muno459/fastconformer-quran on CPU.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY *.py ./
# The model ships inside the image, so a cold start never downloads it.
COPY model/ ./model/

# Feature settings: change these if selftest.py picks different ones.
ENV FEATURE_WINDOW=periodic \
    FEATURE_PAD=reflect \
    FEATURE_NORMALIZE=per_feature

# Cloud Run sets PORT (8080 by default).
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --timeout-keep-alive 75
