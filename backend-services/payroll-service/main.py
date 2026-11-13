from fastapi import FastAPI

app = FastAPI(title="KK & SONS Payroll Service")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "payroll"}
