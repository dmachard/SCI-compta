from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import SCI, User
from app.schemas import LoginRequest, SetupRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/setup", response_model=TokenResponse)
def setup(req: SetupRequest, db: Session = Depends(get_db)):
    """Premier lancement : crée le gérant et la SCI."""
    if db.query(User).first():
        raise HTTPException(400, "L'application est déjà configurée")

    # Créer une SCI vide (on a retiré RCS côté front mais la colonne existe en DB)
    sci = SCI(name="", siren="", siret="", rcs="", address="")
    db.add(sci)
    db.commit()

    # Extraire prénom/nom
    parts = req.full_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    # Créer l'associé gérant
    from app.models import Associate
    associate = Associate(
        sci_id=sci.id,
        first_name=first_name,
        last_name=last_name,
        email=req.email,
        is_manager=True
    )
    db.add(associate)
    db.commit()

    # Créer l'utilisateur
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
        role="gerant",
        associate_id=associate.id
    )
    db.add(user)
    db.commit()
    
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/status")
def status(db: Session = Depends(get_db)):
    """Vérifie si l'application est configurée (pour le setup initial)."""
    has_user = db.query(User).first() is not None
    return {"configured": has_user}
