import csv
import hashlib
import io
import re
from datetime import datetime
from typing import TypedDict


class ParsedTransaction(TypedDict):
    transaction_date: str  # YYYY-MM-DD
    original_label: str
    amount: float
    import_hash: str


def parse_french_amount(val_str: str) -> float | None:
    """Transforme des chaînes comme '1 000,00', '200,00', '-50.50' en float."""
    if not val_str or not val_str.strip():
        return None
    # Nettoyer les espaces insécables et espaces classiques
    s = val_str.strip().replace("\xa0", "").replace(" ", "")
    # Remplacer le séparateur millier point si suivi d'une virgule décimale
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_date(date_str: str) -> str | None:
    """Convertit JJ/MM/AAAA ou AAAA-MM-JJ en AAAA-MM-JJ."""
    if not date_str or not date_str.strip():
        return None
    d_str = date_str.strip()
    
    # Format DD/MM/YYYY
    if re.match(r"^\d{2}/\d{2}/\d{4}$", d_str):
        try:
            return datetime.strptime(d_str, "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            return None
    # Format YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
        return d_str
    # Format DD-MM-YYYY
    if re.match(r"^\d{2}-\d{2}-\d{4}$", d_str):
        try:
            return datetime.strptime(d_str, "%d-%m-%Y").strftime("%Y-%m-%d")
        except ValueError:
            return None

    return None


def compute_import_hash(date_str: str, label: str, amount: float) -> str:
    """Génère un hash SHA256 unique pour la déduplication."""
    clean_label = re.sub(r"\s+", " ", label).strip()
    raw = f"{date_str}_{clean_label}_{amount:.2f}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_bank_csv(content_bytes: bytes) -> list[ParsedTransaction]:
    """
    Parse un fichier CSV de banque française avec gestion d'en-têtes,
    encodage utf-8/latin-1, détection des colonnes et déduplication.
    """
    # 1. Détecter l'encodage
    text = ""
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = content_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if not text:
        text = content_bytes.decode("utf-8", errors="replace")

    # Normaliser les retours à la ligne
    lines = text.splitlines()

    # 2. Utiliser csv.reader sur les lignes
    # On détermine le séparateur (';' ou ',')
    sample = text[:2000]
    delimiter = ";" if sample.count(";") >= sample.count(",") else ","

    reader = csv.reader(io.StringIO(text), delimiter=delimiter)

    transactions: list[ParsedTransaction] = []
    
    col_date_idx = -1
    col_label_idx = -1
    col_debit_idx = -1
    col_credit_idx = -1
    col_amount_idx = -1

    header_found = False

    for row in reader:
        if not row or not any(cell.strip() for cell in row):
            continue

        # Recherche de la ligne d'en-tête
        if not header_found:
            row_lower = [c.strip().lower() for c in row]
            has_date = any("date" in c for c in row_lower)
            has_label = any("libell" in c or "opé" in c or "label" in c for c in row_lower)
            
            if has_date and has_label:
                header_found = True
                for idx, cell in enumerate(row_lower):
                    if "date" in cell:
                        col_date_idx = idx
                    elif "libell" in cell or "opé" in cell or "label" in cell:
                        col_label_idx = idx
                    elif "débit" in cell or "debit" in cell:
                        col_debit_idx = idx
                    elif "crédit" in cell or "credit" in cell:
                        col_credit_idx = idx
                    elif "montant" in cell or "amount" in cell:
                        col_amount_idx = idx
                continue

        # Traitement d'une ligne de transaction
        if len(row) <= max(col_date_idx, col_label_idx, 0):
            continue

        # Si pas d'en-tête trouvé explicitement, on essaie la détection automatique des colonnes
        if col_date_idx == -1:
            col_date_idx = 0
            col_label_idx = 1
            if len(row) >= 4:
                col_debit_idx = 2
                col_credit_idx = 3
            elif len(row) >= 3:
                col_amount_idx = 2

        raw_date = row[col_date_idx] if col_date_idx < len(row) else ""
        parsed_d = parse_date(raw_date)
        if not parsed_d:
            continue  # Ligne ignorée si pas de date valide (ex: métadonnées de haut de fichier)

        raw_label = row[col_label_idx] if col_label_idx < len(row) else ""
        label = re.sub(r"\s+", " ", raw_label).strip()

        amount: float | None = None

        # Si colonnes séparées Débit / Crédit
        if col_debit_idx != -1 or col_credit_idx != -1:
            debit_val = parse_french_amount(row[col_debit_idx]) if col_debit_idx < len(row) else None
            credit_val = parse_french_amount(row[col_credit_idx]) if col_credit_idx < len(row) else None

            if credit_val is not None and credit_val != 0:
                amount = abs(credit_val)
            elif debit_val is not None and debit_val != 0:
                amount = -abs(debit_val)
            elif credit_val == 0 or debit_val == 0:
                amount = 0.0

        # Si colonne Montant unique
        elif col_amount_idx != -1 and col_amount_idx < len(row):
            amount = parse_french_amount(row[col_amount_idx])

        if amount is None:
            continue

        import_hash = compute_import_hash(parsed_d, label, amount)

        transactions.append({
            "transaction_date": parsed_d,
            "original_label": label,
            "amount": amount,
            "import_hash": import_hash,
        })

    return transactions
