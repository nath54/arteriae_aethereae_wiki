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
"""

from typing import Any

import os
import json

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.data_manager import (
    init_data_dirs,
    build_manifest,
    get_entity,
    save_entity,
    delete_entity,
    create_document,
    write_document,
    create_folder,
    rename_document,
    move_document,
    copy_document,
    delete_document_file,
    safe_join,
    get_docs_dir,
    upload_image,
    list_images,
    delete_image,
    create_place,
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

# Mount the static files directories.
app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
app.mount("/res", StaticFiles(directory=RES_DIR), name="res")


# Hook called when the FastAPI server starts.
@app.on_event("startup")
def startup_event() -> None:
    """
    Hook called when the FastAPI server starts.
    Good place to add initialization code
    (e.g., connecting to a database, loading ML models, or pre-caching data).
    Currently, it ensures the required data directories exist.
    """

    print("DEBUG | startup_event")

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

    print("DEBUG | read_root")

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

    print("DEBUG | get_manifest")

    # Get the manifest path.
    manifest_path = os.path.join(DATA_DIR, "manifest.json")

    # Build the manifest if it doesn't exist.
    if not os.path.exists(manifest_path):
        build_manifest()

    # Open and return the manifest.
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


# Document specific endpoints


@app.post("/api/documents/new")
async def api_create_document(request: Request) -> dict[str, Any]:
    """
    Creates a new document in the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status and the echoed path.

    Raises:
        HTTPException (400) if the document already exists or the path is invalid.
    """

    print(f"DEBUG | api_create_document | request: {request}")

    # Try to get the JSON body data from the request
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    # Get the path from the JSON body data
    path = data.get("path")

    # Raise an HTTPException if the path is missing
    if not path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'path'")

    # Create the document and return the result
    if create_document(path):
        return {"status": "success", "path": path}

    # If an error occurred, raise an HTTPException
    raise HTTPException(
        status_code=400, detail=f"Document '{path}' already exists or invalid path"
    )


@app.post("/api/documents/write")
async def api_write_document(request: Request) -> dict[str, Any]:
    """
    Writes a document to the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status and the echoed path.

    Raises:
        HTTPException (400) if the document cannot be written.
    """

    print(f"DEBUG | api_write_document | request: {request}")

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    path = data.get("path")
    content = data.get("content")

    if not path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'path'")
    if content is None:
        raise HTTPException(status_code=400, detail="Missing parameter: 'content'")

    if write_document(path, content):
        return {"status": "success", "path": path}
    raise HTTPException(status_code=400, detail=f"Failed to write document at '{path}'")


@app.post("/api/folders/new")
async def api_create_folder(request: Request) -> dict[str, Any]:
    """
    Creates a new folder in the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status and the echoed path.

    Raises:
        HTTPException (400) if the folder already exists or the path is invalid.
    """

    print(f"DEBUG | api_create_folder | request: {request}")

    # Try to get the JSON body data from the request
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    # Get the path from the JSON body data
    path = data.get("path")

    # Raise an HTTPException if the path is missing
    if not path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'path'")

    # Create the folder and return the result
    if create_folder(path):
        return {"status": "success", "path": path}
    raise HTTPException(
        status_code=400, detail=f"Folder '{path}' already exists or invalid path"
    )


@app.post("/api/documents/rename")
async def api_rename_document(request: Request) -> dict[str, Any]:
    """
    Renames a document or folder in the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status.

    Raises:
        HTTPException (400) if the document or folder cannot be renamed.
    """

    print(f"DEBUG | api_rename_document | request: {request}")

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    old_path = data.get("old_path")
    new_name = data.get("new_name")

    if not old_path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'old_path'")
    if not new_name:
        raise HTTPException(status_code=400, detail="Missing parameter: 'new_name'")

    if rename_document(old_path, new_name):
        return {"status": "success"}
    raise HTTPException(
        status_code=400,
        detail=f"Rename failed for '{old_path}' to '{new_name}' \
                 (file might not exist or name taken)",
    )


@app.post("/api/documents/move")
async def api_move_document(request: Request) -> dict[str, Any]:
    """
    Moves a document or folder in the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status.

    Raises:
        HTTPException (400) if the document or folder cannot be moved.
    """

    print(f"DEBUG | api_move_document | request: {request}")

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    old_path = data.get("old_path")
    new_dest_dir = data.get("new_dest_dir")

    if not old_path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'old_path'")
    if new_dest_dir is None:
        raise HTTPException(status_code=400, detail="Missing parameter: 'new_dest_dir'")

    if move_document(old_path, new_dest_dir):
        return {"status": "success"}
    raise HTTPException(
        status_code=400, detail=f"Move failed for '{old_path}' to '{new_dest_dir}'"
    )


@app.post("/api/documents/copy")
async def api_copy_document(request: Request) -> dict[str, Any]:
    """
    Copies a document or folder in the data/docs directory.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        dict indicating success status and the echoed new path.

    Raises:
        HTTPException (400) if the document or folder cannot be copied.
    """

    print(f"DEBUG | api_copy_document | request: {request}")

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    path = data.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Missing parameter: 'path'")

    new_path = copy_document(path)
    if new_path:
        return {"status": "success", "new_path": new_path}
    raise HTTPException(status_code=400, detail=f"Copy failed for '{path}'")


@app.post("/api/documents/upload")
def api_upload_document(
    path: str = Form(...), file: UploadFile = File(...)
) -> dict[str, Any]:
    """
    Uploads a document or image to the data/docs directory.

    Args:
        path (str): Destination directory for the document or image.
        file (UploadFile): The document or image file to upload.

    Returns:
        {"status": "success", "file_url": f"/data/{rel_file_path}"} on success.
        HTTPException on failure.
    """

    print(f"DEBUG | api_upload_document | path: {path}, file: {file}")

    docs_dir = get_docs_dir()

    # We want to upload directly to a certain folder context, so path is the destination directory
    dest_dir = safe_join(docs_dir, path) if path else docs_dir
    os.makedirs(dest_dir, exist_ok=True)

    file_name: str = file.filename if file.filename else ""

    if file_name == "":
        raise HTTPException(status_code=400, detail="No filename provided")

    # The uploaded file might be an image or a document
    file_path = safe_join(dest_dir, file_name)

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    build_manifest()

    # Return a markdown friendly path that points to from the frontend mapping
    rel_file_path = os.path.relpath(
        file_path, os.path.join(os.path.dirname(docs_dir))
    ).replace("\\", "/")
    return {"status": "success", "file_url": f"/data/{rel_file_path}"}


# ── Place Folder Endpoints ──


@app.post("/api/places/new")
async def api_create_place(request: Request) -> dict[str, Any]:
    """
    Creates a new place folder on disk (place.json + map.json) under data/places/.
    Nested places are created as subfolders of their parent.

    Args:
        request (Request): The request object containing the JSON body.

    Returns:
        {"status": "success", "place_id": place_id} on success.
        HTTPException on failure.
    """

    print(f"DEBUG | api_create_place | request: {request}")

    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from e

    name = data.get("name")
    parent_id = data.get("parent_id", "")

    if not name:
        raise HTTPException(status_code=400, detail="Missing parameter: 'name'")

    place_id = create_place(name, parent_id.strip() or None)
    if place_id:
        return {"status": "success", "place_id": place_id}
    raise HTTPException(
        status_code=400, detail=f"Place '{name}' already exists or invalid name"
    )


# ── Image Endpoints ──


@app.post("/api/images/upload")
def api_upload_image(
    path: str = Form(default=""), file: UploadFile = File(...)
) -> dict[str, Any]:
    """
    Uploads an image to data/images/<path>/.
    Assigns it a slug-based ID during the next manifest rebuild.

    Args:
        path (str): Destination directory for the image.
        file (UploadFile): The image file to upload.

    Returns:
        {"status": "success", "url": img_url} on success.
        HTTPException on failure.
    """

    print(f"DEBUG | api_upload_image | path: {path}, file: {file}")

    file_name: str = file.filename if file.filename else ""

    if file_name == "":
        raise HTTPException(status_code=400, detail="No filename provided")

    img_url = upload_image(path, file_name, file.file.read())
    if img_url:
        return {"status": "success", "url": img_url}
    raise HTTPException(
        status_code=400, detail="Invalid image file or extension not supported"
    )


@app.get("/api/images/list")
def api_list_images() -> dict[str, Any]:
    """
    Returns all images tracked in the manifest.

    Returns:
        List of images.
    """
    print("DEBUG | api_list_images")
    return list_images()


@app.delete("/api/images/{img_path:path}")
def api_delete_image(img_path: str) -> dict[str, Any]:
    """
    Deletes an image from data/images/.

    Args:
        img_path (str): Path to the image to delete.

    Returns:
        {"status": "deleted", "path": img_path} on success.
        HTTPException on failure.
    """
    print(f"DEBUG | api_delete_image | img_path: {img_path}")
    if delete_image(img_path):
        return {"status": "deleted", "path": img_path}
    raise HTTPException(status_code=404, detail="Image not found")


@app.delete("/api/documents/{path:path}")
def api_delete_document(path: str) -> dict[str, Any]:
    """
    Deletes a document or folder from the data/docs directory.

    Args:
        path (str): Path to the document or folder to delete.

    Returns:
        {"status": "deleted", "path": path} on success.
        HTTPException on failure.
    """
    print(f"DEBUG | api_delete_document | path: {path}")
    if delete_document_file(path):
        return {"status": "deleted", "path": path}
    raise HTTPException(status_code=404, detail="File or folder not found")


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

    print(f"DEBUG | read_entity | category: {category}, entity_id: {entity_id}")

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

    print(
        f"DEBUG | write_entity | category: {category}, entity_id: {entity_id}, data: {data}"
    )

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

    print(f"DEBUG | remove_entity | category: {category}, entity_id: {entity_id}")

    # Call the data manager to delete the entity.
    success = delete_entity(category, entity_id)

    # Raise an HTTPException if the entity was not found.
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Return the entity ID along with a success message.
    return {"status": "deleted", "entity_id": entity_id}
