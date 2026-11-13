from fastapi import FastAPI

app = FastAPI(title="KK & SONS Notification Service")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "notification"}
