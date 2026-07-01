# CinePair — tervezési problémák és javaslatok

Ez a dokumentum a *kódszintű hibákon túli*, mélyebb tervezési/architekturális kérdéseket
gyűjti össze, prioritás szerint. Nem mind hiba — több tudatos kompromisszum vagy jövőbeli
irány. A konkrét bugokat a korábbi audit és a commitok már lefedték.

## 1. Hozzájárulás nélküli párosítás (trust model) — MAGAS · ✅ MEGVALÓSÍTVA
> Elkészült: `invites` kollekció + elfogadás-alapú flow. A meghívás/linkelt-link csak *pending*
> kérést hoz létre (semmilyen hozzáférést nem ad); a címzett a Profilban Elfogadja/Elutasítja,
> és csak elfogadáskor jön létre a kölcsönös `partnerIds`. A szabályok emulátorral tesztelve.

Partner felvétele uid-del vagy QR/link beolvasásával **azonnal, elfogadás nélkül** kölcsönös
hozzáférést ad: aki megszerzi az uid-edet vagy a meghívó linkedet, felveheti magát, és ezzel
elolvashatja, mely filmeket lájkoltad (a swipes-olvasási szabály a linkeltséget nézi).
- **Kockázat:** a megosztott link/QR bárkihez eljuthat; nincs „ki kért összekötést?" visszajelzés.
- **Javaslat:** *pending invite + elfogadás* flow. A meghívás egy dokumentum (`invites/{id}`),
  amit a címzett jóváhagy; csak ezután íródik be a kölcsönös `partnerIds`. Mutasd: „X szeretne
  összekötni veled", Elfogadom / Elutasítom. Egy „kit távolítottam el / ki lát engem" nézet is kell.

## 2. Kliens-oldali match-létrehozás — MAGAS · ✅ RÉSZBEN
> Elkészült: `onSwipeCreated` Cloud Function szerver-oldalon is létrehozza a matchet (redundáns
> biztonsági háló a már megszigorított, tesztelt kliens-út mellett). A create szabály szándékosan
> nyitva marad a *hardened* kliens-útnak, hogy a matchelés Function nélkül is működjön (offline-
> reziliencia). Teljes bezárás (`create: if false`, csak Function ír) egy jövőbeli lépés, ha a
> Function prod-ban bizonyított.

A matchek létrehozása kliensből történik (minden fél maga írja, párosával). A szigorított
szabályok ezt már biztonságossá teszik, de továbbra is racy és a kliensben van az üzleti logika.
- **Javaslat:** a match-létrehozást tedd **Cloud Functionbe** (swipe-write trigger): a szerver
  ellenőrzi mindkét like-ot és írja a match doc-ot. Így a `matches` create szabály teljesen
  bezárható (csak admin/function írhat), és a kliens egyszerűsödik. (A push-hoz már van Function;
  ez természetes kiterjesztés.)

## 3. Korlátlanul növő swipe-történet lekérése — KÖZEPES
`getUserSwipes` **minden** swipe id-t lehúz minden oldalbetöltéskor (és a rekurzió minden
szintjén). Aki több ezer filmet végigpörget, annál ez egyre lassabb és drágább.
- **Javaslat:** lokális cache (IndexedDB/localStorage) a már látott id-knek; vagy „seen cursor";
  vagy a discover lekérdezés szerver-oldali szűrése. A `getUserSwipes`-t emeld ki a rekurzióból
  (egyszer kérd le oldalbetöltésenként, ne szintenként).

## 4. TMDB API-kulcs a kliens-bundle-ben — KÖZEPES · ✅ MEGVALÓSÍTVA (opt-in)
> Elkészült: `tmdb` Cloud Function proxy (a kulcs szerver-oldali secret). A kliens a
> `VITE_TMDB_PROXY_URL` beállításával a proxyn át hív; enélkül a régi, direkt hívás a fallback.
> A kulcs teljes eltávolításához a proxy-URL-t állítsd be, a `VITE_TMDB_API_KEY`-t pedig hagyd üresen.

A `VITE_TMDB_API_KEY` beépül a JS-be, kiszedhető és visszaélésre / rate-limit kimerítésre
használható.
- **Javaslat:** proxyzd a TMDB-hívásokat egy Cloud Function / serverless végponton át (a kulcs
  szerver-oldali secret), és cache-eld a válaszokat. Mellékhaszon: közös cache, kevesebb 429.

