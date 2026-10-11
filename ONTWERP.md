# Veldgis: ontwerp

Een webapp voor in het veld. Je ziet op je eigen positie, of op een plek die je zelf kiest, open kaartlagen over het landschap: bodem, geomorfologie, hoogte en historische kaarten. Het doel is het landschap om je heen beter te begrijpen.

## 1. Uitgangspunten

| Uitgangspunt | Wat het betekent voor het ontwerp |
|---|---|
| **Buiten, lopend, één hand** | Alle knoppen minstens 64 px hoog. Geen menu's of kleine iconen; elke handeling kost hooguit 1 tik. |
| **Zonlicht** | Licht thema met veel contrast, dikke randen, grote letters (≥ 18 px) en geen subtiele grijstinten. |
| **Eenvoud boven volledigheid** | Je ziet altijd **één hoofdlaag**, met daarover **reliëf** dat je met een slider inmengt. Er komt geen lagenstapel met vinkjes. |
| **Kaart is uitleg** | Een legenda van 300 bodemcodes is buiten onleesbaar. Je tikt op **"Wat is hier?"** en leest het in gewone taal. |
| **Altijd actuele open data** | Alles komt live van PDOK, BRO, AHN en Kadaster (Topotijdreis). Er is geen eigen server nodig. |

## 2. Het centrale idee: het vizier

Midden op de kaart staat een **vizier (+)**. Daar gaat alles over.

- **GPS volgen aan** → de kaart blijft op jou gecentreerd, dus het vizier is je eigen positie.
- **Kaart verschuiven met je vinger** → volgen gaat automatisch uit. Het vizier is nu een **zelf gekozen positie**.
- **Een tik op de positieknop** brengt je terug naar je eigen plek.

Zo heb je geen apart menu nodig om een positie te kiezen. Er staat bewust geen statuslabel op de kaart; de blauwe volgknop laat zien of je gevolgd wordt.

**Twee standen:** met de ronde knop rechtsonder wissel je tussen **schermvullende kaart** (alle bediening weg, op Android ook de browserbalken) en **kaarten kiezen** (lagen, sliders, "Wat is hier?"). "Wat is hier?" vraagt altijd de gegevens op onder het vizier.

## 3. Scherm-indeling (telefoon, staand)

```
┌──────────────────────────────┐
│                     ┌──────┐ │
│                     │  ◎   │ │  ← Volg mij (GPS), groot en rond
│                     └──────┘ │
│                              │
│                     ┌──────┐ │
│                     │  ⛶   │ │  ← schermvullende kaart ⇄ kaarten kiezen
│                     └──────┘ │
│                              │
│              +               │  ← vizier
│          (kaart)             │
│                              │
│ ┌──────────────────────────┐ │
│ │  1932   ━━━━━━●━━━━━━━   │ │  ← alleen bij Tijdreis: jaarslider
│ ├──────────────────────────┤ │
│ │ Reliëf  ━━━━●━━━━━━━  40%│ │  ← mengslider AHN-reliëf
│ ├──────────────────────────┤ │
│ │[Topo] [Foto]  [Tijdreis] │ │  ← laagkiezer, 3 × 3 grote knoppen
│ │[Bodem][Geo]   [Gewassen] │ │
│ │[SNL]  [Flora] [Vogels]   │ │
│ ├──────────────────────────┤ │
│ │      WAT IS HIER?        │ │  ← grote knop, opent infopaneel
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Infopaneel ("Wat is hier?")** schuift van onderen omhoog als kaartjes onder elkaar:

```
 BODEM        Haarpodzolgronden; leemarm en zwak lemig fijn zand  (Hd21)
 LANDVORM     Trechtervormig droogdal
              Periglaciaal ontstaan, permafrost en smeltwater  [meer ›]
 HOOGTE       62,3 m +NAP
 PLANTEN      2 soorten binnen 100 m: Bernagie, Citroenmelisse
 PLEK         RD 190048, 460052 · ±5 m GPS
