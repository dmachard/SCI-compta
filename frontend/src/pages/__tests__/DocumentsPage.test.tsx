import { describe, it, expect } from 'vitest';
import { autoDetectFromFilename, INVOICE_SUBFOLDERS, ADMIN_SUBFOLDERS } from '../Documents';

describe('Documents auto-detection and folder organization', () => {
  it('detects standard invoice subfolders correctly', () => {
    expect(autoDetectFromFilename('Facture EDF Janvier 2026.pdf')).toEqual({
      type: 'facture',
      year: 2026,
      category: '02 - EDF',
    });

    expect(autoDetectFromFilename('Veolia_Eau_2026.pdf')).toEqual({
      type: 'facture',
      year: 2026,
      category: '03 - Eau',
    });

    expect(autoDetectFromFilename('Orange_Fibre_Facture.pdf').category).toBe('04 - Fibre');
    expect(autoDetectFromFilename('Assurance_PNO_AXA_2026.pdf').category).toBe('05 - Assurance');
    expect(autoDetectFromFilename('Avis_Taxe_Fonciere_2026.pdf').category).toBe('06 - Impôts / Taxe foncière');
    expect(autoDetectFromFilename('Releve_Banque_Janvier.pdf').category).toBe('01 - Banque');
  });

  it('detects administrative and legal documents correctly', () => {
    expect(autoDetectFromFilename('Extrait KBis_4671748_.pdf')).toEqual({
      type: 'administratif',
      year: expect.any(Number),
      category: 'Statuts & Kbis',
    });

    expect(autoDetectFromFilename("Procès-verbal d'assemblée générale des associés (PV d'AG).pdf")).toEqual({
      type: 'administratif',
      year: expect.any(Number),
      category: "PV d'AG",
    });

    expect(autoDetectFromFilename('SPANC - Rapport Vente - 658-180-2.pdf')).toEqual({
      type: 'administratif',
      year: expect.any(Number),
      category: 'Rapports & Diagnostics',
    });

    expect(autoDetectFromFilename('Gestion SCI - Appel de fond 2026.pdf')).toEqual({
      type: 'administratif',
      year: 2026,
      category: 'Appels de fonds',
    });

    expect(autoDetectFromFilename('ATTESTATION DE CHIFFRE D AFFAIRES _MACHARD_SIGNE v2.pdf')).toEqual({
      type: 'administratif',
      year: expect.any(Number),
      category: 'Attestations & Actes',
    });
  });

  it('has all 7 invoice subfolders requested by the user', () => {
    expect(INVOICE_SUBFOLDERS).toEqual([
      '01 - Banque',
      '02 - EDF',
      '03 - Eau',
      '04 - Fibre',
      '05 - Assurance',
      '06 - Impôts / Taxe foncière',
      '07 - Autres factures',
    ]);
  });
});
