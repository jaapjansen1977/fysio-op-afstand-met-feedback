# Physio Exercise Feedback — MVP 1

Een lokale React/TypeScript/Vite-app voor het voorschrijven en analyseren van **EX001 — Tweebenige squat** en **EX002 — Opstaan uit een stoel**, beide sagittaal gefilmd. Geen backend, account, betaald abonnement of cloudanalyse. Alleen fictieve gegevens gebruiken. Dit prototype is niet klinisch gevalideerd.

## Starten op Windows — stap voor stap

1. Installeer **Node.js 24 LTS, minimaal 24.10** vanaf https://nodejs.org. Sluit daarna bestaande terminalvensters en open een nieuw venster.
2. Download deze projectmap of clone de repository met Git. Pak een eventuele ZIP eerst uit.
3. Open de projectmap in Verkenner. Typ `cmd` in de adresbalk en druk op Enter. Zo start je de Opdrachtprompt direct in de juiste map. Hier hoort `package.json` te staan.
4. Installeer de vastgelegde afhankelijkheden:

   ```bat
   npm ci
   ```

   De installatie kopieert MediaPipe WASM-bestanden naar `public/wasm` en probeert het officiële Lite-model te downloaden. Hiervoor is eenmalig internet nodig. Een ontbrekend model geeft een waarschuwing, zodat demo en tests nog bruikbaar zijn.
5. Controleer/download het cameramodel expliciet:

   ```bat
   npm run assets
   ```

   Deze opdracht moet slagen voordat je de webcam gebruikt. Het model staat daarna in `public/models/pose_landmarker_lite.task`. Downloadbron: `storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`. TLS-verificatie blijft aan. WASM en model worden daarna vanaf de eigen app geladen; er is tijdens analyse geen externe dienst nodig.
6. Start de app:

   ```bat
   npm run dev
   ```

7. Open het door Vite getoonde **localhost-adres** in Chrome of Edge, standaard poort 5173. Houd het terminalvenster open. Sluit de server met **Ctrl+C**.
8. Stel onder **Voorschrijven** het voorschrift in. Kies **Naar oefenomgeving → Webcam starten** en geef cameratoestemming. Geen webcam? Kies **Probeer de demonstratie**; die gebruikt herkenbaar synthetische gegevens.

Bij een PowerShell-melding over `npm.ps1` kun je de Opdrachtprompt gebruiken of `npm.cmd ci` / `npm.cmd run dev` uitvoeren. Een aparte Python-, Docker- of databaseserver is niet nodig.

### Als de camera niet werkt

- Gebruik localhost of HTTPS; een onbeveiligd LAN-adres geeft op veel browsers geen cameratoegang.
- Controleer Windows **Instellingen → Privacy en beveiliging → Camera**, cameratoestemming in de browser en of een andere app de camera bezet houdt.
- Controleer of `npm run assets` slaagt. Bij een bedrijfsnetwerk moeten `registry.npmjs.org` en `storage.googleapis.com` bereikbaar zijn. Gebruik ondersteunde proxy- en CA-configuratie; schakel certificaatcontrole niet uit.
- Film exact van de zijkant, op heuphoogte, met het hele lichaam zichtbaar. Selecteer de kijkrichting zoals die in het **niet gespiegelde** beeld staat.
- Begin bij de squat rechtop en wacht op **Klaar voor de volgende squat**. Begin bij EX002 op de stoel en wacht op **Klaar om op te staan**. Slechte zichtbaarheid pauzeert de analyse en annuleert de lopende herhaling. Ga terug naar de startpositie: rechtop bij EX001, zittend bij EX002. Het referentiebeen wisselt pas bij een nieuwe set.

## Gebruik

