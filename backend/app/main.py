from sqlalchemy.orm import descriptor_props
import re
import shutil
import subprocess
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import get_current_user, router as auth_router
from .database import get_db, test_database_connection
from .models import Project as DBProject, ProjectFile as DBProjectFile, User

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SIMULATOR_DIR = REPO_ROOT / "simulator"
PHYSICAL_DIR = REPO_ROOT / "physical"
WORKSPACE_BASE = SIMULATOR_DIR / "workspace"

# ============== VCD WAVEFORM PARSER ==============
def parse_vcd(vcd_path: Path):
    signals = []
    signal_map = {}
    current_scope = []
    current_time = 0
    top_scope = None

    with vcd_path.open("r", encoding="utf-8", errors="replace") as vcd_file:
        for raw_line in vcd_file:
            line = raw_line.strip()

            if not line:
                continue

            if line.startswith("$scope"):
                parts = line.split()

                if len(parts) >= 3:
                    scope_name = parts[2]
                    current_scope.append(scope_name)

                    if top_scope is None:
                        top_scope = scope_name

                continue

            if line.startswith("$upscope"):
                if current_scope:
                    current_scope.pop()
                continue

            if line.startswith("$var"):
                parts = line.split()

                if len(parts) >= 5:
                    width = int(parts[2])
                    identifier = parts[3]
                    name = parts[4]

                    # Only expose signals declared directly
                    # inside the top-level testbench scope.
                    if (
                        top_scope is not None
                        and len(current_scope) == 1
                        and current_scope[0] == top_scope
                    ):
                        signal = {
                            "name": name,
                            "width": width,
                            "changes": [],
                        }

                        signals.append(signal)
                        signal_map[identifier] = signal

                continue

            if line.startswith("#"):
                try:
                    current_time = int(line[1:])
                except ValueError:
                    continue

                continue

            # Scalar value change
            if len(line) >= 2 and line[0] in "01xXzZ":
                identifier = line[1:]
                signal = signal_map.get(identifier)

                if signal is not None:
                    signal["changes"].append(
                        {
                            "time": current_time,
                            "value": line[0],
                        }
                    )

                continue

            # Vector value change
            if line.startswith("b") or line.startswith("B"):
                parts = line.split()

                if len(parts) >= 2:
                    value = parts[0][1:]
                    identifier = parts[1]
                    signal = signal_map.get(identifier)

                    if signal is not None:
                        signal["changes"].append(
                            {
                                "time": current_time,
                                "value": value,
                            }
                        )

    return signals

app = FastAPI(
    title="CloudRTL",
    description="Cloud-Based RTL Simulation Platform",
    version="0.1.0",
)

app.include_router(auth_router)

class Project(BaseModel):
    name: str
    type: str
    technology: str
    top_module: str
    status: str

class ProjectFile(BaseModel):
    name: str
    type: str

class CreateProjectRequest(BaseModel):
    name: str
    top_module: str
    technology: str

class AddFileRequest(BaseModel):
    name: str
    type: str
    content: str = ""


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

def get_project_workspace_dir(user_id: int, project_id: int) -> Path:
    return WORKSPACE_BASE / str(user_id) / str(project_id)


def ensure_project_workspace(user_id: int, project_id: int) -> dict[str, Path]:
    base = get_project_workspace_dir(user_id, project_id)
    rtl_dir = base / "rtl"
    tb_dir = base / "testbench"
    work_dir = base / "work"
    artifacts_dir = base / "artifacts"

    rtl_dir.mkdir(parents=True, exist_ok=True)
    tb_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    return {
        "base": base,
        "rtl": rtl_dir,
        "testbench": tb_dir,
        "work": work_dir,
        "artifacts": artifacts_dir,
    }


def resolve_user_project(project_name: str, user: User, db: Session) -> DBProject:
    project = (
        db.query(DBProject)
        .filter(
            DBProject.user_id == user.id,
            DBProject.name == project_name,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def ensure_user_default_project(user: User, db: Session) -> DBProject | None:
    existing = (
        db.query(DBProject)
        .filter(
            DBProject.user_id == user.id,
            func.lower(DBProject.name) == "counter",
        )
        .first()
    )
    if existing:
        return existing

    user_project_count = (
        db.query(DBProject)
        .filter(DBProject.user_id == user.id)
        .count()
    )
    if user_project_count > 0:
        return None

    counter_proj = DBProject(
        user_id=user.id,
        name="counter",
        type="RTL Design Project",
        technology="Nangate45",
        top_module="counter",
        status="ready",
    )
    db.add(counter_proj)
    db.commit()
    db.refresh(counter_proj)

    file_rtl = DBProjectFile(
        project_id=counter_proj.id,
        name="counter.v",
        type="rtl",
    )
    file_tb = DBProjectFile(
        project_id=counter_proj.id,
        name="counter_tb.v",
        type="testbench",
    )
    db.add_all([file_rtl, file_tb])
    db.commit()

    dirs = ensure_project_workspace(user.id, counter_proj.id)
    ref_rtl = SIMULATOR_DIR / "examples" / "counter.v"
    ref_tb = SIMULATOR_DIR / "tests" / "counter_tb.v"

    if ref_rtl.is_file():
        (dirs["rtl"] / "counter.v").write_text(
            ref_rtl.read_text(encoding="utf-8", errors="replace"),
            encoding="utf-8",
        )
    if ref_tb.is_file():
        (dirs["testbench"] / "counter_tb.v").write_text(
            ref_tb.read_text(encoding="utf-8", errors="replace"),
            encoding="utf-8",
        )

    return counter_proj


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


@app.get("/db-health")
def database_health_check():
    try:
        test_database_connection()
        return {"status": "database connected"}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(exc)}",
        )


