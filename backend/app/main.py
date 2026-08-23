from fastapi import FastAPI

app = FastAPI(
    title="CloudRTL",
    description="Cloud-Based RTL Simulation Platform",
    version="0.1.0",
)


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