- Kies bovenaan **Voorschrijven → Oefening kiezen** tussen EX001 — Tweebenige squat en EX002 — Opstaan uit een stoel. EX001 staat onder **Spierkracht en weerstand**; EX002 onder zowel **Functionele bewegingen** als **Spierkracht en weerstand**. Alle zes categorieën blijven beschikbaar.
- Configureer sets, herhalingen, tempo (neer/vasthouden/op in seconden), belasting, camerakijkrichting, meetselectie, feedbackselectie, bereik en tolerantie.
- **Voorschrift opslaan** bewaart lokaal; JSON-export/-import maakt uitwisseling en herstel mogelijk. Import wordt gevalideerd voordat het voorschrift bruikbaar is.
- Feedback kan tijdens de beweging, na elke herhaling of na elke set. Setfeedback beoordeelt **gemiddelden van herhalingswaarden**, niet iedere uitschieter. De resultatentabel toont daarnaast per herhaling de doelbeoordeling.
- Live feedback gebruikt momentane hoeken en streksnelheid tijdens extensie; ROM en duur worden pas na afronding beoordeeld. Dit staat los van de uiteindelijke maxima in resultaten.
- Tolerantie verruimt het ingestelde interval: bij 70–90° en ±3° is 67–93° inclusief binnen bereik. Dit zijn voorbeelden, geen normen. Positieve, neutrale en corrigerende teksten staan in JSON.
- Stemfeedback gebruikt `speechSynthesis`. Beschikbaarheid en uitspraak hangen af van browser/OS. Voor gegarandeerd offline spraak is een lokaal geïnstalleerde stem nodig; sommige systeemstemmen gebruiken een externe spraakdienst. Beelden gaan nooit naar een spraakdienst.
- **Pauzeren** annuleert de lopende herhaling. **Hervatten** vereist opnieuw de startpositie van de gekozen oefening; het referentiebeen blijft behouden. Tussen sets kies je zelf wanneer je verdergaat. **Stoppen** bewaart de reeds voltooide herhalingen en toont resultaten.
- Resultaten bevatten tabel, hoek-tijdgrafiek en JSON-/CSV-export. JSON bevat ook tijdreeksen, volledig voorschrift, fasegrenzen en trackingstatistieken. De laatste vijf sessies blijven in browseropslag. Bij volle/geblokkeerde opslag krijg je een melding en kun je exporteren. Wis browser-sitegegevens om lokale gegevens te verwijderen.
- **Meten uit** verwijdert de betreffende samenvattende parameter uit de herhalingstabel/export (null). De interne pose-/hoekketen berekent alle basishoeken voor detectie en de diagnostische tijdreeks. Kniehoek blijft altijd nodig als primaire cyclusvariabele.

## Architectuur

| Module | Verantwoordelijkheid |
|---|---|
| `src/domain/ExerciseLibrary.ts` | Gevalideerde JSON-oefeningen, categorieën, parameterlabels en feedbackteksten |
| `src/domain/ExercisePrescription.ts` | TypeScript-voorschrift en runtime-validatie met Zod |
| `src/pose/PoseEstimator.ts` | Vervangbare interface: initialize, estimate, dispose |
| `src/pose/MediaPipePoseEstimator.ts` | MediaPipe Pose Landmarker Lite, lokaal WASM, CPU, videomodus |
| `src/engine/LandmarkProcessor.ts` | Zichtbaarheid, beeldgrenzen en referentiebeen per set |
| `src/engine/KinematicsEngine.ts` | 2D-hoeken, tijdgebaseerde filtering en hoeksnelheid |
| `src/engine/RepetitionDetector.ts` | Squatstrategie: staan → zakken → opstaan |
| `src/engine/SitToStandDetector.ts` | Stoelstrategie: zitten → opstaan → staan → zitten |
| `src/engine/RepMetrics.ts` | Gedeelde strategie-interface en berekening van herhalingsmetingen |
| `src/engine/FeedbackEngine.ts` | Oefeningonafhankelijke bereik-/kwaliteitsbeoordeling |
| `src/session/ExerciseSession.ts` | Orkestratie, setvoortgang en onderbrekingen |
| `src/session/SessionRecorder.ts` | Tijdreeksen, statistieken, lokale opslag en exports |
| `src/ui/TherapistUI.tsx` | Voorschrift instellen |
| `src/ui/PatientUI.tsx` | Camera, overlay, bediening en feedbackpresentatie |
| `src/ui/ResultsUI.tsx` | Resultatentabel en SVG-grafiek |

