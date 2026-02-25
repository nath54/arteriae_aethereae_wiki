"""
Arteriae Aethereae — Edit Server
Serves the frontend, static assets, and provides CRUD API endpoints.

HOW TO EXTEND / ADD NEW FEATURES HERE:

- If you need a new API route
    (e.g., for AI text generation, exports, uploading assets),
    add a new `@app.get` or `@app.post` decorator below.

- Variables available globally in this file:
    - `app` (FastAPI instance)
    - `BASE_DIR` (path to the base directory)
    - `DATA_DIR` (path to the data directory)
    - `FRONTEND_DIR` (path to the frontend directory)
    - `RES_DIR` (path to the resources directory)
    - `RES_TMP_DIR` (path to the temporary resources directory)
"""

from typing import Any

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

# Main entry point of the application.
# FastAPI instance that serves the frontend, static assets, and provides CRUD API endpoints.
app: FastAPI = FastAPI(title="Arteriae Aethereae Engine API")

# Setup CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to the base directory.
BASE_DIR: str = os.path.dirname(os.path.dirname(__file__))

# Path to the data directory.
DATA_DIR: str = os.path.join(BASE_DIR, "data")

# Path to the frontend directory.
FRONTEND_DIR: str = os.path.join(BASE_DIR, "frontend")

# Path to the resources directory.
RES_DIR: str = os.path.join(BASE_DIR, "res")

# Path to the temporary resources directory.
RES_TMP_DIR: str = os.path.join(BASE_DIR, "res_tmp")

# Mount the static files directories.
app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/res", StaticFiles(directory=RES_DIR), name="res")

# Mount the temporary resources directory if it exists.
if os.path.isdir(RES_TMP_DIR):
    app.mount("/res_tmp", StaticFiles(directory=RES_TMP_DIR), name="res_tmp")


# Hook called when the FastAPI server starts.
@app.on_event("startup")
def startup_event() -> None:
    """
    Hook called when the FastAPI server starts.
    Good place to add initialization code
    (e.g., connecting to a database, loading ML models, or pre-caching data).
    Currently, it ensures the required data directories exist.
    """

    # Initialize the data directories.
    init_data_dirs()


# Redirects the root URL to the frontend index page.
@app.get("/")
def read_root() -> RedirectResponse:
    """
    Redirects the root URL to the frontend index page.
    Triggered when a user navigates to `http://localhost:8000/`.

    Returns:
        RedirectResponse pointing to the frontend UI.
    """

    # Redirect to the frontend index page.
    return RedirectResponse(url="/frontend/index.html")


# Retrieves the global manifest of all entities (characters, places, maps, events).
@app.get("/api/manifest")
def get_manifest() -> dict[str, Any]:
    """
    Retrieves the global manifest of all entities (characters, places, maps, events).
    Called by the frontend on initial load to build the UI menus and populate the knowledge graph.

    Returns:
        dict representing the entire manifest JSON schema.
    """

    # Get the manifest path.
    manifest_path = os.path.join(DATA_DIR, "manifest.json")

    # Build the manifest if it doesn't exist.
    if not os.path.exists(manifest_path):
        build_manifest()

    # Open and return the manifest.
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


# Reads a specific entity's full data payload from its JSON file.
@app.get("/api/{category}/{entity_id}")
def read_entity(category: str, entity_id: str) -> dict[str, Any]:
    """
    Reads a specific entity's full data payload from its JSON file.

    Args:
        category (str): The entity category (e.g., "characters", "places").
        entity_id (str): The specific string ID (usually the filename without .json).

    Returns:
        dict containing the entity's full data.

    Raises:
        HTTPException (404) if the entity file cannot be found.
    """

    # Call the data manager to get the entity.
    data = get_entity(category, entity_id)

    # Raise an HTTPException if the entity was not found.
    if data is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Return the entity data.
    return data


# Writes or updates a specific entity's data to its corresponding JSON file.
@app.post("/api/{category}/{entity_id}")
def write_entity(category: str, entity_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Writes or updates a specific entity's data to its corresponding JSON file.
    Called when saving changes securely from the frontend edit mode.

    Args:
        category (str): The entity category (e.g., "characters").
        entity_id (str): The specific ID.
        data (dict): The new entity JSON payload parsed as a Python dictionary.

    Returns:
        dict indicating success status and the echoed entity_id.
    """

    # Call the data manager to save the entity.
    save_entity(category, entity_id, data)

    # Return the entity ID along with a success message.
    return {"status": "success", "entity_id": entity_id}


# Deletes an entity by category and ID.
@app.delete("/api/{category}/{entity_id}")
def remove_entity(category: str, entity_id: str) -> dict[str, Any]:
    """
    Deletes an entity by category and ID.

    Args:
        category (str): The entity category.
        entity_id (str): The specific ID.

    Returns:
        dict indicating deletion status.

    Raises:
        HTTPException (404) if the entity is not found to delete.

    HOOK POINT: You can add cleanup code here if deleting an entity requires
    removing associated images in `/res/` or cascading deletions in other linked entities.
    """

    # Call the data manager to delete the entity.
    success = delete_entity(category, entity_id)

    # Raise an HTTPException if the entity was not found.
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Return the entity ID along with a success message.
    return {"status": "deleted", "entity_id": entity_id}
