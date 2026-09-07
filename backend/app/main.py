import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException
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

