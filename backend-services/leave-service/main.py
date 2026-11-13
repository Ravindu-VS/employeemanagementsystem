from fastapi import FastAPI

# Placeholder service boundary. Leave management currently runs in the web app
# (Firestore `leaves` collection); this service only exposes a health check.
app = FastAPI(title="KK & SONS Leave Service")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "leave"}
