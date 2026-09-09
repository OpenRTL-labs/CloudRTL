import subprocess
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SIMULATOR_DIR = REPO_ROOT / "simulator"
PHYSICAL_DIR = REPO_ROOT / "physical"

# ============== VCD WAVEFORM PARSER ==============

def parse_vcd(vcd_path: Path):
    signals = []
    signal_map = {}
    current_scope = []
    current_time = 0

    with vcd_path.open("r", encoding="utf-8", errors="replace") as vcd_file:
        for raw_line in vcd_file:
            line = raw_line.strip()

            if not line:
                continue

            if line.startswith("$scope"):
                parts = line.split()
                if len(parts) >= 3:
                    current_scope.append(parts[2])
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

                    full_name = ".".join(current_scope + [name])

                    signal = {
                        "name": full_name,
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

            # Scalar value change: 0!, 1!, x!, z!, etc.
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

            # Vector value change: b1010 !
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

# ==================== SYNTHESIS WORKFLOW ====================

@app.post("/projects/{project_name}/synthesize")
def synthesize_project(project_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (SIMULATOR_DIR / "work").resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------------
    # Step 1: Run Yosys synthesis
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
                "/CloudRTL/git/simulator/scripts/synthesize.ys",
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
    # Step 2: Verify synthesized netlist
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
    # Step 3: Generate SDC constraints
    # --------------------------------------------------------

    sdc_path = work_dir / f"{project_name}.sdc"

    sdc_path.write_text(
        "create_clock -name clk -period 10 [get_ports clk]\n",
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Step 4: Run post-synthesis timing and power analysis
    # --------------------------------------------------------

    analysis_command = [
        "docker",
        "exec",
        "openroad-work",
        "/CloudRTL/tools/OpenROAD-flow-scripts/tools/OpenROAD/build/bin/openroad",
        "/CloudRTL/git/physical/scripts/analysis.tcl",
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
    # Step 5: Collect synthesis artifacts
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

    return {
        "project": project_name,
        "status": "success",
        "return_code": 0,
        "output": combined_output,
        "artifacts": artifacts,
    }

# ============ PHYSICAL DESIGN API ============

@app.post("/projects/{project_name}/physical-design")
def run_physical_design(project_name: str):

    # Validate project
    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check synthesized netlist
    netlist_path = (SIMULATOR_DIR / "work" / f"{project_name}_netlist.v").resolve()

    if not netlist_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Synthesized netlist not found. Run synthesis first.",
        )

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
        "openroad-work",
        "/CloudRTL/tools/OpenROAD-flow-scripts/tools/OpenROAD/build/bin/openroad",
        f"/CloudRTL/git/physical/scripts/run_openroad.tcl",
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
            "output": output,
            "artifacts": [],
        }

    physical_work_dir = (PHYSICAL_DIR / "work").resolve()

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

    return {
        "project": project_name,
        "status": "success",
        "output": output,
        "artifacts": artifacts,
    }

# ============ PHYSICAL ARTIFACTS API ============

@app.get("/projects/{project_name}/physical-artifacts")
def get_physical_artifacts(project_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (PHYSICAL_DIR / "work").resolve()

    if not work_dir.is_dir():
        return {
            "project": project_name,
            "artifacts": [],
        }

    expected_artifacts = [
        f"{project_name}_placed.def",
        f"{project_name}_routed.def",
        f"{project_name}.route.guide",
        f"{project_name}_route_drc.rpt",
    ]

    artifacts = []

    for artifact_name in expected_artifacts:
        artifact_path = work_dir / artifact_name

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
def get_physical_artifact(project_name: str, artifact_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

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

    work_dir = (PHYSICAL_DIR / "work").resolve()
    target_path = (work_dir / artifact_name).resolve()

    # Ensure target remains inside physical/work
    try:
        target_path.relative_to(work_dir)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid physical artifact path",
        )

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
def get_synthesis_artifacts(project_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (SIMULATOR_DIR / "work").resolve()

    if not work_dir.is_dir():
        return {
            "project": project_name,
            "artifacts": [],
        }

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
def get_synthesis_artifact(project_name: str, artifact_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

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

    work_dir = (SIMULATOR_DIR / "work").resolve()
    target_path = (work_dir / artifact_name).resolve()

    # Ensure target remains inside simulator/work
    try:
        target_path.relative_to(work_dir)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid synthesis artifact path",
        )

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
def get_project_artifacts(project_name: str):

    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (SIMULATOR_DIR / "work").resolve()
    artifacts: list[ArtifactItem] = []

    if work_dir.is_dir():
        prefix = matched_project.name

        for f in sorted(work_dir.iterdir()):
            if not f.is_file():
                continue

            if not (
                f.name.startswith(f"{prefix}.")
                or f.name.startswith(f"{prefix}_")
            ):
                continue

            if f.suffix == ".vcd":
                artifacts.append(
                    ArtifactItem(
                        name=f.name,
                        type="waveform",
                    )
                )

            elif f.suffix == ".vvp":
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

# ============== WAVEFORM API ==============

@app.get("/projects/{project_name}/waveform")
def get_project_waveform(project_name: str):
    matched_project = next(
        (p for p in projects if p.name == project_name),
        None,
    )

    if not matched_project:
        raise HTTPException(status_code=404, detail="Project not found")

    work_dir = (SIMULATOR_DIR / "work").resolve()
    vcd_path = work_dir / f"{matched_project.name}.vcd"

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
