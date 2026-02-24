#!/bin/bash
echo "Starting FastAPI Edit Server on port 8000..."
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
