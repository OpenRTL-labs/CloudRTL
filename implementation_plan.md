# Implementation Plan - Milestone 8: Basic Waveform Artifact Handling

Implement safe VCD waveform artifact discovery and downloading in CloudRTL for the `counter` project.

## User Review Required
> [!NOTE]
> No breaking changes or architecture redesigns are introduced. All Milestone 7 simulation workflows (Docker/Icarus/VVP) remain intact.
> Existing Vite proxy configuration (`/projects` -> `http://localhost:8000`) will be used directly.

## Proposed Changes

### Backend (`backend/app/main.py`)

#### [MODIFY] [main.py](file:///c:/CloudRTL/git/backend/app/main.py)
1. **Import `FileResponse`** from `fastapi.responses`.
2. **Add Pydantic models** for artifact metadata:
   - `ArtifactItem`: fields `name: str`, `type: str`.
   - `ArtifactsResponse`: fields `project: str`, `artifacts: list[ArtifactItem]`.
3. **Add Endpoint: `GET /projects/{project_name}/artifacts`**
   - Validate project existence (404 if not found).
   - Resolve `work_dir = (SIMULATOR_DIR / "work").resolve()`.
   - Scan for files matching `{project_name}.*` or `{project_name}_*` (e.g. `counter.vcd`, `counter.vvp`).
   - Assign types: `.vcd` -> `"waveform"`, `.vvp` -> `"simulation"`.
   - Return list of available artifacts.
4. **Add Endpoint: `GET /projects/{project_name}/artifacts/{artifact_name}`**
   - Validate project existence (404 if not found).
   - Strict path traversal security check:
     - Reject if `artifact_name != Path(artifact_name).name` or contains `/`, `\`, or `..` (returns HTTP 400).
     - Resolve target path: `target_path = (work_dir / artifact_name).resolve()`.
     - Verify `target_path.relative_to(work_dir)` (raises 400 if outside).
   - Project ownership check:
     - Verify `artifact_name` starts with `matched_project.name` (returns 404 if mismatched).
   - Existence check:
     - Verify `target_path.is_file()` (returns 404 if not found).
   - Return `FileResponse(path=target_path, filename=artifact_name, media_type="application/octet-stream")`.

---

### Frontend (`frontend/src/App.jsx`)

#### [MODIFY] [App.jsx](file:///c:/CloudRTL/git/frontend/src/App.jsx)
1. In `ProjectWorkspace`:
   - Add state: `artifacts`, `artifactsStatus` (`'idle' | 'loading' | 'loaded' | 'error'`), `artifactsError`.
   - Before simulation (`simStatus === 'idle'`), display "No simulation artifacts yet." in the Artifacts area.
   - When simulation starts, reset artifacts state.
   - On simulation success (`status === 'success'`), fetch `/projects/${project.name}/artifacts` through the Vite proxy.
   - On simulation failure, do not claim a waveform was generated.
   - Render the Artifacts list in the Simulation card:
     - Filename (e.g. `counter.vcd`)
     - Badge/label: `Waveform`
     - Download button / link pointing to `/projects/${project.name}/artifacts/${artifact.name}` with `download={artifact.name}`.
   - Handle artifact fetch errors gracefully without breaking the UI.

---

## Verification Plan

### Automated / CLI Tests
1. Start FastAPI backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
2. Test health check:
   - `curl -i http://127.0.0.1:8000/health` (verify HTTP 200).
3. Test projects and files endpoints:
   - `curl -i http://127.0.0.1:8000/projects` (verify HTTP 200).
   - `curl -i http://127.0.0.1:8000/projects/counter/files` (verify HTTP 200).
4. Run simulation:
   - `curl -i -X POST http://127.0.0.1:8000/projects/counter/simulate` (verify status=success, return_code=0).
5. Verify artifact discovery:
   - `curl -i http://127.0.0.1:8000/projects/counter/artifacts` (verify JSON containing `counter.vcd`).
6. Verify artifact download:
   - `curl -i http://127.0.0.1:8000/projects/counter/artifacts/counter.vcd` (verify HTTP 200, Content-Disposition header, file body).
7. Verify 404 behavior:
   - Nonexistent artifact: `curl -i http://127.0.0.1:8000/projects/counter/artifacts/nonexistent.vcd` (verify HTTP 404).
   - Nonexistent project: `curl -i http://127.0.0.1:8000/projects/badproject/artifacts/counter.vcd` (verify HTTP 404).
8. Verify path traversal protection:
   - Traversal attempt: `curl -i http://127.0.0.1:8000/projects/counter/artifacts/..%2F..%2Fmain.py` (verify HTTP 400).
9. Frontend production build:
   - `cd frontend && npm run build` (must succeed with code 0).

### Manual / Visual Verification
1. Launch Vite dev server.
2. Navigate to `http://localhost:5173`.
3. Open project `counter`.
4. Observe initial Artifacts state ("No simulation artifacts yet.").
5. Click "Run Simulation".
6. Observe simulation output and success status.
7. Observe Artifacts list displaying `counter.vcd` and "Download VCD".
8. Click "Download VCD" and verify the VCD file is downloaded properly.
