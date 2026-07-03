# 🍿 CinePair — Találd meg a pároddal a tökéletes filmet!

<div align="center">
  <img src="public/icon-512.png" width="128" alt="CinePair Logo" />
  <p><i>CinePair 2.0 — Prémium moziélmény pároknak és társaságoknak, egyenesen a zsebedben.</i></p>
</div>

---

A **CinePair** egy modern, reszponzív PWA (Progressive Web App) alkalmazás, amivel véget vethetsz a "mit nézzünk ma?" vitáknak. Húzzátok el a filmeket, és ha mindenkinek tetszik valami a gyűjtőben, bumm: **MATCH!**

## ✨ Főbb funkciók

- **Swipe & Match:** Tinder-szerű filmválasztó interakció.
- **Gyűjtők (csoportok):** Külön közös listák a különböző társaságoknak — egy a *Szerelmemmel*, egy a *Családdal*, egy a *Haverokkal*. Válts a gyűjtők között, és a találatok azonnal újraszámolódnak a már elhúzott filmekből, nem kell mindent újraswipe-olni.
- **Valósidejű szinkronizáció:** Azonnali visszajelzés, ha a többiek is kedvelnek egy filmet.
- **Push Értesítések:** Találat esetén azonnali értesítés a telefonodra.
- **PWA támogatás:** Telepíthető alkalmazásként, natív érzéssel (nincs böngészőkeret).
- **Részletes filminfók:** Trailer nézés (YouTube), műfajok, IMDb értékelések és leírások.
- **Okos szűrők:** Megjelenési év és műfaj szerinti keresés (TMDB adatok alapján).
- **Hungarizált felület:** Teljesen magyar nyelvű, letisztult UI.

## 🗂️ Hogyan működnek a gyűjtők

Egy **gyűjtő** egy elnevezett csoport, amit egy adott társasággal használsz. A lájkjaid **globálisak** (egyszer húzol egy filmet, és minden gyűjtőben számít), a **match viszont származtatott**: mindig annak a gyűjtőnek az *összes* tagja által kedvelt filmek metszete. Ezért:

- Egy film csak akkor jelenik meg találatként, ha a gyűjtő **minden** tagja lájkolta.
- Gyűjtőt váltva a közös lista **azonnal** újraszámolódik a már elhúzott filmekből.
- Új tag csatlakozásakor a lista szűkül (csak azok a filmek maradnak, amiket ő is kedvelt); ha valaki kilép, az ő lájkjai kiesnek a szűrésből.

Mivel a match kliensoldalon számított metszet, nincs külön „match dokumentum" — a hozzáférést a Firestore-szabályok és a tagok kölcsönös kapcsolatai adják.

## 🚀 Technológiai stack

- **Frontend:** React + Vite + TailwindCSS
- **Adatbázis & Auth:** Firebase (Firestore & Google Auth)
- **Animációk:** Framer Motion (3D kártyaeffektel)
- **API:** TMDB (The Movie Database) API
- **Ikonok:** Lucide React

## 🛠️ Helyi fejlesztés

**Előfeltételek:** Node.js (v18+)

1.  **Telepítés:**
    ```bash
    npm install
    ```
2.  **Környezeti változók:**
    Másold le a mintát és töltsd ki (a Firebase web-config a kódban van drótozva, így helyi
    fejlesztéshez elég a TMDB kulcs; a többi opcionális, lásd a fájl kommentjeit):
    ```bash
    cp .env.example .env
    ```
    Minimum:
    ```env
    VITE_TMDB_API_KEY=a_te_tmdb_api_kulcsod
    ```
3.  **Futtatás:**
    ```bash
    npm run dev
    ```

## 🔔 Push értesítések (FCM) & Cloud Functions

A csukott appnál is megjelenő push-hoz Firebase Cloud Messaging + egy Cloud Function kell:

1. **VAPID kulcs:** Firebase Console → Project settings → Cloud Messaging → *Web Push
   certificates* → másold a kulcspár publikus kulcsát a `.env`-be:
   `VITE_FIREBASE_VAPID_KEY="..."`. Enélkül a push regisztráció csendben kimarad.
2. **Function deploy** (Blaze csomag szükséges):
   ```bash
   cd functions && npm install && cd ..
   firebase functions:secrets:set TMDB_API_KEY   # opcionális, szép filmcímekhez
   firebase deploy --only functions
   ```
   A functions három triggert tartalmaz: `onMatchCreated` (push a partnernek), `onSwipeCreated`
   (szerver-oldali match-létrehozás), és `tmdb` (TMDB-proxy, hogy a kulcs ne a bundle-ben legyen).
3. A kliens a Profil → *Értesítések* gombnál kér engedélyt és regisztrálja a token-t.
4. **Opcionális – TMDB-proxy:** deploy után állítsd a `.env`-ben a `VITE_TMDB_PROXY_URL`-t a `tmdb`
   függvény URL-jére, a `VITE_TMDB_API_KEY`-t pedig hagyd üresen, hogy a kulcs ne kerüljön a kliensbe.

## 🔒 Firestore szabályok tesztelése

A biztonsági szabályokra emulátoros tesztcsomag tartozik (Java szükséges):

```bash
npm run test:rules
```

## 🚀 Deploy

- **Frontend:** a `main`-re pusholva GitHub Pages (lásd `.github/workflows/deploy.yml`).
- **Szabályok:** `firebase deploy --only firestore:rules` (a `.firebaserc` a `cinepair-31543`
  projektre mutat). Az admin-jogot **custom claim** (`admin: true`) adja, nem a user-dokumentum.

## 📱 Használat

1. Lépj be a Google fiókoddal.
2. A **Profil** menüben hozz létre egy **gyűjtőt** (pl. *Szerelmem*, *Család*, *Haverok*).
3. Küldj **meghívót** az adott gyűjtőbe a többieknek (a User ID-jükkel vagy a közös QR-kóddal).
4. A meghívott a saját Profiljában a **Bejövő meghívók** alatt **Elfogadja** — csak ekkor jön létre a
   kapcsolat és a tagság (elfogadásig senki nem látja a másik lájkjait).
5. Válaszd ki az **aktív gyűjtőt**, és kezdjetek el swipe-olni a főoldalon! A közös találatok a
   **Watchlist** fülön jelennek meg, gyűjtőnként.

---

*© 2026 CinePair — Made with ❤️ for couples & crews.*
