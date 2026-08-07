# SCI-Compta

Application web de gestion comptable pour SCI familiale à l'IR.

## Démarrage

### 1. Configuration
```bash
cp .env.example .env
```

### 2. Mode Développement (Dev)
En développement, le code source local est monté dans les conteneurs avec *hot-reloading* :
```bash
docker compose -f docker-compose.dev.yml up --build
```
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:8000
- **API Docs (Swagger)** : http://localhost:8000/docs

### 3. Mode Production (Prod)
En production, Docker Compose utilise les images optimisées pré-construites sur Docker Hub (`dmachard/sci-compta-backend` et `dmachard/sci-compta-frontend`) :
```bash
docker compose up -d
```
- **Frontend (Nginx)** : http://localhost (port 80)
- **Backend API** : http://localhost:8000
- **API Docs (Swagger)** : http://localhost:8000/docs

## Premier lancement

1. Ouvrir http://localhost:5173
2. Créer le compte gérant (email + mot de passe)
3. Configurer la SCI (raison sociale, capital, etc.)
4. Ajouter les associés
5. Créer l'exercice comptable

## Technologies

- **Backend** : Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend** : React, TypeScript, Tailwind CSS v4
- **Déploiement** : Docker Compose
