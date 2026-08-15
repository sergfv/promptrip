// Built-in sample itinerary for the Promptrip demo (a week in Vienna). This is
// just the example shown when nothing is loaded; users paste their own plan.
// isBase marks the home base (fuzzed, never the real address).
const TRIP = {
  title: 'A week in Vienna',
  subtitle: 'A sample itinerary',
  base: { lat: 48.196, lng: 16.349 },
  days: [
    {
      id: 'fri12', date: '2026-06-05', label: 'Fri 5', name: 'Fri 5 June — arrival', color: '#d64038',
      stops: [
        { name: 'Base (Mariahilf)', note: 'Your Mariahilf base. Airport transfer: Railjet to Hauptbahnhof then U-Bahn, but the weekly ticket needs an airport-zone supplement.', lat: 48.196, lng: 16.349, isBase: true },
        { name: 'Mariahilfer Strasse', note: 'Main shopping street, lively in the evening, on your doorstep.', lat: 48.1951061, lng: 16.3374628 },
        { name: 'Naschmarkt', note: 'Atmospheric market strip for a first-night wander.', lat: 48.1986178, lng: 16.3636494 },
        { name: 'Secession (illuminated)', note: 'Golden dome lit up at night. Interior and Beethoven Frieze on Tuesday.', lat: 48.2005106, lng: 16.3657857 },
      ],
    },
    {
      id: 'sat13', date: '2026-06-06', label: 'Sat 6', name: 'Sat 6 June — the monumental Ring', color: '#e07b18',
      stops: [
        { name: 'Cafe Sperl', note: 'Classic coffee house, opens 07:00. Breakfast before the crowds.', lat: 48.1998326, lng: 16.3611306 },
        { name: 'Karlskirche', note: 'Baroque masterpiece by Fischer von Erlach. Tip: an intimate candlelit concert here beats the big tourist ones.', lat: 48.1985626, lng: 16.3716999 },
        { name: 'Vienna State Opera', note: 'See it from the Ring; cheap standing-room tickets go on sale shortly before each performance.', lat: 48.2034306, lng: 16.3692034 },
        { name: 'Albertina (exterior)', note: 'World-class graphic-art collection (Dürer, Monet, Klimt). Admire the facade and Soravia Wing on your monumental walk.', lat: 48.2043, lng: 16.3686, wiki: 'Albertina' },
        { name: 'Austrian Parliament', note: 'The restored Greek-revival parliament on the Ring — pause for the Athena fountain out front.', lat: 48.2080757, lng: 16.3584468 },
        { name: 'Volksgarten', note: "The Ring's hidden rose garden with the Theseus Temple — a calm green pause between the grand facades.", lat: 48.2076, lng: 16.3614, wiki: 'Volksgarten, Vienna' },
        { name: "St. Stephen's Cathedral", note: 'Stephansplatz by night to close the day, the floodlit Gothic spire over the old town.', lat: 48.2084114, lng: 16.3734707 },
      ],
    },
    {
      id: 'sun14', date: '2026-06-07', label: 'Sun 7', name: 'Sun 7 June — Schönbrunn & the green west', color: '#5b8f1f',
      stops: [
        { name: 'Schönbrunn Palace', note: 'Open daily 08:30. Book a timed palace ticket, the gardens are free.', lat: 48.1858124, lng: 16.3127641 },
        { name: 'Gloriette', note: 'Walk up through the gardens for the panorama over palace and city.', lat: 48.1782686, lng: 16.3087421 },
        { name: 'Kirche am Steinhof', note: "Otto Wagner's gold-domed Jugendstil church on a hilltop in the west — a stunning, little-visited masterpiece (guided visits at weekends).", lat: 48.2127, lng: 16.2872, wiki: 'Church of St. Leopold (Vienna)' },
        { name: 'Naschmarkt (dinner)', note: 'Note: market stalls shut on Sundays, but sit-down restaurants stay open.', lat: 48.1986178, lng: 16.3636494 },
      ],
    },
    {
      id: 'mon15', date: '2026-06-08', label: 'Mon 8', name: 'Mon 8 June — Imperial Vienna', color: '#b5338f',
      stops: [
        { name: 'Sisi Museum, Hofburg', note: 'Imperial Apartments and the Sisi story. Open daily, timed tickets.', lat: 48.2076979, lng: 16.365938 },
        { name: 'Imperial Treasury', note: 'Crown jewels. Good on Monday, it is closed Tuesdays.', lat: 48.2067393, lng: 16.365773 },
        { name: 'National Library State Hall', note: 'The baroque Prunksaal — the hidden gem of the old centre. Open daily 9–18 in summer.', lat: 48.2063563, lng: 16.3662429, wiki: 'Austrian National Library' },
        { name: 'Cafe Central', note: 'Touristy but worth seeing once. Reach it via Graben and Kohlmarkt; expect a short queue.', lat: 48.2104274, lng: 16.3654339 },
        { name: 'Michaelerplatz', note: 'Close the day at dusk, strolling Graben, Kohlmarkt and Michaelerplatz.', lat: 48.2079, lng: 16.3668, wiki: 'Michaelerplatz' },
      ],
    },
    {
      id: 'tue16', date: '2026-06-09', label: 'Tue 9', name: 'Tue 9 June — Klimt & modernist Vienna', color: '#2e77c2',
      stops: [
        { name: 'Belvedere', note: "Klimt's The Kiss, plus Schiele and the Austrian masters. Go before 10:00 to beat the crush.", lat: 48.1914751, lng: 16.3809322 },
        { name: 'Secession (Beethoven Frieze)', note: 'Open Tuesdays. The Frieze in the basement is the highlight.', lat: 48.2005106, lng: 16.3657857 },
        { name: 'Naschmarkt', note: 'Fully open on a Tuesday, the day to browse the stalls.', lat: 48.1986178, lng: 16.3636494 },
        { name: 'Spittelberg', note: 'The favourite quarter — Biedermeier lanes and quiet courtyards. Perfect for a traditional Viennese dinner: Schnitzel, Tafelspitz, Apfelstrudel.', lat: 48.2041557, lng: 16.3571752 },
      ],
    },
    {
      id: 'wed17', date: '2026-06-10', label: 'Wed 10', name: 'Wed 10 June — secret Vienna', color: '#5f55c4',
      stops: [
        { name: 'Café Museum', note: 'Start the day at a historic coffee house — more characterful than many of the famous ones.', lat: 48.2009, lng: 16.3668, wiki: 'Café Museum' },
        { name: 'Otto Wagner Pavillon Karlsplatz (exterior only Wed)', note: 'Next door on Karlsplatz. Museum inside opens Fri to Sun only; admire the exterior on a Wednesday.', lat: 48.2002745, lng: 16.37032 },
        { name: 'Postsparkasse', note: "Otto Wagner's modernist bank, open Wed, free entry, cafe and small museum.", lat: 48.2099697, lng: 16.3812037 },
        { name: 'Danube Canal', note: 'Lunch by the water, then the alternative Vienna: street art, pop-up bars and a young crowd.', lat: 48.2114, lng: 16.3779, wiki: 'Donaukanal' },
        { name: 'Hundertwasserhaus', note: 'Colourful and organic, exterior viewing, still residential.', lat: 48.207337, lng: 16.394294 },
        { name: 'Das LOFT (farewell dinner)', note: 'Rooftop fine dining over the Danube Canal. Book ahead, opens 18:00.', lat: 48.2127326, lng: 16.379785 },
      ],
    },
    {
      id: 'thu18', date: '2026-06-11', label: 'Thu 11', name: 'Thu 11 June — return', color: '#be4870',
      stops: [
        { name: 'Mariahilfer Strasse (last stroll)', note: 'A final walk and coffee close to home.', lat: 48.1951061, lng: 16.3374628 },
        { name: 'Naschmarkt (last stroll)', note: 'A final wander through the market stalls before heading off.', lat: 48.1986178, lng: 16.3636494, wiki: 'Naschmarkt' },
        { name: 'Base (Mariahilf)', note: 'Departure day — head to the airport around midday.', lat: 48.196, lng: 16.349, isBase: true },
      ],
    },
  ],
};

