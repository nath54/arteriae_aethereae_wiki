"""
Data Manager for Arteriae Aethereae
Handles the underlying file system operations: reading, writing, and deleting JSON entities,
as well as building the central `manifest.json`.

ID SYSTEM:
  All entity IDs are their relative path under data/, with the extension stripped.
  Examples:
    characters/protagonists/aeron  (from data/characters/protagonists/aeron.json)
    places/teria/risnia             (from data/places/teria/risnia/place.json)
    documents/Histoire/v0/draft     (from data/documents/Histoire/v0/draft.md)
    images/portraits/aeron          (from data/images/portraits/aeron.png)

HOOK POINTS:
  - To add a new entity category, add it to `DIRECTORIES`.
  - To add new manifest fields, extend the `entry` dict in `build_manifest()`.
"""

from typing import Any, Optional
import re
import os
import json
import shutil


# ── Constants ──────────────────────────────────────────────────────────────────

# Absolute path to the /data directory
DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

# Core entity categories stored as JSON files
DIRECTORIES: list[str] = ["characters", "places", "maps", "events"]

# Image file extensions supported by the image library
IMAGE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

# ── Initialisation ─────────────────────────────────────────────────────────────


def init_data_dirs() -> None:
    """
    Creates all required data directories if they don't exist.
    Called once during server startup. Always rebuilds the manifest to ensure
    it reflects the current filesystem state.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    for d in DIRECTORIES:
        os.makedirs(os.path.join(DATA_DIR, d), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "images"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "documents"), exist_ok=True)
    build_manifest()


# ── Manifest ───────────────────────────────────────────────────────────────────


def build_manifest() -> dict[str, Any]:
    """
    Scans the entire data/ directory and builds a summarized manifest.json.

    Entity IDs are path-based (relative to data/, no extension), making them:
      - Globally unique (filesystem uniqueness)
      - Human-readable and stable
      - No collision between same-name files in different folders

    Sections produced:
      characters, places, maps, events  — from recursive JSON walks
      documents                         — from data/ (.md and .json files)
      images                            — from data/images/ (image files)
      folders                           — all encountered directories (including empty ones)

    Returns:
        dict: The full manifest dictionary, also written to data/manifest.json.
    """
    # Define the output path for the manifest file
    manifest_path = os.path.join(DATA_DIR, "manifest.json")

    # Initialize the manifest structure
    manifest: dict[str, Any] = {
        "characters": {},  # Stores character metadata
        "places": {},  # Stores place metadata
        "maps": {},  # Stores map data
        "events": {},  # Stores event timeline data
        "documents": {},  # Stores general markdown and JSON documents
        "images": {},  # Stores image references
        "folders": [],  # List of all folders found in the data directory
    }

    # ── Scan entity JSON categories ──
    # Iterate through established entity categories (characters, places, etc.)
    for category in DIRECTORIES:
        # Resolve the absolute path to the category directory
        cat_dir = os.path.join(DATA_DIR, category)
        # Skip if the directory doesn't exist
        if not os.path.exists(cat_dir):
            continue

        # Walk recursively through the category directory
        for root, _, files in os.walk(cat_dir):
            for filename in files:
                # We only care about .json files in these specific folders
                if not filename.endswith(".json"):
                    continue

                # Skip internal configuration files or temporary files starting with underscore
                if filename.startswith("_"):
                    continue

                # Resolve the full absolute path of the file
                f_path = os.path.join(root, filename)

                # Generate a path-based ID: relative to the category root, extension removed
                rel_from_cat = os.path.relpath(f_path, cat_dir)
                entity_id = os.path.splitext(rel_from_cat)[0].replace("\\", "/")

                try:
                    # Open and parse the JSON file
                    with open(f_path, "r", encoding="utf-8") as f:
                        data: dict[str, Any] = json.load(f)

                    # Extract common metadata for the manifest entry
                    entry: dict[str, Any] = {
                        "name": data.get(
                            "name", entity_id.split("/")[-1]
                        ),  # Fallback to filename
                        "parent": data.get("parent", None),  # Hierarchy parent link
                        "type": data.get(
                            "type", None
                        ),  # Domain-specific type (e.g., 'protagonist')
                        "_type": data.get(
                            "_type",
                            category.rstrip(
                                "s"
                            ),  # Internal system type (e.g., 'character')
                        ),
                        "file": rel_from_cat.replace("\\", "/"),  # Relative file path
                    }

                    # Add category-specific fields (like character icons or place descriptions)
                    if category == "characters":
                        entry["linked_characters"] = data.get("linked_characters", [])
                        entry["folder"] = data.get("folder", "")
                        if "icon" in data:
                            entry["icon"] = data["icon"]

                    if category == "places":
                        if "description" in data:
                            # Truncate description for the manifest to keep file size small
                            entry["description"] = str(data["description"])[:200]

                    # Store the entity metadata in the manifest dictionary
                    manifest[category][entity_id] = entry

                except Exception as e:  # pylint: disable=broad-except
                    # Log errors but don't stop the whole scan
                    print(f"[manifest] Error reading {f_path}: {e}")

    # ── Scan documents and folders (recursively through DATA_DIR) ──
    # The user updated docs_dir to DATA_DIR to see everything
    docs_dir = DATA_DIR
    if os.path.exists(docs_dir):
        # Walk the data directory recursively
        for root, dirs, files in os.walk(docs_dir):
            # Register directories (including empty ones)
            for d in dirs:
                # Get the relative path of the directory from the data root
                d_rel = os.path.relpath(os.path.join(root, d), docs_dir).replace(
                    "\\", "/"
                )
                # Avoid registering internal or system folders if needed
                if d_rel not in manifest["folders"]:
                    manifest["folders"].append(d_rel)

            # Register files as documents
            for file in files:
                # We ignore files and folders that are already handled by established categories
                # or are system files like manifest.json
                if file == "manifest.json" or file.startswith("_"):
                    continue

                # Get the file extension
                ext = os.path.splitext(file)[1].lower()

                # We only treat .md and .json files as documents
                if ext not in [".md", ".json"]:
                    continue

                # Get the full path and relative path
                f_path = os.path.join(root, file)
                rel = os.path.relpath(f_path, docs_dir).replace("\\", "/")

                # Check if this file is ALREADY registered in a category (avoid duplicates)
                already_registered = False
                for cat in DIRECTORIES:
                    if rel.startswith(cat + "/"):
                        already_registered = True
                        break
                if already_registered:
                    continue

                # Generate a document ID (relative path without extension)
                doc_id = os.path.splitext(rel)[0]
                # Generate a display name (title-cased filename, underscores to spaces)
                doc_name = os.path.splitext(file)[0].replace("_", " ").title()

                # Add the document to the manifest
                manifest["documents"][doc_id] = {
                    "name": doc_name,
                    "_type": "document"
                    if ext == ".md"
                    else "data",  # Distinguish between markdown and raw JSON
                    "file": rel,  # The real path used for fetching and operations
                    "ext": ext,  # Keep the extension for frontend logic
                }

    # ── Scan images (data/images/**/*) ──
    # Resolve the images directory path
    images_dir = os.path.join(DATA_DIR, "images")
    if os.path.exists(images_dir):
        # Walk recursively through images
        for root, _, files in os.walk(images_dir):
            for file in files:
                # Filter by supported image extensions
                ext = os.path.splitext(file)[1].lower()
                if ext not in IMAGE_EXTENSIONS:
                    continue

                # Resolve paths
                f_path = os.path.join(root, file)
                rel = os.path.relpath(f_path, images_dir).replace("\\", "/")

                # Generate image ID and Name
                img_id = os.path.splitext(rel)[0]
                img_name = (
                    os.path.splitext(file)[0]
                    .replace("_", " ")
                    .replace("-", " ")
                    .title()
                )
                # Public URL for the frontend relative to server root
                img_url = "/data/images/" + rel

                # Add image metadata to the manifest
                manifest["images"][img_id] = {
                    "name": img_name,
                    "_type": "image",
                    "file": rel,
                    "url": img_url,
                    "ext": ext,
                }

    # ── Write the final manifest to disk ──
    # Using ensure_ascii=False to support non-Latin characters if present
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=4, ensure_ascii=False)

    # Return the manifest dictionary for immediate use in memory
    return manifest


# ── Generic Entity CRUD ────────────────────────────────────────────────────────


def _entity_path(category: str, entity_id: str) -> str:
    """
    Resolves the filesystem path for an entity given its category and path-based ID.

    Handles both:
      - Simple IDs: "aeron"             → data/characters/aeron.json
      - Nested IDs: "protagonists/aeron" → data/characters/protagonists/aeron.json
    """
    safe_id = entity_id.replace("\\", "/").strip("/")
    return os.path.join(DATA_DIR, category, safe_id + ".json")


def get_entity(category: str, entity_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieves raw JSON data for an entity by category and path-based ID.

    Args:
        category:  Data category folder (e.g. "characters").
        entity_id: Path-based ID (e.g. "protagonists/aeron").

    Returns:
        dict if found, None if the file does not exist.
    """
    f_path = _entity_path(category, entity_id)
    if not os.path.exists(f_path):
        return None
    with open(f_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_entity(category: str, entity_id: str, data: dict) -> None:
    """
    Saves data to an entity JSON file (creates parent directories as needed).
    Rebuilds the manifest after saving.

    Args:
        category:  Data category folder (e.g. "characters").
        entity_id: Path-based ID (e.g. "protagonists/aeron").
        data:      Payload to serialize as JSON.
    """
    f_path = _entity_path(category, entity_id)
    os.makedirs(os.path.dirname(f_path), exist_ok=True)
    with open(f_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    build_manifest()


def delete_entity(category: str, entity_id: str) -> bool:
    """
    Deletes an entity JSON file and rebuilds the manifest.

    Returns:
        True if the file was found and deleted, False otherwise.
    """
    f_path = _entity_path(category, entity_id)
    if not os.path.exists(f_path):
        return False
    os.remove(f_path)
    build_manifest()
    return True


# ── Path Safety ────────────────────────────────────────────────────────────────


def safe_join(base: str, *paths: str) -> str:
    """
    Joins paths ensuring the result stays within the base directory.
    Raises ValueError on directory traversal attempts.
    """
    final_path = os.path.abspath(os.path.join(base, *paths))
    if not final_path.startswith(os.path.abspath(base)):
        raise ValueError(f"Path traversal blocked: {final_path!r} is outside {base!r}")
    return final_path


# ── Document Operations ────────────────────────────────────────────────────────


def get_docs_dir() -> str:
    """Returns the absolute path to data/documents/."""
    return os.path.join(DATA_DIR, "documents")


def create_document(rel_path: str) -> bool:
    """
    Creates a new empty Markdown document at data/documents/<rel_path>.
    Creates parent directories automatically.

    Returns:
        True if created, False if the file already exists.
    """

    # Get the absolute path to the documents directory
    docs_dir = get_docs_dir()

    # Get the absolute path to the document file
    f_path = safe_join(docs_dir, rel_path)

    # Check if the document file already exists
    if os.path.exists(f_path):
        return False

    # Create the parent directories if they don't exist
    os.makedirs(os.path.dirname(f_path), exist_ok=True)

    # Create the document file
    with open(f_path, "w", encoding="utf-8") as f:
        # Get the document name from the relative path
        name = os.path.splitext(os.path.basename(rel_path))[0].replace("_", " ").title()

        # Write the document name to the file
        f.write(f"# {name}\n\n")

    # Rebuild the manifest
    build_manifest()

    # Return True if created
    return True


def write_document(rel_path: str, content: str) -> bool:
    """
    Overwrites the content of a document at data/documents/<rel_path>.
    Creates the file (and parent dirs) if it does not exist.
    """

    # Get the absolute path to the documents directory
    docs_dir = get_docs_dir()

    # Get the absolute path to the document file
    f_path = safe_join(docs_dir, rel_path)

    # Create the parent directories if they don't exist
    os.makedirs(os.path.dirname(f_path), exist_ok=True)

    # Write the document content to the file
    with open(f_path, "w", encoding="utf-8") as f:
        f.write(content)

    # Rebuild the manifest
    build_manifest()

    # Return True if written
    return True


def create_folder(rel_path: str) -> bool:
    """
    Creates a new folder at data/<rel_path>.

    Returns:
        True if created, False if it already exists.
    """

    # Prepare the path.
    f_path = safe_join(DATA_DIR, rel_path)

    # Check if the path already exists.
    if os.path.exists(f_path):
        # Return False if it already exists.
        return False

    # Create the path.
    os.makedirs(f_path, exist_ok=True)

    # Rebuild the manifest.
    build_manifest()

    # Return True if created.
    return True


def rename_document(old_rel_path: str, new_name: str) -> bool:
    """
    Renames a document or folder.

    Args:
        old_rel_path: Relative path from data/documents/ (e.g. "Histoire/v0/draft.md")
        new_name:     New filename only, not a full path (e.g. "brouillon.md")

    Returns:
        True on success, False if source not found or target already exists.
    """
    docs_dir = get_docs_dir()
    old_path = safe_join(docs_dir, old_rel_path)
    if not os.path.exists(old_path):
        return False

    parent_dir = os.path.dirname(old_path)
    new_path = safe_join(parent_dir, new_name)
    if os.path.exists(new_path):
        return False

    os.rename(old_path, new_path)
    build_manifest()
    return True


def move_document(old_rel_path: str, new_rel_dest_dir: str) -> bool:
    """
    Moves a document or folder to a different directory.

    Args:
        old_rel_path:    Source relative path from data/documents/
        new_rel_dest_dir: Destination DIRECTORY relative path (not the full target path)

    Returns:
        True on success, False if source not found or target already exists.
    """
    docs_dir = get_docs_dir()
    old_path = safe_join(docs_dir, old_rel_path)
    if not os.path.exists(old_path):
        return False

    dest_dir = safe_join(docs_dir, new_rel_dest_dir) if new_rel_dest_dir else docs_dir
    os.makedirs(dest_dir, exist_ok=True)

    new_path = safe_join(dest_dir, os.path.basename(old_path))
    if os.path.exists(new_path):
        return False

    shutil.move(old_path, new_path)
    build_manifest()
    return True


def copy_document(rel_path: str) -> Optional[str]:
    """
    Copies a document (files only) with a _copy_NN suffix to avoid name conflicts.

    Returns:
        Relative path of the new copy, or None on failure.
    """
    docs_dir = get_docs_dir()
    old_path = safe_join(docs_dir, rel_path)
    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return None

    dir_name = os.path.dirname(old_path)
    base = os.path.basename(old_path)
    name, ext = os.path.splitext(base)
    # Strip any existing _copy_NN to avoid stacking suffixes
    base_clean = re.sub(r"_copy_\d+$", "", name)

    counter = 1
    while True:
        new_name = f"{base_clean}_copy_{counter:02d}{ext}"
        new_path = safe_join(dir_name, new_name)
        if not os.path.exists(new_path):
            break
        counter += 1

    shutil.copy2(old_path, new_path)
    build_manifest()
    return os.path.relpath(new_path, docs_dir).replace("\\", "/")


def delete_document_file(rel_path: str) -> bool:
    """
    Deletes a document file or an entire folder (recursively) from data/documents/.

    Returns:
        True if deleted, False if not found.
    """
    docs_dir = get_docs_dir()
    f_path = safe_join(docs_dir, rel_path)
    if not os.path.exists(f_path):
        return False

    if os.path.isdir(f_path):
        shutil.rmtree(f_path)
    else:
        os.remove(f_path)

    build_manifest()
    return True


# ── Place Folder Operations ────────────────────────────────────────────────────


def create_place(name: str, parent_id: Optional[str] = None) -> Optional[str]:
    """
    Creates a new place by making a real folder on disk and writing empty
    place.json and map.json files inside it.

    Folder structure:
      data/places/<name>/place.json          (root place)
      data/places/<parent>/<name>/place.json (nested sub-place)

    Args:
        name:      The place name (used as the folder name, slugified).
        parent_id: Optional parent place path-based ID (e.g. "teria").

    Returns:
        The new place's path-based ID (e.g. "teria/risnia"), or None if it already exists.
    """
    places_dir = os.path.join(DATA_DIR, "places")
    folder_name = name.lower().replace(" ", "_").replace("/", "_")

    if parent_id:
        # Nested: resolve parent folder path
        parent_rel = parent_id.replace("/", os.sep)
        place_dir = safe_join(places_dir, parent_rel, folder_name)
        place_id = f"{parent_id}/{folder_name}"
    else:
        place_dir = safe_join(places_dir, folder_name)
        place_id = folder_name

    if os.path.exists(place_dir):
        return None  # Already exists

    os.makedirs(place_dir, exist_ok=True)

    # Write initial place.json
    place_data: dict[str, Any] = {
        "_type": "place",
        "name": name,
        "type": "region",
        "parent": parent_id,
        "description": "",
        "gallery": [],
        "icon": None,
    }
    with open(os.path.join(place_dir, "place.json"), "w", encoding="utf-8") as f:
        json.dump(place_data, f, indent=4, ensure_ascii=False)

    # Write initial map.json
    map_data: dict[str, Any] = {
        "_type": "map",
        "name": name,
        "nodes": {},
        "edges": {},
        "polygons": {},
        "layers": {},
    }
    with open(os.path.join(place_dir, "map.json"), "w", encoding="utf-8") as f:
        json.dump(map_data, f, indent=4, ensure_ascii=False)

    build_manifest()
    return place_id


# ── Image Operations ───────────────────────────────────────────────────────────


def get_images_dir() -> str:
    """Returns the absolute path to data/images/."""
    return os.path.join(DATA_DIR, "images")


def upload_image(rel_dir: str, filename: str, data: bytes) -> Optional[str]:
    """
    Saves a binary image to data/images/<rel_dir>/<filename>.

    Args:
        rel_dir:  Sub-directory within data/images/ (may be empty string for root).
        filename: Original filename; sanitized before saving.
        data:     Raw bytes of the image file.

    Returns:
        The public URL path (e.g. "/data/images/portraits/aeron.png") on success,
        or None if the file extension is not allowed.
    """
    images_dir = get_images_dir()
    dest_dir = safe_join(images_dir, rel_dir) if rel_dir else images_dir
    os.makedirs(dest_dir, exist_ok=True)

    safe_filename = os.path.basename(filename)
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        return None

    file_path = safe_join(dest_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(data)

    build_manifest()
    rel_url = os.path.relpath(file_path, DATA_DIR).replace("\\", "/")
    return f"/data/{rel_url}"


def list_images() -> dict[str, Any]:
    """Returns the images section of the current manifest."""
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f).get("images", {})
    return {}


def delete_image(rel_path: str) -> bool:
    """
    Deletes a single image file from data/images/<rel_path>.

    Returns:
        True if deleted, False if not found or not a file.
    """
    images_dir = get_images_dir()
    f_path = safe_join(images_dir, rel_path)
    if not os.path.exists(f_path) or not os.path.isfile(f_path):
        return False
    os.remove(f_path)
    build_manifest()
    return True
