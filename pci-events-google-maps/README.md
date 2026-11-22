# PCI Events Radar — interactive prototype

This is a working UI prototype for the Pakistan Creator Index event map. The UI is ready; real Google Maps tiles need **your own Maps JavaScript API browser key**. There are **6 fictional placeholder events**, 3 cities (Karachi, Lahore, Islamabad), and 6 top categories (including All Events).

## Launch locally on Windows

From the `pci-events-google-maps` folder:

```cmd
py -m http.server 8080
```

Open http://localhost:8080 in a browser.

Without a Google key, the page displays a clearly marked visual design preview based on your supplied neon Pakistan image. All filtering, animations and hover/tap event cards work in this preview.

## Use an actual Google map

1. Open the [Google Maps JavaScript API key guide](https://developers.google.com/maps/documentation/javascript/get-api-key).
2. Create a browser key and enable **Maps JavaScript API**. Google normally requires billing setup; an eligible Maps Demo Key may be usable for prototyping.
3. Restrict the browser key to allowed referrers (for example `http://localhost:8080/*` while testing, plus your PCI production domain) and API restrictions (Maps JavaScript API).
4. Either click **CONNECT GOOGLE MAPS** in the prototype and paste the browser key for the current page session, or put your key into `config.js` as the value of `window.PCI_GOOGLE_MAPS_API_KEY`.
5. The actual live Google Maps JavaScript map loads with styled tiles, pan/zoom support, and pin overlays tied to latitude/longitude.

Do not put a server/private key in frontend code. Browser keys are visible to page visitors, so HTTP referrer and API restrictions are essential. Google Maps charges the site operator for usage beyond applicable free usage caps. PCI visitors need not pay anything.

## Functional UI

- Three city filters, including an All Cities choice
- Six category tabs: All Events, Sports, Arts & Culture, Expos & Business, Conferences & Workshops, Community & Festivals
- Crystal-red blinking dot, neon-blue event title only by default
- Hover, focus, or tap event to reveal date, city, venue, free/paid/TBA admission and optional price
- Search box, zoom, location reset and responsive layout
- Live Google Maps via Maps JavaScript API and correctly georeferenced `OverlayView` pins

## Data note

**ALL event records are fictional placeholders.** Real venue names and approximate coordinates appear solely to demonstrate functionality. No actual public upcoming event is claimed. Dates and prices are invented for the prototype. Replace `DEMO_EVENTS` with records from verified official/organizer APIs, public-calendar sources with appropriate reuse rights, or direct authorized organizer submissions; include verification timestamps and source URLs in production.

The user-provided artwork in `assets/pakistan-network-reference.jpg` is only the **offline visual preview**, never passed off as the actual Google basemap.

## Files

- `index.html` layout
- `styles.css` UI styles and CSS crystal animations
- `app.js` filters, UI state, Google Maps loader and custom marker overlays
- `config.js` optional API-key configuration
- `assets/pakistan-network-reference.jpg` provided reference image