```

Het paneel ververst automatisch als je doorloopt of de kaart verschuift (met 1 s vertraging). Wegvegen of op de kaart tikken sluit het.

## 4. Kaartlagen

Alle lagen zijn **getest**: ze werken, zijn CORS-vrij en draaien in RD (EPSG:28992).

| Laag | Bron | Service / laagnaam | "Wat is hier?" |
|---|---|---|---|
| Topo (ondergrond) | PDOK BRT Achtergrondkaart | WMTS `standaard` / `grijs` | – |
| Luchtfoto | PDOK Luchtfoto RGB | WMTS `Actueel_orthoHR` | – |
| Bodem | BRO Bodemkaart 1:50.000 | WMS `bzk/bro-bodemkaart/wms/v1_0`, laag `soilarea` | bodemcode + naam |
| Geomorfologie | BRO Geomorfologische kaart | WMS `bzk/bro-geomorfologischekaart/wms/v2_0`, laag `geomorphological_area` | landvorm, genese, reliëf, link naar WUR-legenda |
| Flora | GBIF (vooral Waarneming.nl/ObsIdentify, Dutch Vegetation Database, Pl@ntNet, iNaturalist) | Uitgezoomd: dichtheidstegels `v2/map/occurrence/density` (planten, NL, sinds 2000). Ingezoomd: waarnemingen via `v1/occurrence/search`, gegroepeerd per plek, met Nederlandse namen (Nederlands Soortenregister) | plantensoorten binnen 100 m |
| Vogels | GBIF (vooral Waarneming.nl, eBird), alleen menselijke waarnemingen sinds 2020 (zonder GPS-zenderdata) | Zelfde opzet als Flora | vogelsoorten binnen 250 m |
| Gewassen (BRP) | RVO / PDOK Basisregistratie Gewaspercelen | WMS `rvo/brpgewaspercelen/wms/v1_0`, laag `BrpGewas` | gewas, categorie, jaar |
| SNL-natuurtypen | Natuurbeheerplan, BIJ12 / provincies | WMS `geoservices.portaalnatuurenlandschap.nl/geoserver/IMNa_NBP/wms`, laag `imna_nbp_viewer_beheer_gebied`, stijl `IMNa_2026_definitief_beheergebied` | beheertype (bijv. N07.01 Droge heide) |
| Hoogte | AHN | WMS `rws/ahn/wms/v1_0`, laag `dtm_05m` (alleen voor de hoogte in "Wat is hier?") | hoogte in m NAP |
| Reliëf (schaduw) | AHN | WCS `rws/ahn/wcs/v1_0`, coverage `dtm_05m`; schaduw berekend in de browser | – |
| Tijdreis | Kadaster Topotijdreis | ArcGIS-tegels `Historische_tijdreis_{jaar}`, **elk jaar 1815–2026** | – |

Thematische lagen (bodem, geomorfologie) liggen over de grijze BRT-kaart. Op plekken die niet gekarteerd zijn, zoals bebouwing, zie je zo toch waar je bent.

## 5. Reliëf inmengen (de kern)

De AHN-WMS levert alleen een kleurenkaart. Voor goed reliëf **berekent de app zelf een hillshade**:

1. Per kaarttegel vraagt de app de ruwe AHN-hoogtes op via WCS (GeoTIFF, 258×258 px, met een rand van 1 px voor naadloze tegels).
2. De browser leest de hoogtes met `geotiff.js` en berekent per pixel de helling en de belichting (methode van Horn, zon uit het noordwesten). Nederland is vlak, dus het reliëf wordt standaard **overdreven (×4)**.
3. Een vlakke plek wordt **neutraal grijs (50%)**, een zonkant lichter en een schaduwkant donkerder.
4. De laag wordt met CSS `mix-blend-mode: hard-light` over de hoofdlaag gelegd. De kleuren van bijvoorbeeld de bodemkaart blijven zo zichtbaar en krijgen reliëf.
5. **De reliëfslider (0–100%) regelt de dekking** van die laag.

Zo zie je met reliëf op 50% stuwwallen, dekzandruggen, beekdalen en droogdalen ín de bodem- of geomorfologische kaart.

## 6. Tijdreis

- Je kiest "Tijdreis" als hoofdlaag. Boven de laagkiezer verschijnt dan een **grote jaarslider** met het jaartal in grote cijfers.
- Bereik 1815–2025, in stappen van 1 jaar. Tijdens het schuiven wisselt de kaart pas na een korte pauze, zodat er geen vloed aan tegels geladen wordt.
- Je kunt reliëf ook over de oude kaarten mengen. Dan zie je bijvoorbeeld hoe heide, es en beek bij het reliëf passen.
- Later: knoppen **◀ ▶** voor het vorige en volgende jaar waarin de kaart echt veranderde.

## 7. Techniek

| Keuze | Waarom |
|---|---|
| **Gewone HTML/CSS/JS, geen build-stap** | Eenvoudig te onderhouden en direct te hosten (GitHub Pages, Netlify). |
| **OpenLayers 9** | Kan goed met RD (EPSG:28992), WMTS, WMS en eigen tegelroosters (Topotijdreis gebruikt een ander RD-rooster dan PDOK). |
| **proj4** | Rekent GPS (WGS84) om naar RD. |
| **geotiff.js** | Leest de AHN-hoogtes uit de WCS voor de reliëfberekening. |
| **Geolocation API** (`watchPosition`) | Volgt je positie en toont de nauwkeurigheidscirkel. |
| **Screen Wake Lock API** | Houdt het scherm aan tijdens het lopen. |
| **localStorage** | Onthoudt je laatste laag, reliëf-% en jaar. |

## 8. Fasering

**Fase 1: prototype (nu gebouwd)**
- Kaart in RD met vizier, GPS volgen en zelf positie kiezen door te verschuiven
- 9 hoofdlagen (Topo, Luchtfoto, Tijdreis, Bodem, Geomorfologie, Gewassen, SNL, Flora, Vogels), reliëf-mengslider, tijdreis-jaarslider
- Installeerbaar als app (PWA met manifest, iconen en service worker); start ook zonder bereik
- Wisselen tussen schermvullende kaart en kaartkeuze
- "Wat is hier?" met bodem, landvorm, planten in de buurt en hoogte

**Fase 2: veldwaardig**
- Kaarttegels cachen voor gebieden zonder bereik
- Zoeken op plaats of adres (PDOK Locatieserver)
- Hoogteprofiel: teken een lijn en zie een doorsnede uit AHN
- Kompasrichting (kijkrichting) op de positiestip

**Fase 3: verdieping**
- Extra lagen: grondwatertrappen (BRO), Archeologische verwachtingswaarden (IKAW), Kadastrale Minuut 1832, natuurnetwerk
- Uitleg per bodem- en landvormtype in gewone taal (eigen woordenlijst bij de codes)
- Veldnotities met foto op je positie

## 9. Open vragen

1. Welke extra lagen zijn voor jou belangrijk (grondwater, archeologie, kadaster 1832)?
2. Wil je reliëf ook over de **AHN-kleurenkaart** kunnen mengen (dus kleur plus schaduw), of is één reliëfslider genoeg?
3. Wil je de app offline kunnen gebruiken in gebieden zonder bereik? Dat bepaalt hoe zwaar we inzetten op cachen.
