#!/bin/bash
echo "Starting simple Python HTTP server for View Mode on port 8000..."
echo "Access the app at: http://localhost:8000/frontend/index.html"
python3 -m http.server 8000
