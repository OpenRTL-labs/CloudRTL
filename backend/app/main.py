from fastapi import FastAPI, HTTPException
from pydantic import BaseModel



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