Nieuwe oefeningen met dezelfde kniegestuurde bewegingscyclus kunnen hoofdzakelijk worden toegevoegd in `src/data/exercises.json`, inclusief detectorinstellingen en categorieën. Nieuwe **bewegingsmodellen** (zoals sprongen, balans of asymmetrische oefeningen) vereisen een aparte analysestrategie en schema-uitbreiding. Ze zijn niet automatisch gevalideerd door het toevoegen van JSON. De oefenkiezer, instructies, demo, sessies en exports volgen het gekozen exerciseId. `detector.kind` kiest de squat- of sit-to-stand-strategie; parameterlabels, fase-instructies, tempo-volgorde en camerainstructies staan in JSON. Een MoveNet-adapter kan later dezelfde genormaliseerde landmarkstructuur aanleveren.

## Meetdefinities en algoritmen

Alle hoeken worden in het sagittale **2D-beeldvlak** berekend. Genormaliseerde coördinaten worden eerst naar pixels geschaald zodat de beeldverhouding de hoeken niet vervormt. Geen 3D-gewrichtshoeken of camerakalibratie.

- **Knieflexie** = 180° − ingesloten hoek `(heup − knie, enkel − knie)`. Recht been = 0°, rechte hoek = 90°.
- **Heupflexie** = 180° − ingesloten hoek `(schouder − heup, knie − heup)`. Rechtop met gestrekte heup = 0°, horizontaal bovenbeen met verticale romp = 90°. Dit is een ongetekende buighoek (0–180°); heupextensie en bekkenkanteling worden niet afzonderlijk gemeten.
- **Rompinclinatie** = `atan2(anterior * (schouder.x − heup.x), heup.y − schouder.y)`. Verticale romp = 0°, vooroverbuiging positief, achteroverbuiging negatief. `anterior` is +1 bij naar rechts kijken en −1 bij naar links kijken. Schouder is vereist; een nekfallback is nog niet geïmplementeerd.
- De betrouwbaarheid van elk landmark is het minimum van visibility en, indien aanwezig, presence. Het been met de hoogste minimale heup-/knie-/enkelbetrouwbaarheid wordt bij de eerste geldige meting vastgezet. Ook de schouder moet voldoende betrouwbaar zijn. Geen wissel bij occlusie.
- **Hoeksnelheid**: afgeleide van de gefilterde kniehoek via werkelijke `performance.now()`-timestamps, in °/s, daarna een tweede laagdoorlaatfilter. Positief = flexie; maximale streksnelheid = grootste negatieve snelheid als positieve magnitude tijdens de concentrische fase.
- Beide filters zijn eerste orde, tijdgebaseerd: `alpha = 1 − exp(−dt/τ)`. Configureer τ voor hoek en snelheid afzonderlijk. Langere filtering dempt ruis maar vertraagt pieken en faseovergangen. Na een meetgat/pauze wordt het filter herstart; er wordt geen snelheid over het gat berekend.
- Squatdetector (EX001): `seeking → ready → eccentric → concentric → seeking`. Eerst minstens 250 ms bijna extensie (≤12°), starten bij ≥22°, omslag na ≥5° afname vanaf lokale piek, eindigen bij ≤12°. Standaard minimaal 30° ROM, elke fase ≥250 ms en herhaling 1–15 s. Alle drempels staan in JSON. ROM = maximum minus minimum binnen de herkende herhaling; fasegrenzen zijn drempel-/piekgebaseerde schattingen, geen fysiologische labels uit een krachtmeting.
- Stoeldetector (EX002): `seeking → ready → concentric → eccentric → seeking`. Begin minstens 250 ms in een geschatte zitpositie (knieflexie ≥65°). Opstaan start na ≥5° afname, de staande positie vereist minstens 250 ms bij ≤12°. Terugzitten wordt na ≥22° flexie gevolgd en vereist ≥250 ms op minstens 65° én binnen 5° van de oorspronkelijke zittende kniehoek. Minimaal 40° ROM en 1,5–20 s per cyclus. Een mislukte opsta-poging die terugkeert naar zit wordt afgewezen. De maximale kniestreksnelheid komt uit de eerste, opwaartse fase. In JSON is `turn` het omslagpunt en `turnPosition` `standing`; het bestaande veld `bottom` blijft alleen voor de squat bestaan. Faseduren volgen het hoekminimum/-maximum en kunnen tijd van vasthouden bevatten.
- Onbetrouwbare/ontbrekende landmarks of te lange meetintervallen annuleren de lopende herhaling. Geen interpolatie voor herhalingsdetectie. Geen feedback bij onvoldoende kwaliteit. Kwaliteit per herhaling = minimum van de vereiste landmarkbetrouwbaarheden over de herhaling.
- **Effectieve trackingfrequentie** = aantal geldige pose-analyses / actieve meettijd. Trackingverlies telt mee in de actieve tijd; handmatige pauzes en setrust niet. Zowel verwerkte als geldige frames staan in JSON. Dit is niet de videoframerate. Alleen nieuwe videoframes worden geanalyseerd, maximaal ongeveer 30 maal per seconde.

