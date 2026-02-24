"""
TODO: docstring
"""

import os
import json

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DIRECTORIES = ["characters", "places", "maps", "events"]


def init_data_dirs():
    """
    TODO: docstring
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    for d in DIRECTORIES:
        os.makedirs(os.path.join(DATA_DIR, d), exist_ok=True)

    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        build_manifest()


def build_manifest():
    """
    TODO: docstring
    """
    manifest_path = os.path.join(DATA_DIR, "manifest.json")
    manifest = {"characters": {}, "places": {}, "maps": {}, "events": {}}

    for category in DIRECTORIES:
        cat_dir = os.path.join(DATA_DIR, category)
        if not os.path.exists(cat_dir):
            continue

        for filename in os.listdir(cat_dir):
            if filename.endswith(".json"):
                f_path = os.path.join(cat_dir, filename)
                entity_id = filename[:-5]
                try:
                    with open(f_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        # Extract minimalist info for manifest
                        manifest[category][entity_id] = {
                            "name": data.get("name", entity_id),
                            "parent": data.get("parent", None),
                            "type": data.get("type", None),
                        }
                except Exception as e:  # pylint: disable=broad-except
                    print(f"Error reading {filename}: {e}")

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=4)

    return manifest


def get_entity(category: str, entity_id: str):
    """
    TODO: docstring
    """
    f_path = os.path.join(DATA_DIR, category, f"{entity_id}.json")
    if not os.path.exists(f_path):
        return None
    with open(f_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_entity(category: str, entity_id: str, data: dict):
    """
    TODO: docstring
    """
    os.makedirs(os.path.join(DATA_DIR, category), exist_ok=True)
    f_path = os.path.join(DATA_DIR, category, f"{entity_id}.json")
    with open(f_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    # Rebuild manifest when a file is saved
    build_manifest()
