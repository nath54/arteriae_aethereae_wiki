"""
Data Manager for Arteriae Aethereae
Handles the underlying file system operations: reading, writing, and deleting JSON entities,
as well as building the central `manifest.json`.

VARIABLES AVAILABLE TO DEVELOPERS:
- `DATA_DIR` (str): Absolute file path to the `/data` directory where JSON files are stored.
- `DIRECTORIES` (list[str]): The supported core data categories.

HOOK POINTS:
- If you want to add a new category
    (e.g., "items", "spells", "factions"),
    simply add it to the `DIRECTORIES` list.
"""

# Import Any to easily type dictionnaries and Optional for optional values
from typing import Any, Optional

# Import os for file management and json to manage json files
import os
import json
import shutil


# Define the path to the data directory
DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

# Define the list of directories to scan for JSON files
DIRECTORIES: list[str] = ["characters", "places", "maps", "events"]

# Image extensions supported
IMAGE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"}


# Function to initialize the data directories
def init_data_dirs() -> None:
    """
    Initializes the required data directories if they don't exist.
    Called once during server startup (by `main.py`).
    Creates the main `data` dir, subdirectories for each category,
    and builds an initial manifest if missing.
    """

    # Create the data directory if it doesn't exist
    os.makedirs(DATA_DIR, exist_ok=True)

    # Create the subdirectories if they don't exist
    for d in DIRECTORIES:
        os.makedirs(os.path.join(DATA_DIR, d), exist_ok=True)

    # Create the images directory
    os.makedirs(os.path.join(DATA_DIR, "images"), exist_ok=True)

    # Create the documents directory
    os.makedirs(os.path.join(DATA_DIR, "documents"), exist_ok=True)

    # Always rebuild manifest to ensure it is up-to-date with filesystem
    build_manifest()


# Function to build the manifest
def build_manifest() -> dict[str, Any]:
    """
    Scans all JSON files in the `DIRECTORIES` and builds a summarized `manifest.json`.
    This manifest is used by the frontend for fast initial loading
    and displaying the knowledge graph without reading every single file.

    Returns:
        dict: The global manifest dictionary organized by category.

    HOOK POINT: If you add new top-level data fields to your entities (like "tags", "aliases")
    that need to be globally searchable or visible in the graph,
    extract them here into the `entry` dictionary.
    """

    # Get the path to the manifest file
    manifest_path: str = os.path.join(DATA_DIR, "manifest.json")

    # Initialize the manifest dictionary for each category
    manifest: dict[str, Any] = {
        "characters": {},
        "places": {},
        "maps": {},
        "events": {},
        "documents": {},
        "images": {},
    }

    # Helper function to slugify paths/names
    def slugify(text: str) -> str:
        return text.lower().replace(" ", "_").replace("/", "_").replace("\\", "_")

    # Type hinting, category is a string
    category: str

    # Loop through each category
    for category in DIRECTORIES:
        #
        # Get the path to the category directory
        cat_dir: str = os.path.join(DATA_DIR, category)

        # Skip if the category directory doesn't exist
        if not os.path.exists(cat_dir):
            continue

        # Type hinting, filename is a string
        filename: str

        # Loop through each file in the category directory
        for filename in os.listdir(cat_dir):
            #
            # Skip if the file is not a JSON file
            if filename.endswith(".json"):
                #
                # Get the path to the file
                f_path: str = os.path.join(cat_dir, filename)

                # Get the entity ID from the filename
                entity_id: str = filename[:-5]

                # Try to open and read the file
                try:
                    #
                    # Open the file
                    with open(f_path, "r", encoding="utf-8") as f:
                        #
                        # Load the data into a json file
                        data: dict[str, Any] = json.load(f)

                        # Extract minimalist info for manifest
                        entry: dict[str, Any] = {
                            "name": data.get("name", entity_id),
                            "parent": data.get("parent", None),
                            "type": data.get("type", None),
                        }

                        # Add description if the category is "places"
                        if category == "places" and "description" in data:
                            entry["description"] = data["description"]

                        # Add the entry to the manifest
                        manifest[category][entity_id] = entry

                # Catch any errors that may occur while reading the file
                except Exception as e:  # pylint: disable=broad-except
                    #
                    # Print an error message
                    print(f"Error reading {filename}: {e}")

    # Scan for markdown documents in data/documents
    docs_dir = os.path.join(DATA_DIR, "documents")
    if os.path.exists(docs_dir):
        for root, _, files in os.walk(docs_dir):
            for file in files:
                if file.endswith(".md"):
                    # Calculate relative path from docs_dir for unique ID
                    rel_path = os.path.relpath(os.path.join(root, file), docs_dir)
                    # Convert path separators to underscore to create a unique ID
                    doc_id = slugify(rel_path[:-3])  # exclude '.md'

                    doc_name = file[:-3].replace("_", " ").title()

                    manifest["documents"][doc_id] = {
                        "name": doc_name,
                        "type": "doc",
                        "file": rel_path.replace(
                            "\\", "/"
                        ),  # store path with forward slashes
                    }

    # Scan for images in data/images
    images_dir = os.path.join(DATA_DIR, "images")
    if os.path.exists(images_dir):
        for root, _, files in os.walk(images_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in IMAGE_EXTENSIONS:
                    rel_path = os.path.relpath(os.path.join(root, file), images_dir)
                    img_id = slugify(os.path.splitext(rel_path)[0])  # exclude extension
                    img_name = (
                        os.path.splitext(file)[0]
                        .replace("_", " ")
                        .replace("-", " ")
                        .title()
                    )
                    img_url = "/data/images/" + rel_path.replace("\\", "/")
                    manifest["images"][img_id] = {
                        "name": img_name,
                        "type": "image",
                        "file": rel_path.replace("\\", "/"),
                        "url": img_url,
                        "ext": ext,
                    }

    # Open the manifest file and write the manifest to it
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=4)

    return manifest


