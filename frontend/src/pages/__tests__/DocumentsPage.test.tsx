import { describe, it, expect } from 'vitest';
import { autoDetectFromFilename, cleanCategory } from '../Documents';

describe('Documents auto-detection and dynamic categories', () => {
  const defaultCats = [
    'Banque',
    'EDF',
    'Eau',
    'Fibre',
    'Assurance',
    'Impôts / Taxe foncière',
    'Statuts & Kbis',
    "PV d'AG",
    'Appels de fonds',
    'Autres',
  ];

  it('detects standard subfolders correctly without 01, 02 prefixes', () => {
    expect(autoDetectFromFilename('Facture EDF Janvier 2026.pdf', defaultCats)).toEqual({
      year: 2026,
      category: 'EDF',
    });

    expect(autoDetectFromFilename('Veolia_Eau_2026.pdf', defaultCats)).toEqual({
      year: 2026,
      category: 'Eau',
    });

    expect(autoDetectFromFilename('Orange_Fibre_Facture.pdf', defaultCats).category).toBe('Fibre');
    expect(autoDetectFromFilename('Assurance_PNO_AXA_2026.pdf', defaultCats).category).toBe('Assurance');
    expect(autoDetectFromFilename('Avis_Taxe_Fonciere_2026.pdf', defaultCats).category).toBe('Impôts / Taxe foncière');
    expect(autoDetectFromFilename('Releve_Banque_Janvier.pdf', defaultCats).category).toBe('Banque');
  });

  it('detects administrative documents under the year folders', () => {
    expect(autoDetectFromFilename('Extrait KBis_4671748_.pdf', defaultCats)).toEqual({
      year: expect.any(Number),
      category: 'Statuts & Kbis',
    });

    expect(autoDetectFromFilename("Procès-verbal d'assemblée générale des associés (PV d'AG).pdf", defaultCats)).toEqual({
      year: expect.any(Number),
      category: "PV d'AG",
    });

    expect(autoDetectFromFilename('Gestion SCI - Appel de fond 2026.pdf', defaultCats)).toEqual({
      year: 2026,
      category: 'Appels de fonds',
    });

    expect(autoDetectFromFilename('SPANC - Rapport Vente - 658-180-2.pdf', defaultCats)).toEqual({
      year: expect.any(Number),
      category: 'Autres',
    });
  });

  it('detects newly added custom categories dynamically', () => {
    const customCats = [...defaultCats, 'Travaux', 'Notaire'];
    expect(autoDetectFromFilename('Devis_Toiture_Travaux_2026.pdf', customCats)).toEqual({
      year: 2026,
      category: 'Travaux',
    });
    expect(autoDetectFromFilename('Courrier_Notaire_Acquisition.pdf', customCats).category).toBe('Notaire');
  });

  it('cleans category prefixes properly', () => {
    expect(cleanCategory('01 - Banque')).toBe('Banque');
    expect(cleanCategory('02 - EDF')).toBe('EDF');
    expect(cleanCategory('07 - Autres factures')).toBe('Autres');
    expect(cleanCategory('Statuts & Kbis')).toBe('Statuts & Kbis');
  });
});
