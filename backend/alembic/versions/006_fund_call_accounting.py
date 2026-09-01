"""add call_type to fund_calls and clean fund call cca movements

Revision ID: 006_fund_call_accounting
Revises: 005_document_categories
Create Date: 2026-09-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '006_fund_call_accounting'
down_revision: Union[str, None] = '005_document_categories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Ajouter la colonne call_type sur fund_calls si non existante
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('fund_calls')]
    if 'call_type' not in columns:
        op.add_column(
            'fund_calls',
            sa.Column('call_type', sa.String(50), server_default='charges', nullable=False)
        )

    # 2. Rapprochement rétroactif STRICTEMENT DÉTERMINISTE (BIJECTIF 1-À-1) :
    # Si et seulement s'il existe une preuve relationnelle certaine et unique :
    # - Exactement 1 transaction bancaire candidate pour la ligne d'appel (même associé, montant identique
    #   à la quote-part fcl.amount_due, date >= call_date, cohérence d'exercice, libellé explicite d'appel).
    # - ET réciproquement, cette transaction candidate ne correspond qu'à exactement 1 ligne d'appel.
    #
    # RÈGLE D'OR : S'il existe la moindre ambiguïté (ex: 2 appels du même montant et 2 règlements),
    # aucun rapprochement n'est fait automatiquement, aucun CCA n'est supprimé, et la transaction
    # reste à traiter manuellement par le gérant.
    unlinked_lines = conn.execute(sa.text("""
        SELECT fcl.id AS line_id, fcl.associate_id, fcl.amount_due, fc.id AS call_id, fc.call_date, fc.fiscal_year_id
        FROM fund_call_lines fcl
        JOIN fund_calls fc ON fc.id = fcl.fund_call_id
        WHERE fcl.bank_transaction_id IS NULL
    """)).mappings().all()

    for line in unlinked_lines:
        assoc_id = line["associate_id"]
        amount = line["amount_due"]
        call_date = line["call_date"]
        fy_id = line["fiscal_year_id"]

        # Recherche des transactions candidates pour cette ligne d'appel
        candidates = conn.execute(sa.text("""
            SELECT bt.id, bt.transaction_date, bt.fiscal_year_id
            FROM bank_transactions bt
            WHERE bt.associate_id = :assoc_id
              AND bt.amount = :amount
              AND bt.transaction_date >= :call_date
              AND (:fy_id IS NULL OR bt.fiscal_year_id IS NULL OR bt.fiscal_year_id = :fy_id)
              AND (UPPER(bt.original_label) LIKE '%APPEL%' OR UPPER(bt.category) LIKE '%APPEL%')
              AND NOT (
                  UPPER(bt.original_label) LIKE '%ACQUISITION%'
                  OR UPPER(bt.original_label) LIKE '%CAPITAL%'
                  OR UPPER(bt.original_label) LIKE '%NOTAIRE%'
              )
              AND bt.id NOT IN (
                  SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
              )
        """), {
            "assoc_id": assoc_id,
            "amount": amount,
            "call_date": call_date,
            "fy_id": fy_id,
        }).mappings().all()

        # Si et seulement s'il y a exactement 1 transaction candidate
        if len(candidates) == 1:
            candidate_tx = candidates[0]
            cand_tx_id = candidate_tx["id"]

            # Vérification réciproque : cette transaction ne doit matcher qu'exactement 1 ligne d'appel
            matching_lines = conn.execute(sa.text("""
                SELECT fcl.id
                FROM fund_call_lines fcl
                JOIN fund_calls fc ON fc.id = fcl.fund_call_id
                WHERE fcl.bank_transaction_id IS NULL
                  AND fcl.associate_id = :assoc_id
                  AND fcl.amount_due = :amount
                  AND fc.call_date <= :tx_date
                  AND (:tx_fy_id IS NULL OR fc.fiscal_year_id IS NULL OR fc.fiscal_year_id = :tx_fy_id)
            """), {
                "assoc_id": assoc_id,
                "amount": amount,
                "tx_date": candidate_tx["transaction_date"],
                "tx_fy_id": candidate_tx["fiscal_year_id"],
            }).mappings().all()

            if len(matching_lines) == 1 and matching_lines[0]["id"] == line["line_id"]:
                conn.execute(sa.text("""
                    UPDATE fund_call_lines
                    SET bank_transaction_id = :tx_id
                    WHERE id = :line_id
                """), {"tx_id": cand_tx_id, "line_id": line["line_id"]})

    # 3. Mettre à jour la catégorie des transactions bancaires formellement liées
    # à des lignes d'appel de fonds dans fund_call_lines
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET category = 'Règlement appel de fonds'
        WHERE id IN (
            SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
        )
    """))

    # 4. Nettoyage comptable rétroactif :
    # Supprimer STRICTEMENT ET UNIQUEMENT les mouvements CCA rattachés à une transaction
    # bancaire formellement liée à une ligne d'appel de fonds (preuve relationnelle certaine).
    #
    # CONDITION EXACTE :
    # bank_transaction_id IN (
    #     SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
    # )
    #
    # SÉCURITÉ ABSOLUE :
    # Les avances en CCA (quel que soit leur montant : 18 000 €, 50 000 €, 1 000 €, etc.)
    # ne sont JAMAIS dans la table fund_call_lines (qui est réservée aux appels de fonds).
    # Elles ne peuvent donc jamais être supprimées.
    conn.execute(sa.text("""
        DELETE FROM current_account_movements
        WHERE bank_transaction_id IN (
            SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
        )
    """))


def downgrade() -> None:
    op.drop_column('fund_calls', 'call_type')
