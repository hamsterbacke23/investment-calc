# Deutsche Steuer- & Sozialversicherungs-Konstanten (Stand 2026)

> **Wozu dieses Dokument?**
> Es ist die **Herleitung und Quellen-Dokumentation** für die Steuer-Konstanten,
> die der Rechner verwendet. Die *gelebten* Werte stehen im Code in
> [`src/utils/tax.js`](../src/utils/tax.js) — dies hier ist die Begründung dahinter
> (primäre Rechtsquellen, Vergleich 2025↔2026, Update-Trigger fürs Folgejahr).
>
> **Kein Code.** Nicht importieren. Bei einer Änderung im Code beide Stellen
> abgleichen — oder besser: hier zuerst nachschlagen, dann `tax.js` anpassen.
>
> Konfidenz: HOCH, sofern nicht inline anders vermerkt.

---

## 1) Einkommensteuertarif §32a EStG (Grundtarif, ledig)

Festgesetzt durch das **Steuerfortentwicklungsgesetz (SteFeG)**, 23.12.2024,
BGBl. 2024 I Nr. 449. Quelle: <https://www.gesetze-im-internet.de/estg/__32a.html>

Berechnung: `x` = zvE auf volle Euro **abgerundet**; Ergebnis ebenfalls auf
volle Euro **abgerundet** (§32a Abs. 1).

| Größe | 2025 | 2026 | Hinweis |
|---|--:|--:|---|
| Grundfreibetrag (Zone 1 Obergrenze) | 12.096 | **12.348** | +252 € |
| Zone 2 Obergrenze | 17.443 | **17.799** | |
| Zone 3 Obergrenze | 68.480 | **69.878** | |
| 42 %-Schwelle | 68.481 | **69.879** | |
| 45 %-Schwelle (Reichensteuer) | 277.826 | **277.826** | **bewusst nicht** indexiert |
| z2a / z2b | 932,30 / 1400 | **914,51 / 1400** | Zone 2: `(z2a·y + z2b)·y`, `y = (x − GFB)/10000` |
| z3a / z3b / z3c | 176,64 / 2397 / 1015,13 | **173,10 / 2397 / 1034,87** | Zone 3: `(z3a·z + z3b)·z + z3c`, `z = (x − Z2)/10000` |
| z4c (42 %) | 10.911,92 | **11.135,63** | Zone 4: `0,42·x − z4c` |
| z5c (45 %) | 19.246,67 | **19.470,38** | Zone 5: `0,45·x − z5c` |

Splitting (Ehe, Zusammenveranlagung): `Steuer = 2 · §32a(zvE/2)`.
Im Rechner wird der Grundtarif verwendet (Einzelveranlagung).

## 2) Rentenbesteuerung §22 EStG

- **Besteuerungsanteil** ist an das **Jahr des Rentenbeginns** gekoppelt und steigt
  für die*selbe* Person danach **nicht** weiter. Seit dem Wachstumschancengesetz
  (rückwirkend ab VZ 2023): **+0,5 pp je Kohortenjahr**.
  - 2023 → 82,5 % · 2024 → 83,0 % · 2025 → 83,5 % · **2026 → 84,0 %** · 2027 → 84,5 %
  - erreicht **100 %** für Rentenbeginn **2058** (vor WtCG war es 2040).
  - Formel im Code: `min(100, 82,5 + 0,5·(rentenbeginnJahr − 2023))`.
- **Werbungskosten-Pauschbetrag Rente** (§9a S.1 Nr.3 EStG): **102 €/Jahr**
  (nicht zu verwechseln mit dem 1.230-€-Arbeitnehmer-Pauschbetrag).
- **Rentenfreibetrag** ist *keine* Konstante: `Freibetrag = Jahresrente(erstes
  volles Jahr) · (1 − Besteuerungsanteil)`, danach lebenslang eingefroren — spätere
  Rentenerhöhungen sind voll steuerpflichtig (§22 Nr.1 S.3 a) aa) EStG).
  *Vereinfachung im Modell:* §32a-Tarif wird als inflationsindexiert angenommen,
  der eingefrorene Freibetrag wird nicht abgebildet → späte Jahre minimal optimistisch.

## 3) Investmentsteuer / Vorabpauschale (InvStG 2018)

**Basiszins zum 2. Januar** (Deutsche Bundesbank, veröffentlicht via BMF):

| Jahr | Basiszins | Quelle |
|---|--:|---|
| 2023 | 2,55 % | BMF 04.01.2023 |
| 2024 | 2,29 % | BMF 04.01.2024 |
| 2025 | 2,53 % | BMF 10.01.2025, BStBl I S. 273 |
| **2026** | **3,20 %** | **BMF 13.01.2026** |