@app.get("/projects")
def get_projects(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    ensure_user_default_project(current_user, db)

    user_projects = (
        db.query(DBProject)
        .filter(DBProject.user_id == current_user.id)
        .order_by(DBProject.created_at.asc())
        .all()
    )
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "type": p.type,
                "technology": p.technology,
                "top_module": p.top_module,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in user_projects
        ]
    }


@app.post("/projects", status_code=201)
def create_project(
    request: CreateProjectRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    name = request.name.strip()
    top_module = request.top_module.strip()
    technology = request.technology.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Project name cannot be empty.")
    if not top_module:
        raise HTTPException(status_code=400, detail="Top module cannot be empty.")
    if not technology:
        raise HTTPException(status_code=400, detail="Technology cannot be empty.")

    if "/" in name or "\\" in name:
        raise HTTPException(
            status_code=400,
            detail="Project name cannot contain path separators ('/' or '\\').",
        )

    existing_proj = (
        db.query(DBProject)
        .filter(
            DBProject.user_id == current_user.id,
            func.lower(DBProject.name) == name.lower(),
        )
        .first()
    )

    if existing_proj:
        raise HTTPException(
            status_code=400,
            detail=f"Project with name '{name}' already exists.",
        )

    new_project = DBProject(
        user_id=current_user.id,
        name=name,
        type="RTL Design Project",
        technology=technology,
        top_module=top_module,
        status="ready",
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    ensure_project_workspace(current_user.id, new_project.id)

    return {
        "project": {
            "id": new_project.id,
            "name": new_project.name,
            "type": new_project.type,
            "technology": new_project.technology,
            "top_module": new_project.top_module,
            "status": new_project.status,
            "created_at": new_project.created_at.isoformat() if new_project.created_at else None,
        }
    }


@app.get("/projects/{project_name}")
def get_project(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = resolve_user_project(project_name, current_user, db)

    return {
        "id": project.id,
        "name": project.name,
        "type": project.type,
        "technology": project.technology,
        "top_module": project.top_module,
        "status": project.status,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


@app.get("/projects/{project_name}/files")
def get_project_files(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = resolve_user_project(project_name, current_user, db)

    files = (
        db.query(DBProjectFile)
        .filter(DBProjectFile.project_id == project.id)
        .order_by(DBProjectFile.name.asc())
        .all()
    )

    return {
        "project": project.name,
        "files": [
            {
                "id": f.id,
                "name": f.name,
                "type": f.type,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ],
    }


@app.get("/projects/{project_name}/files/{filename}")
def get_project_file(
    project_name: str,
    filename: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = resolve_user_project(project_name, current_user, db)

    if (
        filename != Path(filename).name
        or "/" in filename
        or "\\" in filename
        or ".." in filename
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid file name: path traversal is not allowed.",
        )

    matched_file = (
        db.query(DBProjectFile)
        .filter(
            DBProjectFile.project_id == project.id,
            func.lower(DBProjectFile.name) == filename.lower(),
        )
        .first()
    )

    if not matched_file:
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found in project '{project_name}'.",
        )

    dirs = ensure_project_workspace(current_user.id, project.id)
    subdir = dirs["rtl"] if matched_file.type == "rtl" else dirs["testbench"]
    target_path = subdir / matched_file.name

    if not target_path.is_file():
        legacy_path = (
            SIMULATOR_DIR / "examples" / matched_file.name
            if matched_file.type == "rtl"
            else SIMULATOR_DIR / "tests" / matched_file.name
        )
        if legacy_path.is_file():
            target_path.write_text(
                legacy_path.read_text(encoding="utf-8", errors="replace"),
                encoding="utf-8",
            )

    if not target_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"File '{matched_file.name}' was not found on disk.",
        )

    try:
        content = target_path.read_text(
            encoding="utf-8",
            errors="replace",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {str(exc)}",
        )

    return {
        "project": project.name,
        "file": {
            "id": matched_file.id,
            "name": matched_file.name,
            "type": matched_file.type,
            "created_at": matched_file.created_at.isoformat() if matched_file.created_at else None,
        },
        "content": content,
    }


@app.post("/projects/{project_name}/files", status_code=201)
def add_project_file(
    project_name: str,
    request: AddFileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = resolve_user_project(project_name, current_user, db)

    filename = request.name.strip()
    if not filename:
        raise HTTPException(status_code=400, detail="File name cannot be empty.")

    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid file name: path traversal is not allowed.",
        )

    file_type = request.type.strip()
    if file_type not in ("rtl", "testbench"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type: must be 'rtl' or 'testbench'.",
        )

    if not (filename.endswith(".v") or filename.endswith(".sv")):
        raise HTTPException(
            status_code=400,
            detail="File must have a .v or .sv extension.",
        )

    existing_file = (
        db.query(DBProjectFile)
        .filter(
            DBProjectFile.project_id == project.id,
            func.lower(DBProjectFile.name) == filename.lower(),
        )
        .first()
    )

    if existing_file:
        raise HTTPException(
            status_code=400,
            detail=f"File '{filename}' already exists in project '{project.name}'.",
        )

    dirs = ensure_project_workspace(current_user.id, project.id)
    subdir = dirs["rtl"] if file_type == "rtl" else dirs["testbench"]
    target_path = subdir / filename

    try:
        target_path.write_text(request.content, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to write file to disk: {str(exc)}",
        )

    new_file = DBProjectFile(
        project_id=project.id,
        name=filename,
        type=file_type,
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return {
        "project": project.name,
        "file": {
            "id": new_file.id,
            "name": new_file.name,
            "type": new_file.type,
            "created_at": new_file.created_at.isoformat() if new_file.created_at else None,
        },
    }


@app.put("/projects/{project_name}/files/{filename}")
def update_project_file(
    project_name: str,
    filename: str,
    request: AddFileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    project = resolve_user_project(project_name, current_user, db)

    if (
        filename != Path(filename).name
        or "/" in filename
        or "\\" in filename
        or ".." in filename
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid file name: path traversal is not allowed.",
        )

    matched_file = (
        db.query(DBProjectFile)
        .filter(
            DBProjectFile.project_id == project.id,
            func.lower(DBProjectFile.name) == filename.lower(),
        )
        .first()
    )

    if not matched_file:
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found in project '{project_name}'.",
        )

    dirs = ensure_project_workspace(current_user.id, project.id)
    subdir = dirs["rtl"] if matched_file.type == "rtl" else dirs["testbench"]
    target_path = subdir / matched_file.name

    try:
        target_path.write_text(request.content, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update file: {str(exc)}",
        )

    return {
        "project": project.name,
        "file": {
            "id": matched_file.id,
            "name": matched_file.name,
            "type": matched_file.type,
            "created_at": matched_file.created_at.isoformat() if matched_file.created_at else None,
        },
        "message": f"File '{matched_file.name}' updated successfully.",
    }

@app.post("/projects/{project_name}/simulate", response_model=SimulationResponse)
def simulate_project(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    files = (
        db.query(DBProjectFile)
        .filter(DBProjectFile.project_id == matched_project.id)
        .all()
    )
    if not files:
        raise HTTPException(
            status_code=400,
            detail=f"No files configured for project '{project_name}'",
        )

    rtl_args = []
    tb_args = []

    for f in files:
        if f.type == "rtl":
            host_path = dirs["rtl"] / f.name
            if not host_path.is_file():
                ref_path = SIMULATOR_DIR / "examples" / f.name
                if ref_path.is_file():
                    host_path.write_text(
                        ref_path.read_text(encoding="utf-8", errors="replace"),
                        encoding="utf-8",
                    )
            if not host_path.is_file():
                raise HTTPException(
                    status_code=400,
                    detail=f"RTL file '{f.name}' not found.",
                )
            rtl_args.append(f"workspace/{current_user.id}/{matched_project.id}/rtl/{f.name}")
        elif f.type == "testbench":
            host_path = dirs["testbench"] / f.name
            if not host_path.is_file():
                ref_path = SIMULATOR_DIR / "tests" / f.name
                if ref_path.is_file():
                    host_path.write_text(
                        ref_path.read_text(encoding="utf-8", errors="replace"),
                        encoding="utf-8",
                    )
            if not host_path.is_file():
                raise HTTPException(
                    status_code=400,
                    detail=f"Testbench file '{f.name}' not found.",
                )
            tb_args.append(f"workspace/{current_user.id}/{matched_project.id}/testbench/{f.name}")

    if not rtl_args:
        raise HTTPException(
            status_code=400,
            detail=f"No RTL files found for project '{project_name}'",
        )
    if not tb_args:
        raise HTTPException(
            status_code=400,
            detail=f"No testbench files found for project '{project_name}'",
        )

    output_vvp = f"workspace/{current_user.id}/{matched_project.id}/work/{matched_project.name}.vvp"

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

    # Step 2: vvp execution in Docker with working dir set to project workspace
    sim_cmd = [
        "docker", "run", "--rm",
        "-v", f"{SIMULATOR_DIR}:/workspace",
        "-w", f"/workspace/workspace/{current_user.id}/{matched_project.id}",
        "cloudrtl-eda:0.1",
        "vvp",
        f"work/{matched_project.name}.vvp",
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

    # VVP runs from dirs["base"], so a testbench's $dumpfile()
    # normally creates its VCD there.
    for search_dir in (dirs["base"], dirs["work"]):
        if search_dir.is_dir():
            for gen_vcd in search_dir.glob("*.vcd"):
                if gen_vcd.is_file():
                    shutil.copy2(
                        gen_vcd,
                        dirs["artifacts"] / gen_vcd.name,
                    )

    # Preserve the existing VVP artifact handling.
    gen_vvp = dirs["work"] / f"{matched_project.name}.vvp"
    if gen_vvp.is_file():
        shutil.copy2(gen_vvp, dirs["artifacts"] / gen_vvp.name)

    return SimulationResponse(
        project=project_name,
        status="success",
        return_code=0,
        output=sim_output.strip() or "Simulation completed successfully.",
    )

# ============== Synthesis Metrics Parsing ==============

def parse_synthesis_metrics(project_name: str, output: str, work_dir: Path) -> dict:
    metrics = {
        "cell_count": None,
        "area": None,
        "setup_wns": None,
        "hold_wns": None,
        "tns": None,
    }

    # --------- Cell count ----------
    cell_match = re.search(
        r"Number of cells:\s*(\d+)",
        output,
        re.IGNORECASE,
    )

    if cell_match:
        metrics["cell_count"] = int(cell_match.group(1))

    work_dir = work_dir.resolve()

    
    # --------- Area ----------
    area_report = work_dir / f"{project_name}_area.rpt"
    area_match = None

    # First, try the generated area report.
    if area_report.is_file():
        area_text = area_report.read_text(
            encoding="utf-8",
            errors="replace",
        )

        area_match = re.search(
            r"Chip area for module\s+'.*?':\s*([\d.]+)",
            area_text,
            re.IGNORECASE,
        )

    # Fall back to the Yosys synthesis output.
    if area_match is None:
        area_match = re.search(
            r"Chip area for module\s+'.*?':\s*([\d.]+)",
            output,
            re.IGNORECASE,
        )

    if area_match:
        metrics["area"] = float(area_match.group(1))


    # --------- Timing ----------
    timing_report = work_dir / f"{project_name}_timing.rpt"

    if timing_report.is_file():
        timing_text = timing_report.read_text(
            encoding="utf-8",
            errors="replace",
        )

        # Setup WNS - extract slack from max-delay path
        max_section = re.search(
            r"Path Type:\s*max(.*?)(?=\nStartpoint:|\nwns max|\Z)",
            timing_text,
            re.IGNORECASE | re.DOTALL,
        )

        if max_section:
            setup_match = re.search(
                r"([-+]?\d+(?:\.\d+)?)\s+slack\s+\(MET\)",
                max_section.group(1),
                re.IGNORECASE,
            )

            if setup_match:
                metrics["setup_wns"] = float(setup_match.group(1))

        # Hold WNS - extract slack from min-delay path
        min_section = re.search(
            r"Path Type:\s*min(.*?)(?=\nwns max|\Z)",
            timing_text,
            re.IGNORECASE | re.DOTALL,
        )

        if min_section:
            hold_match = re.search(
                r"([-+]?\d+(?:\.\d+)?)\s+slack\s+\(MET\)",
                min_section.group(1),
                re.IGNORECASE,
            )

            if hold_match:
                metrics["hold_wns"] = float(hold_match.group(1))

        # TNS - setup/max-delay TNS
        tns_match = re.search(
            r"tns max\s+([-+]?\d+(?:\.\d+)?)",
            timing_text,
            re.IGNORECASE,
        )

        if tns_match:
            metrics["tns"] = float(tns_match.group(1))

    return metrics

# ==================== SYNTHESIS WORKFLOW ====================

@app.post("/projects/{project_name}/synthesize")
def synthesize_project(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    work_dir = dirs["work"].resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------
    # Step 1: Prepare project-specific Yosys synthesis script
    # --------------------------------------------------------

    files = (
        db.query(DBProjectFile)
        .filter(DBProjectFile.project_id == matched_project.id)
        .all()
    )
    rtl_files = [f for f in files if f.type == "rtl"]

    if not rtl_files:
        raise HTTPException(
            status_code=400,
            detail=f"No RTL files found for project '{project_name}'",
        )

    for f in rtl_files:
        rtl_path = dirs["rtl"] / f.name
        if not rtl_path.is_file():
            ref_path = SIMULATOR_DIR / "examples" / f.name
            if ref_path.is_file():
                rtl_path.write_text(
                    ref_path.read_text(encoding="utf-8", errors="replace"),
                    encoding="utf-8",
                )
        if not rtl_path.is_file():
            raise HTTPException(
                status_code=400,
                detail=f"RTL file '{f.name}' not found.",
            )


    synthesis_template_path = SIMULATOR_DIR / "scripts" / "synthesize.ys"

    if not synthesis_template_path.is_file():
        raise HTTPException(
            status_code=500,
            detail="Synthesis template 'synthesize.ys' not found.",
        )

    synthesis_script = synthesis_template_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    rtl_commands = "\n".join(
    f'read_verilog "/CloudRTL/git/simulator/workspace/{current_user.id}/{matched_project.id}/rtl/{f.name}"'
    for f in rtl_files
    )

    synthesis_script = synthesis_script.replace(
        "read_verilog /CloudRTL/git/simulator/examples/counter.v",
        rtl_commands,
        1,
    )

    synthesis_script = synthesis_script.replace(
        "hierarchy -check -top counter",
        f"hierarchy -check -top {matched_project.top_module}",
        1,
    )

    # Use a single-line command to avoid line-continuation issues when
    # the generated script is read by Yosys inside the Linux EDA container.
    new_write_command = (
        "write_verilog -noattr -noexpr "
        f"/CloudRTL/git/simulator/workspace/"
        f"{current_user.id}/{matched_project.id}/work/"
        f"{project_name}_netlist.v"
    )
    old_write_block = """write_verilog \\
    -noattr \\
    -noexpr \\
    /CloudRTL/git/simulator/work/counter_netlist.v"""

    if old_write_block not in synthesis_script:
        raise HTTPException(
            status_code=500,
            detail="Could not locate the expected write_verilog command in synthesize.ys.",
        )

    synthesis_script = synthesis_script.replace(
        old_write_block,
        new_write_command,
        1,
    )

    project_synthesis_script = work_dir / f"{project_name}_synthesize.ys"

    try:
        project_synthesis_script.write_text(
            synthesis_script,
            encoding="utf-8",
            newline="\n",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to prepare project synthesis script: {str(exc)}",
        )

    # --------------------------------------------------------
    # Step 2: Run Yosys synthesis
    # --------------------------------------------------------

    try:
        result = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "-v",
                "C:/CloudRTL:/CloudRTL",
                "-v",
                "C:/CloudRTL/tools/OpenROAD-flow-scripts:/OpenROAD-flow-scripts",
                "-w",
                "/CloudRTL/git/simulator",
                "cloudrtl-eda:0.2",
                "yosys",
                "-s",
               f"/CloudRTL/git/simulator/workspace/{current_user.id}/{matched_project.id}/work/{project_name}_synthesize.ys",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Synthesis timed out.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start synthesis: {str(exc)}",
        )

    synthesis_output = (
        (result.stdout or "") +
        ("\n" + result.stderr if result.stderr else "")
    ).strip()

    if result.returncode != 0:
        return {
            "project": project_name,
            "status": "failed",
            "return_code": result.returncode,
            "output": synthesis_output,
            "artifacts": [],
        }

    # --------------------------------------------------------
    # Step 3: Verify synthesized netlist
    # --------------------------------------------------------

    netlist_path = work_dir / f"{project_name}_netlist.v"

    if not netlist_path.is_file():
        return {
            "project": project_name,
            "status": "failed",
            "return_code": 1,
            "output": synthesis_output
            + "\n\nSynthesis completed but netlist was not generated.",
            "artifacts": [],
        }

    # --------------------------------------------------------
    # Step 4: Generate SDC constraints
    # --------------------------------------------------------

    sdc_path = work_dir / f"{project_name}.sdc"

    sdc_path.write_text(
        "create_clock -name clk -period 10 [get_ports clk]\n",
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Step 5: Prepare project-specific post-synthesis analysis
    # --------------------------------------------------------

    analysis_template_path = SIMULATOR_DIR / "scripts" / "analysis.tcl"

    if not analysis_template_path.is_file():
        raise HTTPException(
            status_code=500,
            detail="Analysis template 'analysis.tcl' not found.",
        )

    analysis_script = analysis_template_path.read_text(
        encoding="utf-8",
        errors="replace",
    )

    
    # Prepare project-specific OpenROAD analysis paths.
    workspace_container = (
        f"/CloudRTL/git/simulator/workspace/"
        f"{current_user.id}/{matched_project.id}/work"
    )

    # Replace the shared workspace prefix FIRST so paths do not get duplicated.
    analysis_script = analysis_script.replace(
        "/CloudRTL/git/simulator/work/",
        f"{workspace_container}/",
    )

    # Adapt the template to the selected project.
    analysis_script = analysis_script.replace(
        "counter_netlist.v",
        f"{project_name}_netlist.v",
    )

    analysis_script = analysis_script.replace(
        "link_design counter",
        f"link_design {matched_project.top_module}",
    )

    analysis_script = analysis_script.replace(
        "counter.sdc",
        f"{project_name}.sdc",
    )

    analysis_script = analysis_script.replace(
        "counter_timing.rpt",
        f"{project_name}_timing.rpt",
    )

    analysis_script = analysis_script.replace(
        "counter_power.rpt",
        f"{project_name}_power.rpt",
    )


    project_analysis_script = work_dir / f"{project_name}_analysis.tcl"

    try:
        project_analysis_script.write_text(
            analysis_script,
            encoding="utf-8",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to prepare project analysis script: {str(exc)}",
        )

    # --------------------------------------------------------
    # Step 6: Run post-synthesis timing and power analysis
    # --------------------------------------------------------

    analysis_command = [
        "docker",
        "exec",
        "openroad-work",
        "/CloudRTL/tools/OpenROAD-flow-scripts/tools/OpenROAD/build/bin/openroad",
        f"/CloudRTL/git/simulator/workspace/{current_user.id}/{matched_project.id}/work/{project_name}_analysis.tcl",
    ]

    try:
        analysis_result = subprocess.run(
            analysis_command,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except subprocess.TimeoutExpired:
        return {
            "project": project_name,
            "status": "failed",
            "return_code": 1,
            "output": synthesis_output
            + "\n\nPost-synthesis analysis timed out.",
            "artifacts": [],
        }

    analysis_output = (
        (analysis_result.stdout or "") +
        ("\n" + analysis_result.stderr if analysis_result.stderr else "")
    ).strip()

    combined_output = (
        "========== YOSYS SYNTHESIS ==========\n"
        + synthesis_output
        + "\n\n"
        "========== POST-SYNTHESIS ANALYSIS ==========\n"
        + analysis_output
    )

    if analysis_result.returncode != 0:
        return {
            "project": project_name,
            "status": "failed",
            "return_code": analysis_result.returncode,
            "output": combined_output,
            "artifacts": [],
        }

    # --------------------------------------------------------
    # Step 7: Collect synthesis artifacts and store in project workspace
    # --------------------------------------------------------

    expected_artifacts = [
        f"{project_name}_netlist.v",
        f"{project_name}.sdc",
        f"{project_name}_area.rpt",
        f"{project_name}_timing.rpt",
        f"{project_name}_power.rpt",
    ]

    artifacts = []

    for artifact_name in expected_artifacts:
        artifact_path = work_dir / artifact_name

        if artifact_path.is_file():
            artifacts.append(artifact_name)
            shutil.copy2(artifact_path, dirs["artifacts"] / artifact_name)

    # ========== Parse Synthesis Metrics ==========

    metrics = parse_synthesis_metrics(
        project_name,
        combined_output,
        work_dir,
    )

    return {
        "project": project_name,
        "status": "success",
        "return_code": 0,
        "metrics": metrics,
        "output": combined_output,
        "artifacts": artifacts,
    }


# =================== Physical Design Metrics Parsing ===========================

def parse_physical_metrics(output: str) -> dict:
    """
    Extract structured physical-design metrics from OpenROAD output.

    Values are parsed from the actual OpenROAD reports generated
    by run_openroad.tcl. Missing values remain None.
    """

    metrics = {
        "area": None,
        "utilization": None,
        "wire_length": None,
        "metal2_wire_length": None,
        "metal3_wire_length": None,
        "vias": None,
        "setup_wns": None,
        "hold_wns": None,
        "tns": None,
    }

    # --------- Design area and utilization ----------
    area_matches = re.findall(
        r"Design area\s+([\d.]+)\s+um\^2\s+([\d.]+)%\s+utilization",
        output,
        re.IGNORECASE,
    )

    if area_matches:
        area, utilization = area_matches[-1]
        metrics["area"] = float(area)
        metrics["utilization"] = float(utilization)

    # --------- Routed wire length by metal layer ----------
    metal2_match = re.search(
        r"metal2\s+([\d.]+)um\s+\d+%",
        output,
        re.IGNORECASE,
    )

    if metal2_match:
        metrics["metal2_wire_length"] = float(metal2_match.group(1))

    metal3_match = re.search(
        r"metal3\s+([\d.]+)um\s+\d+%",
        output,
        re.IGNORECASE,
    )

    if metal3_match:
        metrics["metal3_wire_length"] = float(metal3_match.group(1))

    # --------- Total routed wire length ----------
    wire_match = re.search(
        r"Total wire length(?:\s+is|\s*[:=])\s*([\d.]+)\s*um",
        output,
        re.IGNORECASE,
    )

    if wire_match:
        metrics["wire_length"] = float(wire_match.group(1))
    elif (
        metrics["metal2_wire_length"] is not None
        and metrics["metal3_wire_length"] is not None
    ):
        metrics["wire_length"] = round(
            metrics["metal2_wire_length"]
            + metrics["metal3_wire_length"],
            2,
        )

    # --------- Via count ----------
    vias_match = re.search(
        r"Total number of vias\s*[:=]?\s*(\d+)",
        output,
        re.IGNORECASE,
    )

    if vias_match:
        metrics["vias"] = int(vias_match.group(1))

    # --------- Timing summary ---------
    timing_match = re.search(
        r"worst slack max\s+([-+]?\d+(?:\.\d+)?)"
        r".*?"
        r"worst slack min\s+([-+]?\d+(?:\.\d+)?)"
        r".*?"
        r"tns max\s+([-+]?\d+(?:\.\d+)?)",
        output,
        re.IGNORECASE | re.DOTALL,
    )

    if timing_match:
        metrics["setup_wns"] = float(timing_match.group(1))
        metrics["hold_wns"] = float(timing_match.group(2))
        metrics["tns"] = float(timing_match.group(3))

    return metrics


# ============ PHYSICAL DESIGN API ============

@app.post("/projects/{project_name}/physical-design")
def run_physical_design(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    # Check synthesized netlist in project artifacts or simulator/work
    netlist_path = dirs["artifacts"] / f"{project_name}_netlist.v"
    if not netlist_path.is_file():
        netlist_path = (SIMULATOR_DIR / "work" / f"{project_name}_netlist.v").resolve()

    if not netlist_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Synthesized netlist not found. Run synthesis first.",
        )

    
    # Stage the selected project's synthesized netlist in its own workspace.
    project_netlist = dirs["work"] / f"{matched_project.name}_netlist.v"

    if netlist_path.resolve() != project_netlist.resolve():
        shutil.copy2(netlist_path, project_netlist)

    # OpenROAD container sees the same workspace under /CloudRTL/git.
    container_work_dir = (
        f"/CloudRTL/git/simulator/workspace/"
        f"{current_user.id}/{matched_project.id}/work"
    )

    container_netlist_path = (
        f"{container_work_dir}/{matched_project.name}_netlist.v"
    )

    physical_work_dir = dirs["work"] / "physical"
    physical_work_dir.mkdir(parents=True, exist_ok=True)

    container_output_dir = f"{container_work_dir}/physical"

    # Check OpenROAD container status
    try:
        container_check = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", "openroad-work"],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if container_check.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail="OpenROAD container 'openroad-work' was not found.",
            )

        if container_check.stdout.strip() != "true":
            start_result = subprocess.run(
                ["docker", "start", "openroad-work"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if start_result.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to start OpenROAD container: {start_result.stderr}",
                )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Timed out while checking OpenROAD container.",
        )

    # Run OpenROAD physical-design flow
    
    openroad_command = [
        "docker",
        "exec",
        "-e",
        f"CLOUDRTL_PROJECT_NAME={matched_project.name}",
        "-e",
        f"CLOUDRTL_TOP_MODULE={matched_project.top_module}",
        "-e",
        f"CLOUDRTL_NETLIST={container_netlist_path}",
        "-e",
        f"CLOUDRTL_OUTPUT_DIR={container_output_dir}",
        "openroad-work",
        "/CloudRTL/tools/OpenROAD-flow-scripts/tools/OpenROAD/build/bin/openroad",
        "/CloudRTL/git/physical/scripts/run_openroad.tcl",
    ]

    try:
        result = subprocess.run(
            openroad_command,
            capture_output=True,
            text=True,
            timeout=300,
        )

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Physical design flow timed out after 300 seconds.",
        )

    output = result.stdout

    if result.stderr:
        output += "\n" + result.stderr

    if result.returncode != 0:
        return {
            "project": project_name,
            "status": "failed",
            "metrics": {},
            "output": output,
            "artifacts": [],
        }

    artifacts = []

    expected_artifacts = [
        f"{project_name}_placed.def",
        f"{project_name}_routed.def",
        f"{project_name}.route.guide",
        f"{project_name}_route_drc.rpt",
    ]

    for artifact_name in expected_artifacts:
        artifact_path = physical_work_dir / artifact_name

        if artifact_path.is_file():
            artifacts.append(artifact_name)
            shutil.copy2(artifact_path, dirs["artifacts"] / artifact_name)

    # ========== Parse Physical Design Metrics ==========

    metrics = parse_physical_metrics(output)
    return {
        "project": project_name,
        "status": "success",
        "metrics": metrics,
        "output": output,
        "artifacts": artifacts,
    }


# ============ PHYSICAL ARTIFACTS API ============

@app.get("/projects/{project_name}/physical-artifacts")
def get_physical_artifacts(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    expected_artifacts = [
        f"{project_name}_placed.def",
        f"{project_name}_routed.def",
        f"{project_name}.route.guide",
        f"{project_name}_route_drc.rpt",
    ]

    artifacts = []

    for artifact_name in expected_artifacts:
        artifact_path = dirs["artifacts"] / artifact_name
        if not artifact_path.is_file():
            artifact_path = (PHYSICAL_DIR / "work" / artifact_name).resolve()

        if artifact_path.is_file():
            artifacts.append(
                {
                    "name": artifact_name,
                    "type": (
                        "def"
                        if artifact_name.endswith(".def")
                        else "report"
                        if artifact_name.endswith(".rpt")
                        else "routing-guide"
                    ),
                }
            )

    return {
        "project": project_name,
        "artifacts": artifacts,
    }


@app.get("/projects/{project_name}/physical-artifacts/{artifact_name}")
def get_physical_artifact(
    project_name: str,
    artifact_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    # Prevent path traversal
    if (
        artifact_name != Path(artifact_name).name
        or "/" in artifact_name
        or "\\" in artifact_name
        or ".." in artifact_name
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid artifact name: path traversal is not allowed",
        )

    # Only allow artifacts belonging to this project
    prefix = f"{matched_project.name}"

    if not (
        artifact_name.startswith(f"{prefix}_")
        or artifact_name.startswith(f"{prefix}.")
    ):
        raise HTTPException(
            status_code=404,
            detail="Physical artifact not found",
        )

    target_path = dirs["artifacts"] / artifact_name
    if not target_path.is_file():
        target_path = (PHYSICAL_DIR / "work" / artifact_name).resolve()

    if not target_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Physical artifact not found",
        )

    return FileResponse(
        path=target_path,
        filename=artifact_name,
        media_type="application/octet-stream",
    )


# ============ SYNTHESIS ARTIFACTS API ============

@app.get("/projects/{project_name}/synthesis-artifacts")
def get_synthesis_artifacts(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    expected_artifacts = [
        f"{project_name}_netlist.v",
        f"{project_name}.sdc",
        f"{project_name}_area.rpt",
        f"{project_name}_timing.rpt",
        f"{project_name}_power.rpt",
    ]

    artifacts = []

    for artifact_name in expected_artifacts:
        artifact_path = dirs["artifacts"] / artifact_name
        if not artifact_path.is_file():
            artifact_path = (SIMULATOR_DIR / "work" / artifact_name).resolve()

        if artifact_path.is_file():
            if artifact_name.endswith(".v"):
                artifact_type = "netlist"
            elif artifact_name.endswith(".sdc"):
                artifact_type = "constraints"
            else:
                artifact_type = "report"

            artifacts.append(
                {
                    "name": artifact_name,
                    "type": artifact_type,
                }
            )

    return {
        "project": project_name,
        "artifacts": artifacts,
    }


@app.get("/projects/{project_name}/synthesis-artifacts/{artifact_name}")
def get_synthesis_artifact(
    project_name: str,
    artifact_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    # Prevent path traversal
    if (
        artifact_name != Path(artifact_name).name
        or "/" in artifact_name
        or "\\" in artifact_name
        or ".." in artifact_name
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid artifact name: path traversal is not allowed",
        )

    expected_artifacts = {
        f"{project_name}_netlist.v",
        f"{project_name}.sdc",
        f"{project_name}_area.rpt",
        f"{project_name}_timing.rpt",
        f"{project_name}_power.rpt",
    }

    if artifact_name not in expected_artifacts:
        raise HTTPException(
            status_code=404,
            detail="Synthesis artifact not found",
        )

    target_path = dirs["artifacts"] / artifact_name
    if not target_path.is_file():
        target_path = (SIMULATOR_DIR / "work" / artifact_name).resolve()

    if not target_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Synthesis artifact not found",
        )

    return FileResponse(
        path=target_path,
        filename=artifact_name,
        media_type="application/octet-stream",
    )


@app.get("/projects/{project_name}/artifacts", response_model=ArtifactsResponse)
def get_project_artifacts(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    artifacts: list[ArtifactItem] = []
    prefix = matched_project.name

    search_dirs = [dirs["artifacts"], dirs["work"], dirs["base"], (SIMULATOR_DIR / "work").resolve()]

    for s_dir in search_dirs:
        if s_dir.is_dir():
            for f in sorted(s_dir.iterdir()):
                if not f.is_file():
                    continue

                is_project_vcd = (
                    f.suffix.lower() == ".vcd"
                    and s_dir in (dirs["artifacts"], dirs["work"], dirs["base"])
                )

                if not (
                    f.name.startswith(f"{prefix}.")
                    or f.name.startswith(f"{prefix}_")
                    or is_project_vcd
                ):
                    continue

                if f.suffix == ".vcd" and not any(a.name == f.name for a in artifacts):
                    artifacts.append(
                        ArtifactItem(
                            name=f.name,
                            type="waveform",
                        )
                    )
                elif f.suffix == ".vvp" and not any(a.name == f.name for a in artifacts):
                    artifacts.append(
                        ArtifactItem(
                            name=f.name,
                            type="simulation",
                        )
                    )

    artifacts.sort(
        key=lambda a: (
            0 if a.type == "waveform" else 1,
            a.name,
        )
    )

    return ArtifactsResponse(
        project=project_name,
        artifacts=artifacts,
    )


@app.get("/projects/{project_name}/artifacts/{artifact_name}")
def get_project_artifact(
    project_name: str,
    artifact_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    # Prevent path traversal and arbitrary filesystem access
    if (
        artifact_name != Path(artifact_name).name
        or "/" in artifact_name
        or "\\" in artifact_name
        or ".." in artifact_name
    ):
        raise HTTPException(status_code=400, detail="Invalid artifact name: path traversal is not allowed")

    # Only allow project-named artifacts, or VCD files
    # located in this project's own workspace.
    prefix = matched_project.name
    is_project_named = (
        artifact_name.startswith(f"{prefix}.")
        or artifact_name.startswith(f"{prefix}_")
    )

    if not is_project_named and Path(artifact_name).suffix.lower() != ".vcd":
        raise HTTPException(
            status_code=404,
            detail="Artifact not found for this project",
        )

    target_path = dirs["artifacts"] / artifact_name
    if not target_path.is_file():
        target_path = dirs["work"] / artifact_name

    # Keep the shared-work fallback only for project-named artifacts.
    if not target_path.is_file() and is_project_named:
        target_path = (SIMULATOR_DIR / "work" / artifact_name).resolve()
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(
        path=target_path,
        filename=artifact_name,
        media_type="application/octet-stream",
    )


# ============== WAVEFORM API ==============

@app.get("/projects/{project_name}/waveform")
def get_project_waveform(
    project_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    matched_project = resolve_user_project(project_name, current_user, db)
    dirs = ensure_project_workspace(current_user.id, matched_project.id)

    # Prefer the conventional project-named VCD.
    vcd_path = dirs["artifacts"] / f"{matched_project.name}.vcd"

    if not vcd_path.is_file():
        vcd_path = dirs["work"] / f"{matched_project.name}.vcd"

    # If the testbench uses another filename, search this project's
    # artifact and work directories only.
    if not vcd_path.is_file():
        for search_dir in (dirs["artifacts"], dirs["work"], dirs["base"]):
            if search_dir.is_dir():
                candidates = sorted(search_dir.glob("*.vcd"))
                if candidates:
                    vcd_path = candidates[0]
                    break

    if not vcd_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Waveform artifact not found. Run a successful simulation first.",
        )

    try:
        signals = parse_vcd(vcd_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse VCD waveform: {str(exc)}",
        )

    return {
        "project": matched_project.name,
        "waveform": {
            "signals": signals,
        },
    }