// Per-stop image galleries — verified Wikimedia Commons 500px thumbnails,
// keyed by stop name. Tapping a thumb opens its Commons file page (licence).
const GALLERY = {
  "Mariahilfer Strasse": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Wien_07_Mariahilfer_Stra%C3%9Fe_Shopping_f.jpg/500px-Wien_07_Mariahilfer_Stra%C3%9Fe_Shopping_f.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Wien_06_Mariahilfer_Stra%C3%9Fe_001_b.jpg/500px-Wien_06_Mariahilfer_Stra%C3%9Fe_001_b.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Wien_06_Mariahilfer_Stra%C3%9Fe_035_b.jpg/500px-Wien_06_Mariahilfer_Stra%C3%9Fe_035_b.jpg",
  ],
  "Naschmarkt": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Wien_-_Naschmarkt.JPG/500px-Wien_-_Naschmarkt.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Naschmarkt_Wien_1900.jpg/500px-Naschmarkt_Wien_1900.jpg",
  ],
  "Secession (illuminated)": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Secession_2016%2C_Vienna.jpg/500px-Secession_2016%2C_Vienna.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Wiener_Secessionsgeb%C3%A4ude.jpg/500px-Wiener_Secessionsgeb%C3%A4ude.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Wien_-_Secessionsgeb%C3%A4ude.JPG/500px-Wien_-_Secessionsgeb%C3%A4ude.JPG",
  ],
  "Cafe Sperl": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Caf%C3%A9_Sperl%2C_front%2C_2006.JPG/500px-Caf%C3%A9_Sperl%2C_front%2C_2006.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Cafe_Sperl_3607.JPG/500px-Cafe_Sperl_3607.JPG",
  ],
  "Karlskirche": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Karlskirche_Abendsonne_1.jpg/500px-Karlskirche_Abendsonne_1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Karlskirche_-_Wien_006.jpg/500px-Karlskirche_-_Wien_006.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Iglesia_de_San_Carlos_Borromeo%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_49-51_HDR.jpg/500px-Iglesia_de_San_Carlos_Borromeo%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_49-51_HDR.jpg",
  ],
  "Vienna State Opera": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Wiener_Staatsoper_Front.jpg/500px-Wiener_Staatsoper_Front.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Staatsoper_Wien_DSC_5273w.jpg/500px-Staatsoper_Wien_DSC_5273w.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Wien_-_Staatsoper%2C_Zuschauerraum_mit_B%C3%BChne.JPG/500px-Wien_-_Staatsoper%2C_Zuschauerraum_mit_B%C3%BChne.JPG",
  ],
  "Austrian Parliament": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Wien_-_Parlamentsgeb%C3%A4ude.JPG/500px-Wien_-_Parlamentsgeb%C3%A4ude.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/WienParlament.jpg/500px-WienParlament.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Wien_-_Parlament%2C_Bundesversammlungssaal.JPG/500px-Wien_-_Parlament%2C_Bundesversammlungssaal.JPG",
  ],
  "St. Stephen's Cathedral": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Wien_-_Stephansdom_%281%29.JPG/500px-Wien_-_Stephansdom_%281%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Stephansdom_Wien_2.jpg/500px-Stephansdom_Wien_2.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Wien_-_Stephansdom%2C_Hauptschiff_Richtung_Hochalter_%281%29.JPG/500px-Wien_-_Stephansdom%2C_Hauptschiff_Richtung_Hochalter_%281%29.JPG",
  ],
  "Schönbrunn Palace": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Wien_-_Schloss_Sch%C3%B6nbrunn.JPG/500px-Wien_-_Schloss_Sch%C3%B6nbrunn.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Schloss_Sch%C3%B6nbrunn_Ehrenhof.jpg/500px-Schloss_Sch%C3%B6nbrunn_Ehrenhof.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Schoenbrunn_Palace_as_seen_from_Neptune_Fountain%2C_September_2016.jpg/500px-Schoenbrunn_Palace_as_seen_from_Neptune_Fountain%2C_September_2016.jpg",
  ],
  "Gloriette": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Gloriette_Sch%C3%B6nbrunn_Wien.jpg/500px-Gloriette_Sch%C3%B6nbrunn_Wien.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Gloriette_Sch%C3%B6nbrunn_Wien_%28Inschrift%29.jpg/500px-Gloriette_Sch%C3%B6nbrunn_Wien_%28Inschrift%29.jpg",
  ],
  "Sisi Museum, Hofburg": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Wien_-_Neue_Hofburg.JPG/500px-Wien_-_Neue_Hofburg.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Michaelertrakt%2C_Hofburg%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_08-10_PAN.jpg/500px-Michaelertrakt%2C_Hofburg%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_08-10_PAN.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Amalienburg%2C_Hofburg%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_21.jpg/500px-Amalienburg%2C_Hofburg%2C_Viena%2C_Austria%2C_2020-01-31%2C_DD_21.jpg",
  ],
  "Imperial Treasury": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Imperial_Crown_Orb_and_Sceptre_of_Austria_%28Imperial_Treasury%29.jpg/500px-Imperial_Crown_Orb_and_Sceptre_of_Austria_%28Imperial_Treasury%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Holy_Roman_Empire_Crown_%28Imperial_Treasury%29.jpg/500px-Holy_Roman_Empire_Crown_%28Imperial_Treasury%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Achatschale_1.JPG/500px-Achatschale_1.JPG",
  ],
  "National Library State Hall": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/State_Hall_of_the_Austrian_National_Library_NightFall404_1.jpg/500px-State_Hall_of_the_Austrian_National_Library_NightFall404_1.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Allegory_of_war_and_Law_-_Prunksaal_-_Austrian_National_Library.jpg/500px-Allegory_of_war_and_Law_-_Prunksaal_-_Austrian_National_Library.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Wien%2C_Treppe_zum_Prunksaal_der_%C3%96sterreichischen_Nationalbibliothek_%2827870050899%29.jpg/500px-Wien%2C_Treppe_zum_Prunksaal_der_%C3%96sterreichischen_Nationalbibliothek_%2827870050899%29.jpg",
  ],
  "Cafe Central": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Cafe_Central%2C_Vienna.jpg/500px-Cafe_Central%2C_Vienna.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Vault_Caf%C3%A9_Central_Vienna_Wien.jpg/500px-Vault_Caf%C3%A9_Central_Vienna_Wien.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cafe_Central%2C_Vienna%2C_Austria_-_Sarah_Stierch.jpg/500px-Cafe_Central%2C_Vienna%2C_Austria_-_Sarah_Stierch.jpg",
  ],
  "Belvedere": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Palacio_Belvedere%2C_Viena%2C_Austria%2C_2020-02-01%2C_DD_93-95_HDR.jpg/500px-Palacio_Belvedere%2C_Viena%2C_Austria%2C_2020-02-01%2C_DD_93-95_HDR.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Belvedere%2C_Vienna.jpg/500px-Belvedere%2C_Vienna.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Schloss_Belvedere_Sept_2020_1.jpg/500px-Schloss_Belvedere_Sept_2020_1.jpg",
  ],
  "Secession (Beethoven Frieze)": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Klimt_-_Beethovenfries_-_Mittelwand.jpg/500px-Klimt_-_Beethovenfries_-_Mittelwand.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Klimt_-_Beethovenfries_-_Rechte_Seitenwand1.jpg/500px-Klimt_-_Beethovenfries_-_Rechte_Seitenwand1.jpg",
  ],
  "Spittelberg": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Wien_Spittelberg_Gasse_11_Fassade.jpg/500px-Wien_Spittelberg_Gasse_11_Fassade.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Wien_Spittelberg_Gasse_5_Portal.jpg/500px-Wien_Spittelberg_Gasse_5_Portal.jpg",
  ],
  "Otto Wagner Pavillon Karlsplatz (exterior only Wed)": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Otto_Wagner_Pavillon_-_Karlsplatz.jpg/500px-Otto_Wagner_Pavillon_-_Karlsplatz.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Stadtbahnstation_Karlsplatz_2024_01.jpg/500px-Stadtbahnstation_Karlsplatz_2024_01.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Wien_-_Karlsplatz%2C_Otto-Wagner-Pavillon_%281%29.JPG/500px-Wien_-_Karlsplatz%2C_Otto-Wagner-Pavillon_%281%29.JPG",
  ],
  "Postsparkasse": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/P.S.K._Vienna_August_2006_030.jpg/500px-P.S.K._Vienna_August_2006_030.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Otto_Wagner_Postsparkasse_Hauptfront.jpg/500px-Otto_Wagner_Postsparkasse_Hauptfront.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Postsparkasse_Otto_Wagner_Lichthof.jpg/500px-Postsparkasse_Otto_Wagner_Lichthof.jpg",
  ],
  "Hundertwasserhaus": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Wien_-_Hundertwasserhaus_%2803%29.JPG/500px-Wien_-_Hundertwasserhaus_%2803%29.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Hundertwasserhaus_facade.jpg/500px-Hundertwasserhaus_facade.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Wien_-_Hundertwasserhaus_%2802%29.JPG/500px-Wien_-_Hundertwasserhaus_%2802%29.JPG",
  ],
  "Mariahilfer Strasse (last stroll)": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Wien_07_Mariahilfer_Stra%C3%9Fe_Shopping_f.jpg/500px-Wien_07_Mariahilfer_Stra%C3%9Fe_Shopping_f.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Wien_06_Mariahilfer_Stra%C3%9Fe_001_b.jpg/500px-Wien_06_Mariahilfer_Stra%C3%9Fe_001_b.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Wien_06_Mariahilfer_Stra%C3%9Fe_035_b.jpg/500px-Wien_06_Mariahilfer_Stra%C3%9Fe_035_b.jpg",
  ],
  "Naschmarkt (dinner)": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Wien_-_Naschmarkt.JPG/500px-Wien_-_Naschmarkt.JPG",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Naschmarkt_Wien_1900.jpg/500px-Naschmarkt_Wien_1900.jpg",
  ],
};
