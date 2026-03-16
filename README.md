# testplanner

## Run locally

Backend:

```bash
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Frontend development:

```bash
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies API calls to the backend automatically.

## Run as one service

Build the frontend once:

```bash
cd frontend
npm ci
npm run build
```

Then start the backend from the repo root:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open `http://<server-ip>:8000` from the display machine. The backend serves the built frontend from `frontend/dist`.

## Data import

The app itself does not require the CSV at runtime. If you want to seed employees from a CSV export, run:

```bash
python backend/import_data.py
```

You can override the CSV path with `PLANNER_IMPORT_CSV`.