- Vorabpauschale-Faktor: **0,7** (§18 Abs.1 S.2 InvStG: 70 % des Basiszinses).
- Basisertrag gedeckelt auf den Wertzuwachs des Jahres inkl. Ausschüttungen
  (§18 Abs.1 S.3). Thesaurierend ⇒ keine Ausschüttungen.
- Vorabpauschale = `Basisertrag − Ausschüttungen`, ≥ 0. Bei Basiszins ≤ 0 entfällt sie.
- Zufluss: erster Werktag des Folgejahres (§18 Abs.3) → VAP 2026 fließt 04.01.2027 zu.
- §19 Abs.1 S.3: beim Verkauf wird der Gewinn um alle während der Haltedauer
  versteuerten Vorabpauschalen gemindert (keine Doppelbesteuerung).

### Kapitalertragsteuer (Aktien-ETF)
- Abgeltungsteuer **25 %** + **5,5 % Soli** ⇒ effektiv **26,375 %** (ohne Kirchensteuer).
- Teilfreistellung Aktienfonds **30 %** (§20 Abs.1 InvStG); Mischfonds 15 %.
- Sparerpauschbetrag **1.000 €** (ledig; 2.000 € bei Zusammenveranlagung) —
  greift **nach** der Teilfreistellung.

## 4) Kranken- & Pflegeversicherung der Rentner (KVdR + SPV), 2026

Sätze als **Eigenanteil des Rentners** an der Bruttorente.

- KV allgemein 14,6 % (§241 SGB V) → Rentner zahlt die Hälfte: **7,3 %**.
- Zusatzbeitrag (Ø §242a SGB V): 2025 **2,5 %** → 2026 **2,9 %**; seit 2019 50/50 mit
  der DRV ⇒ Rentner-Anteil = Ø/2 → 2026 **1,45 %**.
- Pflege: Rentner zahlt den **vollen** Satz (DRV trägt 0). Mit Kind **3,6 %**,
  kinderlos (≥23) **4,2 %**. Abschlag je Kind (2.–5. Kind, <25): −0,25 pp, max −1,0 pp.

**Effektiver Abzug von der Bruttorente** (Ø-Zusatzbeitrag):

| | mit Kind(ern) | kinderlos |
|---|--:|--:|
| 2025 | 12,15 % | 12,75 % |
| **2026** | **12,35 %** | **12,95 %** |

## 5) Monte-Carlo-Defaults (Design-Annahmen, keine Gesetzeswerte)

Als Slider exponiert — Begründung/Bandbreiten:

| Default | Wert | Bandbreite |
|---|--:|---|
| Aktienrendite nominal, brutto | 7,0 % p.a. | 6,5–8 % |
| Volatilität (Jahres-σ) | 15 % | 14–16 % |
| ETF-Gesamtkosten (all-in) | ~0,5 % p.a. | bis 0,7 % (TER ~0,20 % + Spread + Tracking) |
| Sichere Entnahmerate | 3,5 % | konservativ 3,0 % |
| Ziel-Erfolgswahrscheinlichkeit | 90 % | 85 % / 95 % |

---

## Update-Checkliste fürs Folgejahr (z. B. 2027)

Was sich **wann** ändert und wo es im Code steht (`src/utils/tax.js`):

1. **§32a-Tarif** — neue Werte aus dem jeweils gültigen Steuergesetz (BGBl). Ändert
   sich i. d. R. jährlich. → `TARIFF_2026` (umbenennen/ersetzen).
2. **Basiszins Vorabpauschale** — **jeden Januar** neu (BMF-Schreiben, „Basiszins zum
   2. Januar"). → `VORAB_BASISZINS`.
3. **Besteuerungsanteil** — Formel bleibt (`+0,5 pp/Kohorte`), nichts zu tun, solange
   §22 unverändert. → `besteuerungsanteil()`.
4. **KV-Zusatzbeitrag (Ø)** — jährlich vom GKV-SV festgelegt → ändert den KV/PV-Abzug.
   → `kvpvRate()`.
5. **Reichensteuer-Schwelle (45 %)** — historisch *nicht* indexiert; nur bei
   Gesetzesänderung anfassen.

## Quellen

- §32a, §22, §9a EStG; InvStG 2018 §§18–20 — <https://www.gesetze-im-internet.de>
- Steuerfortentwicklungsgesetz (SteFeG), BGBl. 2024 I Nr. 449
- BMF-Schreiben „Basiszins zum 2. Januar" (jährlich)
- DRV (Besteuerungsanteil, KVdR), GKV-Spitzenverband (Ø-Zusatzbeitrag)
