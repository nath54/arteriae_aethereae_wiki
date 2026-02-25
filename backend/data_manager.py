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


# Define the path to the data directory
DATA_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

# Define the list of directories to scan for JSON files
DIRECTORIES: list[str] = ["characters", "places", "maps", "events"]


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
