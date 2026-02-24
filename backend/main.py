"""
Arteriae Aethereae — Edit Server
Serves the frontend, static assets, and provides CRUD API endpoints.
"""

import os
import json

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.data_manager import (
    init_data_dirs,
    build_manifest,
    get_entity,
    save_entity,
    delete_entity,
)


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
RES_TMP_DIR = os.path.join(BASE_DIR, "res_tmp")

app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/res", StaticFiles(directory=RES_DIR), name="res")
if os.path.isdir(RES_TMP_DIR):
    app.mount("/res_tmp", StaticFiles(directory=RES_TMP_DIR), name="res_tmp")


@app.on_event("startup")
def startup_event():
    """
    TODO: docstring
    """
    init_data_dirs()


@app.get("/")
def read_root():
    """Redirect to the frontend index page."""
    return RedirectResponse(url="/frontend/index.html")


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


@app.delete("/api/{category}/{entity_id}")
def remove_entity(category: str, entity_id: str):
    """Delete an entity by category and ID."""
    success = delete_entity(category, entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"status": "deleted", "entity_id": entity_id}
