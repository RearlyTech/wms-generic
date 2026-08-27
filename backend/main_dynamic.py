from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mobile_routes import router as mobile_router
from web_routes import router as web_router
from common import shared_router

app = FastAPI(title="ERP System (Dynamic Backend)", description="ERP System API with strictly dynamic inputs", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mobile_router)
app.include_router(web_router)
app.include_router(shared_router)
