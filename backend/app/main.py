from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import auth, bank, sci, associates, capital, current_accounts, fiscal_years, documents

app = FastAPI(
    title="SCI-Compta",
    description="Gestion comptable pour SCI familiale",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bank.router)
app.include_router(sci.router)
app.include_router(associates.router)
app.include_router(capital.router)
app.include_router(current_accounts.router)
app.include_router(fiscal_years.router)
app.include_router(documents.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
