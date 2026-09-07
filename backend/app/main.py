from fastapi import FastAPI
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

projects = [
    Project(
        name="counter",
        type="RTL Design Project",
        technology="Nangate45",
        top_module="counter",
        status="ready",
    )
]

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