## Controles uitvoeren

```bat
npm test
npm run build
npm run preview
```

De tests gebruiken synthetische hoek-tijdreeksen en landmarks: knie-/heuphoekconventies, rompinclinatie en richting, hoeksnelheid, filtertijdstappen, referentiebeen, ontbrekende landmarks, ruis/minimale ROM/tijdsvoorwaarden, volledige cyclus, feedback/toleranties, JSON-validatie, trackingonderbreking en een complete sessie over twee sets.

## Gecontroleerd in deze cloudtaak

- 40 automatische tests geslaagd (28 bestaande en 12 voor EX002); TypeScript en productiebuild geslaagd.
- Echte Chromium-browser: volledige synthetische sets van EX001 en EX002, doelbeoordeling, JSON/CSV-download, lokale opslag na verversen en mobiele pagina van 390 px gecontroleerd. EX002 ook met naar links kijken, categorie-/oefenkeuze, correcte exportnamen en behoud van opgeslagen resultaten gecontroleerd. Geen JavaScript-paginafouten. Demo rond 30 Hz; **geen camerabenchmark**.
- Vite-server start en serveert de applicatie. Geen native Windows-uitvoering getest; de scripts gebruiken platformonafhankelijke Node-API's.
- De officiële modeldownload is in deze cloudomgeving aanvankelijk door de netwerkpolicy geblokkeerd. `storage.googleapis.com` is aan de configuratiedraft toegevoegd. Zolang die netwerktoegang niet actief is, werken demo/tests/build maar is de echte MediaPipe-webcamroute hier **niet gevalideerd**. Na opslaan/publiceren van de omgevingsinstellingen: voer `npm run assets` uit en controleer de camera opnieuw. Op Windows gebruikt de download je eigen netwerktoegang.

## Beperkingen en volgende validatie

- EX002 schat zitten uit de kniehoek; contact met de stoel en de aanwezigheid/stevigheid van de stoel worden niet gedetecteerd. Een squat of hurkpositie kan op een zitpositie lijken. Gebruik een stevige stoel zonder wielen en begeleiding waar nodig. Dezelfde kniehoek-drempels passen niet bij elke stoel/person; eerst praktijkvalidatie en eventuele aanpassing van de JSON-drempels.
- Geen klinische validatie, hoeknauwkeurigheidsclaim of geschiktheidsclaim voor behandeling. Controleer tegen referentiemetingen, verschillende personen, kleding, verlichting, camerahoogtes en bewegingssnelheden.
- Veronderstelt vergelijkbare squatdiepte van beide benen. Bilaterale asymmetrie, valgus, gewrichtsmomenten, belasting en bekkenrotatie worden niet beoordeeld. Camera-uitlijning wordt geïnstrueerd, niet automatisch vastgesteld.
- Nog geen echte laptop-/webcamfrequentie of snelle sportbewegingen gevalideerd. Huidige CPU-inferentie draait op de hoofdthread; voor snelle sportbewegingen zijn benchmarks, worker-inferentie en aangepaste filters/detectie nodig.
- Tempo en belasting worden voorgeschreven en opgeslagen; tempo wordt niet automatisch op doeltempo beoordeeld. De demo volgt een vaste synthetische cyclus en bootst het voorschrifttempo niet na.
- Responsieve UI en `playsInline`/camera-facing hints bereiden smartphoneondersteuning voor; mobiele camera, browsercompatibiliteit en thermische prestaties zijn niet getest. Buiten localhost is HTTPS nodig.
- Geen permanente video-opslag. Wel lokaal opgeslagen afgeleide bewegingsgegevens. Gebruik uitsluitend fictieve data. Geen patiëntenadministratie, authenticatie of cloudinfrastructuur.
- Maximaal 30 minuten per sessie en vijf lokale sessies; exporteer voor langer bewaren. Lokale opslag kan door browserbeleid of opslaglimieten falen.
