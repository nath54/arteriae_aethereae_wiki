"""
TODO: docstring
"""

import os
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.data_manager import init_data_dirs, build_manifest, get_entity, save_entity


app = FastAPI(title="Arteriae Aethereae Engine API")

# Setup CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
RES_DIR = os.path.join(BASE_DIR, "res")

app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
app.mount("/res", StaticFiles(directory=RES_DIR), name="res")


@app.on_event("startup")
def startup_event():
    """
    TODO: docstring
    """
    init_data_dirs()


@app.get("/")
def read_root():
    """
    TODO: docstring
    """
    return {"message": "Welcome to the Arteriae Aethereae Engine Edit Server"}


@app.get("/api/manifest")
def get_manifest():
    """
    TODO: docstring
    """
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        build_manifest()

    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/{category}/{entity_id}")
def read_entity(category: str, entity_id: str):
    """
    TODO: docstring
    """
    data = get_entity(category, entity_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    return data


@app.post("/api/{category}/{entity_id}")
def write_entity(category: str, entity_id: str, data: dict):
    """
    TODO: docstring
    """
    save_entity(category, entity_id, data)
    return {"status": "success", "entity_id": entity_id}


# Note: Further CRUD endpoints for entities and maps will be added here
