# SCI-Compta

Application web de gestion comptable pour SCI familiale à l'IR.

## Démarrage

### Configuration
```bash
cp .env.example .env
```

### Mode Développement
En développement, le code source local est monté dans les conteneurs avec *hot-reloading* :
```bash
docker compose -f docker-compose.dev.yml up --build
```
- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:8000
- **API Docs (Swagger)** : http://localhost:8000/docs

### Mode Production

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

## Tests

Toutes les séries de tests s'exécutent via Docker :

### Tests Backend (Pytest)
```bash
docker compose -f docker-compose.dev.yml run --rm backend pytest tests -v
```

### Tests Frontend (Vitest)
```bash
docker compose -f docker-compose.dev.yml run --rm frontend npm test
```