## 5. Vestigiális `movies` kollekció — ALACSONY
A filmek a TMDB-ből jönnek; a Firestore `movies` kollekció, a (most eltávolított) `seedMovies`
és az ahhoz tartozó admin-gate gyakorlatilag használaton kívüli.
- **Javaslat:** vagy töröld a `movies` szabályblokkot, vagy építs rá valódi funkciót
  (pl. szerkesztői ajánlások). Az admin-jogot már custom claim adja.

## 6. Vendég (anonim) fiókok életciklusa — KÖZEPES
Nincs **fiók-összekötés**: ha egy vendég később Google-lel lép be, az anonim fiók swipe-jai/
matchei **elvesznek**, és árva anonim fiókok halmozódnak.
- **Javaslat:** `linkWithCredential` flow (vendég → Google ugyanazon uid-del); ütemezett takarítás
  a régóta inaktív anonim fiókokra és adataikra.

## 7. Félig definiált csoport-szemantika — KÖZEPES
A `partnerIds` N tagot enged, de a matchek **párosak**, a 80/20 keverés és az értesítések
egyetlen „párodat" feltételeznek; a szövegek is „párod" (egyes szám).
- **Javaslat:** döntsd el: *csak páros* vagy *valódi csoport*. Csoport esetén a match-modell
  (kit-kivel) és a UI-szövegek is igazítandók.

## 8. Mock-film és TMDB-id ütközés (csak dev) — ALACSONY
TMDB-kulcs nélkül a `MOCK_MOVIES` id-jei (`'1','2','3'`) **valós TMDB-id-kkel ütköznek**: az
ezekre létrejött swipe/match a részletek nézetben egészen más, valós filmre oldódik fel.
- **Javaslat:** namespace-eld a mock id-ket (pl. `mock-1`), vagy kulcs nélkül tiltsd a matchinget.

## 9. Adat-életciklus / GDPR — KÖZEPES
Emailt tárolunk; nincs **fiók-törlés / adat-export**.
- **Javaslat:** „Fiók törlése", ami kaszkádol (swipes, matches, fcmTokens, user doc); export funkció.

## 10. Offline korrektség — ALACSONY/KÖZEPES
A Firestore offline-perzisztencia nincs bekapcsolva; offline írás némán hibázik (a hibakezelést
javítottuk, de a UX nem igazán offline-képes).
- **Javaslat:** `persistentLocalCache` (új API) a valódi offline-PWA élményhez, a service worker
  mellé (az app-shell cache már megvan).

## 11. Megfigyelhetőség (observability) — ALACSONY
A hibák csak konzolba mennek; nincs hibakövetés/analitika. A `handleFirestoreError` gazdag
payloadot épít, de csak dob/loggol.
- **Javaslat:** kösd be egy szolgáltatásba (pl. Sentry); a swipe/match konverziókra esemény-analitika.

## 12. Tesztelés — KÖZEPES
A szabályokra már van emulátoros tesztcsomag (`npm run test:rules`). Az app-logikára (matching,
partnerIds-flow, undo, deck-dedup) nincs teszt.
- **Javaslat:** komponens/logika tesztek (Vitest + Testing Library), különösen a párosítás és a
  match-detektálás köré.

## 13. Bundle-méret — ALACSONY
A `firebase` chunk dominál (~477 kB). A vendor-szétválasztás és a messaging lazy-chunkja már
megvan.
- **Javaslat:** ha még kell: a képernyőket külön fájlokba szedve `React.lazy` route-szintű vágás;
  illetve ahol nem kell realtime, mérlegelhető a Firestore „lite". (A realtime matchek miatt a
  teljes SDK most indokolt.)

---

### Mi készült el ebből most
- Szigorított, **emulátorral tesztelt** Firestore-szabályok (privilege-escalation, match-hamisítás,
  PII-olvasás lezárva; reciprok párosítás biztonságosan).
- **FCM push** (Cloud Function + kliens token-kezelés + service worker) — csukott appnál is.
- **Bundle**: vendor-chunkok + messaging lazy-chunk; a kezdő app-kód 924 kB → ~61 kB.
- **a11y**: `lang="hu"`, aria-label-ek, dialógus-szerepek, fókusz-stílus, alt-szövegek.
- Halott `seedMovies` eltávolítva.

A fentiek (1–12) közül a **trust model (1)**, a **szerver-oldali match (2)** és a **TMDB-proxy (4)**
adná a legnagyobb minőségi ugrást — ezek nagyobb, külön körök.
