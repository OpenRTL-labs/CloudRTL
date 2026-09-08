import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SIMULATOR_DIR = REPO_ROOT / "simulator"

app = FastAPI(
    title="CloudRTL",
    description="Cloud-Based RTL Simulation Platform",
    version="0.1.0",
)

class Project(BaseModel):
    name: str
    type: str
    technology: str
    top_module: str
    status: str

class ProjectFile(BaseModel):
    name: str
    type: str

class SimulationResponse(BaseModel):
    project: str
    status: str
    return_code: int
    output: str

class ArtifactItem(BaseModel):
    name: str
    type: str

class ArtifactsResponse(BaseModel):
    project: str
    artifacts: list[ArtifactItem]

projects = [
    Project(
        name="counter",
        type="RTL Design Project",
        technology="Nangate45",
        top_module="counter",
        status="ready",
    )
]

project_files = {
    "counter": [
        ProjectFile(name="counter.v", type="rtl"),
        ProjectFile(name="counter_tb.v", type="testbench"),
    ]
}

@app.get("/")
def root():
    return {
        "project": "CloudRTL",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/projects")
def get_projects():
    return {"projects": projects}

@app.get("/projects/{project_name}")
def get_project(project_name: str):
    for project in projects:
        if project.name == project_name:
            return project

    return {"detail": "Project not found"}

@app.get("/projects/{project_name}/files")
def get_project_files(project_name: str):
    for project in projects:
        if project.name == project_name:
            return {
                "project": project.name,
                "files": project_files.get(project.name, []),
            }

    raise HTTPException(status_code=404, detail="Project not found")

@app.post("/projects/{project_name}/simulate", response_model=SimulationResponse)
def simulate_project(project_name: str):
    matched_project = next((p for p in projects if p.name == project_name), None)
    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    files = project_files.get(matched_project.name, [])
    if not files:
        raise HTTPException(status_code=400, detail=f"No files configured for project '{project_name}'")

    rtl_args = []
    tb_args = []

    for f in files:
        if f.type == "rtl":
            rel_path = f"examples/{f.name}"
            host_path = SIMULATOR_DIR / rel_path
            if not host_path.is_file():
                raise HTTPException(status_code=400, detail=f"RTL file '{f.name}' not found at '{rel_path}'")
            rtl_args.append(rel_path)
        elif f.type == "testbench":
            rel_path = f"tests/{f.name}"
            host_path = SIMULATOR_DIR / rel_path
            if not host_path.is_file():
                raise HTTPException(status_code=400, detail=f"Testbench file '{f.name}' not found at '{rel_path}'")
            tb_args.append(rel_path)

    if not rtl_args:
        raise HTTPException(status_code=400, detail=f"No RTL files found for project '{project_name}'")
    if not tb_args:
        raise HTTPException(status_code=400, detail=f"No testbench files found for project '{project_name}'")

    output_vvp = f"work/{matched_project.name}.vvp"
    (SIMULATOR_DIR / "work").mkdir(parents=True, exist_ok=True)

    # Step 1: iverilog compilation in Docker
    compile_cmd = [
        "docker", "run", "--rm",
        "-v", f"{SIMULATOR_DIR}:/workspace",
        "-w", "/workspace",
        "cloudrtl-eda:0.1",
        "iverilog",
        "-o", output_vvp,
        *rtl_args,
        *tb_args,
    ]

    try:
        comp_res = subprocess.run(
            compile_cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=1,
            output="Compilation timed out after 30 seconds.",
        )
    except Exception as e:
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=1,
            output=f"Docker compilation error: {str(e)}",
        )

    if comp_res.returncode != 0:
        comp_output = (comp_res.stdout or "") + (("\n" + comp_res.stderr) if comp_res.stderr else "")
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=comp_res.returncode,
            output=comp_output.strip() or "RTL compilation failed.",
        )

    # Step 2: vvp execution in Docker
    sim_cmd = [
        "docker", "run", "--rm",
        "-v", f"{SIMULATOR_DIR}:/workspace",
        "-w", "/workspace",
        "cloudrtl-eda:0.1",
        "vvp",
        output_vvp,
    ]

    try:
        sim_res = subprocess.run(
            sim_cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=1,
            output="Simulation timed out after 30 seconds.",
        )
    except Exception as e:
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=1,
            output=f"Docker simulation execution error: {str(e)}",
        )

    sim_output = (sim_res.stdout or "") + (("\n" + sim_res.stderr) if sim_res.stderr else "")

    if sim_res.returncode != 0:
        return SimulationResponse(
            project=project_name,
            status="failed",
            return_code=sim_res.returncode,
            output=sim_output.strip() or "Simulation failed.",
        )

    return SimulationResponse(
        project=project_name,
        status="success",
        return_code=0,
        output=sim_output.strip() or "Simulation completed successfully.",
    )


@app.get("/projects/{project_name}/artifacts", response_model=ArtifactsResponse)
def get_project_artifacts(project_name: str):
    matched_project = next((p for p in projects if p.name == project_name), None)
    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (SIMULATOR_DIR / "work").resolve()
    artifacts: list[ArtifactItem] = []

    if work_dir.is_dir():
        prefix = f"{matched_project.name}"
        for f in sorted(work_dir.iterdir()):
            if f.is_file() and (f.name.startswith(f"{prefix}.") or f.name.startswith(f"{prefix}_")):
                if f.suffix == ".vcd":
                    artifact_type = "waveform"
                elif f.suffix == ".vvp":
                    artifact_type = "simulation"
                elif f.suffix == ".v":
                    artifact_type = "netlist"
                else:
                    artifact_type = "artifact"
                artifacts.append(ArtifactItem(name=f.name, type=artifact_type))

    artifacts.sort(key=lambda a: (0 if a.type == "waveform" else 1, a.name))

    return ArtifactsResponse(
        project=project_name,
        artifacts=artifacts,
    )


@app.get("/projects/{project_name}/artifacts/{artifact_name}")
def get_project_artifact(project_name: str, artifact_name: str):
    matched_project = next((p for p in projects if p.name == project_name), None)
    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Prevent path traversal and arbitrary filesystem access
    if (
        artifact_name != Path(artifact_name).name
        or "/" in artifact_name
        or "\\" in artifact_name
        or ".." in artifact_name
    ):
        raise HTTPException(status_code=400, detail="Invalid artifact name: path traversal is not allowed")

    # Only allow artifacts that belong to this project
    prefix = f"{matched_project.name}"
    if not (artifact_name.startswith(f"{prefix}.") or artifact_name.startswith(f"{prefix}_")):
        raise HTTPException(status_code=404, detail="Artifact not found for this project")

    work_dir = (SIMULATOR_DIR / "work").resolve()
    target_path = (work_dir / artifact_name).resolve()

    # Verify target path is strictly within work_dir
    try:
        target_path.relative_to(work_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact path")

    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(
        path=target_path,
        filename=artifact_name,
        media_type="application/octet-stream",
    )