# Function to get an entity
def get_entity(category: str, entity_id: str) -> Optional[dict[str, Any]]:
    """
    Retrieves the raw data for a requested entity.

    Args:
        category (str): The category folder to look in (e.g., "characters").
        entity_id (str): The file name without the .json extension.

    Returns:
        dict: The loaded JSON data.
        None: If the file doesn't exist.
    """

    # Get the path to the entity file
    f_path = os.path.join(DATA_DIR, category, f"{entity_id}.json")

    # Return None if the file doesn't exist
    if not os.path.exists(f_path):
        return None

    # Open the file and return the data
    with open(f_path, "r", encoding="utf-8") as f:
        return json.load(f)


# Function to save an entity
def save_entity(category: str, entity_id: str, data: dict) -> None:
    """
    Saves the provided data dictionary into a JSON file, creating directories if needed.
    Also triggers a rebuild of the manifest,
    because new or updated items must appear in the global list immediately.

    Args:
        category (str): The category folder.
        entity_id (str): The unique ID/filename.
        data (dict): The payload to save.

    HOOK POINT: You could add data validation schemas,
    type checking, or preprocessing hooks here before writing to disk.
    """

    # Create the category directory if it doesn't exist
    os.makedirs(os.path.join(DATA_DIR, category), exist_ok=True)

    # Get the path to the entity file
    f_path = os.path.join(DATA_DIR, category, f"{entity_id}.json")

    # Open the file and write the data
    with open(f_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

    # Rebuild manifest when a file is saved
    build_manifest()


# Function to delete an entity
def delete_entity(category: str, entity_id: str) -> bool:
    """
    Deletes an entity JSON file and rebuilds the manifest.

    Args:
        category (str): The category folder.
        entity_id (str): The unique ID/filename.

    Returns:
        bool: True if successfully deleted, False if the file didn't exist.
    """

    # Get the path to the entity file
    f_path = os.path.join(DATA_DIR, category, f"{entity_id}.json")

    # Delete the file if it exists
    if os.path.exists(f_path):
        #
        # Delete the file
        os.remove(f_path)

        # Rebuild the manifest
        build_manifest()

        # Return True if the file was deleted
        return True

    # Return False if the file doesn't exist
    return False


# Function to safely join paths within a base directory
def safe_join(base: str, *paths: str) -> str:
    """Safely join paths ensuring the result stays within the base directory."""
    final_path = os.path.abspath(os.path.join(base, *paths))
    if not final_path.startswith(os.path.abspath(base)):
        raise ValueError("Path manipulation detected. Directory traversal blocked.")
    return final_path


# Helper to ensure documents dir exists
def get_docs_dir() -> str:
    return os.path.join(DATA_DIR, "documents")


# Function to get document context
def create_document(rel_path: str) -> bool:
    docs_dir = get_docs_dir()
    f_path = safe_join(docs_dir, rel_path)
    if os.path.exists(f_path):
        return False
    os.makedirs(os.path.dirname(f_path), exist_ok=True)
    with open(f_path, "w", encoding="utf-8") as f:
        f.write("# New Document\n")
    build_manifest()
    return True


# Function to write document context
def write_document(rel_path: str, content: str) -> bool:
    docs_dir = get_docs_dir()
    f_path = safe_join(docs_dir, rel_path)
    os.makedirs(os.path.dirname(f_path), exist_ok=True)
    with open(f_path, "w", encoding="utf-8") as f:
        f.write(content)
    build_manifest()
    return True


# Function to create a folder
def create_folder(rel_path: str) -> bool:
    docs_dir = get_docs_dir()
    f_path = safe_join(docs_dir, rel_path)
    if os.path.exists(f_path):
        return False
    os.makedirs(f_path, exist_ok=True)
    build_manifest()
    return True


# Function to rename a document or folder
def rename_document(old_rel_path: str, new_name: str) -> bool:
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


# Function to move a document or folder
def move_document(old_rel_path: str, new_rel_dest_dir: str) -> bool:
    docs_dir = get_docs_dir()
    old_path = safe_join(docs_dir, old_rel_path)
    if not os.path.exists(old_path):
        return False

    dest_dir = safe_join(docs_dir, new_rel_dest_dir)
    os.makedirs(dest_dir, exist_ok=True)

    new_path = safe_join(dest_dir, os.path.basename(old_path))
    if os.path.exists(new_path):
        return False

    shutil.move(old_path, new_path)
    build_manifest()
    return True


# Function to copy a document
def copy_document(rel_path: str) -> Optional[str]:
    docs_dir = get_docs_dir()
    old_path = safe_join(docs_dir, rel_path)
    if not os.path.exists(old_path):
        return None

    if not os.path.isfile(old_path):
        return None  # Only copy files for now

    dir_name = os.path.dirname(old_path)
    base_name = os.path.basename(old_path)
    name, ext = os.path.splitext(base_name)

    # Strip any existing _copy_XX from name to avoid _copy_01_copy_01
    import re

    base_name_no_copy = re.sub(r"_copy_\d+$", "", name)

    counter = 1
    while True:
        new_name = f"{base_name_no_copy}_copy_{counter:02d}{ext}"
        new_path = safe_join(dir_name, new_name)
        if not os.path.exists(new_path):
            break
        counter += 1

    shutil.copy2(old_path, new_path)
    build_manifest()

    # Return the new relative path
    return os.path.relpath(new_path, docs_dir).replace("\\", "/")


# Function to delete a document or folder
def delete_document_file(rel_path: str) -> bool:
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


# ── Image Management ──


def get_images_dir() -> str:
    """Returns the absolute path to the data/images directory."""
    return os.path.join(DATA_DIR, "images")


def upload_image(rel_dir: str, filename: str, data: bytes) -> Optional[str]:
    """
    Saves a binary image to data/images/<rel_dir>/<filename>.
    Returns the relative URL path on success, or None on failure.
    """
    images_dir = get_images_dir()
    dest_dir = safe_join(images_dir, rel_dir) if rel_dir else images_dir
    os.makedirs(dest_dir, exist_ok=True)

    # Sanitize filename
    safe_filename = os.path.basename(filename)
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        return None

    file_path = safe_join(dest_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(data)

    build_manifest()
    rel_url_path = os.path.relpath(file_path, DATA_DIR).replace("\\", "/")
    return f"/data/{rel_url_path}"


def list_images() -> dict[str, Any]:
    """Returns the images section of the manifest."""
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            m = json.load(f)
            return m.get("images", {})
    return {}


def delete_image(rel_path: str) -> bool:
    """Deletes an image file from the images directory."""
    images_dir = get_images_dir()
    f_path = safe_join(images_dir, rel_path)
    if not os.path.exists(f_path) or not os.path.isfile(f_path):
        return False
    os.remove(f_path)
    build_manifest()
    return True
