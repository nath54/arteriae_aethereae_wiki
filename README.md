# Arteriae Aethereae Wiki-Map Engine

## Goal
The **Arteriae Aethereae Wiki-Map Engine** is a specialized world-building tool for the Arteriae Aethereae project. It integrates a relational wiki with a complex polygon-based mapping system. It features a hierarchical graph data structure for maps (from planets to continents down to single cities), linked with rich character, place, and event entity data.

## Project Organization
- `backend/`: Python FastAPI backend. This runs the Edit Server, which interacts with the local file system to modify project files.
- `frontend/`: Vanilla JavaScript frontend relying on HTML5 SVG for the map rendering. It uses lazy loading to fetch individual data files efficiently.
- `data/`: Relational data files in JSON format (maps, characters, places, etc.) along with the lightweight `manifest.json` indexing everything.
- `res/`: Project resources, including fonts and generic assets.

## Usage Instructions

### Python Environment
The project uses a Python virtual environment located at `.venv`. To install backend dependencies:
```bash
# Windows
.venv\Scripts\Activate.ps1

# Linux/Mac
source .venv/bin/activate

pip install fastapi uvicorn
```

### View Mode (Read-only)
The View Mode relies on a simple local HTTP server to allow standard JS `fetch()` requests without CORS errors.
Run either of the following scripts from the project root to start the server:
- Windows: `.\view_server.ps1`
- Linux/Mac: `./view_server.sh`

Navigate to `http://localhost:8000/frontend/index.html` to view the Wiki-Map Engine.

### Edit Mode
The Edit Mode is backed by a FastAPI server that handles modifying the `data/` files and regenerating `manifest.json`.
(FastAPI server startup instructions to be added).
