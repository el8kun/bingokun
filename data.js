// Bingo Kun data
// Structure inspirée du système : catégories + tags joueurs.
// Les catégories simples demandent au moins 1 tag.
// Les catégories combo utilisent match: "all" et demandent tous les tags.

export const TEAMS = {
  "om": {
    "short": "OM"
  },
  "psg": {
    "short": "PSG"
  },
  "lyon": {
    "short": "OL"
  },
  "monaco": {
    "short": "ASM"
  },
  "barca": {
    "short": "FCB"
  },
  "real": {
    "short": "RMA"
  },
  "milan": {
    "short": "ACM"
  },
  "inter": {
    "short": "INT"
  },
  "juve": {
    "short": "JUV"
  },
  "manutd": {
    "short": "MU"
  },
  "arsenal": {
    "short": "ARS"
  },
  "chelsea": {
    "short": "CHE"
  },
  "liverpool": {
    "short": "LIV"
  },
  "bayern": {
    "short": "BAY"
  },
  "france": {
    "short": "FRA"
  },
  "brazil": {
    "short": "BRE"
  },
  "argentina": {
    "short": "ARG"
  },
  "spain": {
    "short": "ESP"
  },
  "italy": {
    "short": "ITA"
  },
  "germany": {
    "short": "ALL"
  },
  "netherlands": {
    "short": "PB"
  },
  "portugal": {
    "short": "POR"
  },
  "africa": {
    "short": "AFR"
  }
};

export const CATEGORIES = [
  {
    "id": "om",
    "kind": "club",
    "kicker": "A joué à",
    "title": "l’OM",
    "tags": [
      "om"
    ],
    "logo": "om",
    "weight": 5
  },
  {
    "id": "psg",
    "kind": "club",
    "kicker": "A joué au",
    "title": "PSG",
    "tags": [
      "psg"
    ],
    "logo": "psg",
    "weight": 5
  },
  {
    "id": "lyon",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Lyon",
    "tags": [
      "lyon"
    ],
    "logo": "lyon",
    "weight": 4
  },
  {
    "id": "monaco",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Monaco",
    "tags": [
      "monaco"
    ],
    "logo": "monaco",
    "weight": 4
  },
  {
    "id": "barca",
    "kind": "club",
    "kicker": "A joué au",
    "title": "Barça",
    "tags": [
      "barca"
    ],
    "logo": "barca",
    "weight": 5
  },
  {
    "id": "real",
    "kind": "club",
    "kicker": "A joué au",
    "title": "Real Madrid",
    "tags": [
      "real"
    ],
    "logo": "real",
    "weight": 5
  },
  {
    "id": "milan",
    "kind": "club",
    "kicker": "A joué à",
    "title": "l’AC Milan",
    "tags": [
      "milan"
    ],
    "logo": "milan",
    "weight": 4
  },
  {
    "id": "inter",
    "kind": "club",
    "kicker": "A joué à",
    "title": "l’Inter",
    "tags": [
      "inter"
    ],
    "logo": "inter",
    "weight": 4
  },
  {
    "id": "juve",
    "kind": "club",
    "kicker": "A joué à la",
    "title": "Juventus",
    "tags": [
      "juve"
    ],
    "logo": "juve",
    "weight": 4
  },
  {
    "id": "manutd",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Manchester United",
    "tags": [
      "manutd"
    ],
    "logo": "manutd",
    "weight": 4
  },
  {
    "id": "arsenal",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Arsenal",
    "tags": [
      "arsenal"
    ],
    "logo": "arsenal",
    "weight": 4
  },
  {
    "id": "chelsea",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Chelsea",
    "tags": [
      "chelsea"
    ],
    "logo": "chelsea",
    "weight": 4
  },
  {
    "id": "liverpool",
    "kind": "club",
    "kicker": "A joué à",
    "title": "Liverpool",
    "tags": [
      "liverpool"
    ],
    "logo": "liverpool",
    "weight": 4
  },
  {
    "id": "bayern",
    "kind": "club",
    "kicker": "A joué au",
    "title": "Bayern",
    "tags": [
      "bayern"
    ],
    "logo": "bayern",
    "weight": 4
  },
  {
    "id": "ligue1",
    "kind": "league",
    "kicker": "A joué en",
    "title": "Ligue 1",
    "tags": [
      "ligue1"
    ],
    "logo": "france",
    "weight": 4
  },
  {
    "id": "premierleague",
    "kind": "league",
    "kicker": "A joué en",
    "title": "Premier League",
    "tags": [
      "premierleague"
    ],
    "icon": "PL",
    "weight": 4
  },
  {
    "id": "laliga",
    "kind": "league",
    "kicker": "A joué en",
    "title": "Liga",
    "tags": [
      "laliga"
    ],
    "logo": "spain",
    "weight": 4
  },
  {
    "id": "seriea",
    "kind": "league",
    "kicker": "A joué en",
    "title": "Serie A",
    "tags": [
      "seriea"
    ],
    "logo": "italy",
    "weight": 4
  },
  {
    "id": "bundesliga",
    "kind": "league",
    "kicker": "A joué en",
    "title": "Bundesliga",
    "tags": [
      "bundesliga"
    ],
    "logo": "germany",
    "weight": 4
  },
  {
    "id": "france",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "France",
    "tags": [
      "france"
    ],
    "logo": "france",
    "weight": 4
  },
  {
    "id": "brazil",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Brésil",
    "tags": [
      "brazil"
    ],
    "logo": "brazil",
    "weight": 4
  },
  {
    "id": "argentina",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Argentine",
    "tags": [
      "argentina"
    ],
    "logo": "argentina",
    "weight": 4
  },
  {
    "id": "spain",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Espagne",
    "tags": [
      "spain"
    ],
    "logo": "spain",
    "weight": 4
  },
  {
    "id": "italy",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Italie",
    "tags": [
      "italy"
    ],
    "logo": "italy",
    "weight": 4
  },
  {
    "id": "germany",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Allemagne",
    "tags": [
      "germany"
    ],
    "logo": "germany",
    "weight": 4
  },
  {
    "id": "netherlands",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Pays-Bas",
    "tags": [
      "netherlands"
    ],
    "logo": "netherlands",
    "weight": 3
  },
  {
    "id": "portugal",
    "kind": "nation",
    "kicker": "Nationalité",
    "title": "Portugal",
    "tags": [
      "portugal"
    ],
    "logo": "portugal",
    "weight": 3
  },
  {
    "id": "africa",
    "kind": "continent",
    "kicker": "Origine",
    "title": "Afrique",
    "tags": [
      "africa"
    ],
    "logo": "africa",
    "weight": 4
  },
  {
    "id": "uclwinner",
    "kind": "trophy",
    "kicker": "A gagné",
    "title": "la LDC",
    "tags": [
      "uclwinner"
    ],
    "icon": "LDC",
    "weight": 4
  },
  {
    "id": "worldcupwinner",
    "kind": "trophy",
    "kicker": "Champion",
    "title": "du monde",
    "tags": [
      "worldcupwinner"
    ],
    "icon": "CDM",
    "weight": 4
  },
  {
    "id": "eurowinner",
    "kind": "trophy",
    "kicker": "A gagné",
    "title": "l’Euro",
    "tags": [
      "eurowinner"
    ],
    "icon": "EURO",
    "weight": 3
  },
  {
    "id": "ballondor",
    "kind": "award",
    "kicker": "A gagné le",
    "title": "Ballon d’Or",
    "tags": [
      "ballondor"
    ],
    "icon": "BO",
    "weight": 3
  },
  {
    "id": "striker",
    "kind": "position",
    "kicker": "Poste",
    "title": "Attaquant",
    "tags": [
      "striker"
    ],
    "icon": "9",
    "weight": 2
  },
  {
    "id": "midfielder",
    "kind": "position",
    "kicker": "Poste",
    "title": "Milieu",
    "tags": [
      "midfielder"
    ],
    "icon": "8",
    "weight": 2
  },
  {
    "id": "defender",
    "kind": "position",
    "kicker": "Poste",
    "title": "Défenseur",
    "tags": [
      "defender"
    ],
    "icon": "DEF",
    "weight": 2
  },
  {
    "id": "goalkeeper",
    "kind": "position",
    "kicker": "Poste",
    "title": "Gardien",
    "tags": [
      "goalkeeper"
    ],
    "icon": "GK",
    "weight": 2
  },
  {
    "id": "hundredgoals",
    "kind": "special",
    "kicker": "A marqué",
    "title": "+100 buts",
    "tags": [
      "hundredgoals"
    ],
    "icon": "100+",
    "weight": 2
  },
  {
    "id": "leftfoot",
    "kind": "special",
    "kicker": "Pied fort",
    "title": "Gaucher",
    "tags": [
      "leftfoot"
    ],
    "icon": "G",
    "weight": 2
  },
  {
    "id": "retired",
    "kind": "status",
    "kicker": "Statut",
    "title": "Retraité",
    "tags": [
      "retired"
    ],
    "icon": "RET",
    "weight": 1
  },
  {
    "id": "active",
    "kind": "status",
    "kicker": "Statut",
    "title": "En activité",
    "tags": [
      "active"
    ],
    "icon": "ACT",
    "weight": 1
  },
  {
    "id": "combo_france_real",
    "kind": "combo",
    "kicker": "Combo",
    "title": "France + Real",
    "tags": [
      "france",
      "real"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_france_ligue1",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Français + Ligue 1",
    "tags": [
      "france",
      "ligue1"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_france_pl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Français + Premier League",
    "tags": [
      "france",
      "premierleague"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_brazil_barca",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Brésil + Barça",
    "tags": [
      "brazil",
      "barca"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_brazil_psg",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Brésil + PSG",
    "tags": [
      "brazil",
      "psg"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_brazil_milan",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Brésil + Milan",
    "tags": [
      "brazil",
      "milan"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_argentina_psg",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Argentine + PSG",
    "tags": [
      "argentina",
      "psg"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_argentina_seriea",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Argentin + Serie A",
    "tags": [
      "argentina",
      "seriea"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_spain_barca",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Espagne + Barça",
    "tags": [
      "spain",
      "barca"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_italy_seriea",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Italien + Serie A",
    "tags": [
      "italy",
      "seriea"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_africa_pl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Afrique + Premier League",
    "tags": [
      "africa",
      "premierleague"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_africa_ligue1",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Afrique + Ligue 1",
    "tags": [
      "africa",
      "ligue1"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_psg_ligue1",
    "kind": "combo",
    "kicker": "Combo",
    "title": "PSG + Ligue 1",
    "tags": [
      "psg",
      "ligue1"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_om_ligue1",
    "kind": "combo",
    "kicker": "Combo",
    "title": "OM + Ligue 1",
    "tags": [
      "om",
      "ligue1"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_real_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Real + LDC",
    "tags": [
      "real",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_barca_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Barça + LDC",
    "tags": [
      "barca",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_milan_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Milan + LDC",
    "tags": [
      "milan",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_chelsea_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Chelsea + LDC",
    "tags": [
      "chelsea",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_liverpool_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Liverpool + LDC",
    "tags": [
      "liverpool",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_bayern_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Bayern + LDC",
    "tags": [
      "bayern",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_ballondor_laliga",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Ballon d’Or + Liga",
    "tags": [
      "ballondor",
      "laliga"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_worldcup_ligue1",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Champion du monde + Ligue 1",
    "tags": [
      "worldcupwinner",
      "ligue1"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_worldcup_laliga",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Champion du monde + Liga",
    "tags": [
      "worldcupwinner",
      "laliga"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_ucl_pl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "LDC + Premier League",
    "tags": [
      "uclwinner",
      "premierleague"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_ucl_seriea",
    "kind": "combo",
    "kicker": "Combo",
    "title": "LDC + Serie A",
    "tags": [
      "uclwinner",
      "seriea"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_leftfoot_striker",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Gaucher + Attaquant",
    "tags": [
      "leftfoot",
      "striker"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_keeper_worldcup",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Gardien + Champion du monde",
    "tags": [
      "goalkeeper",
      "worldcupwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_defender_ucl",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Défenseur + LDC",
    "tags": [
      "defender",
      "uclwinner"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  },
  {
    "id": "combo_midfielder_ballondor",
    "kind": "combo",
    "kicker": "Combo",
    "title": "Milieu + Ballon d’Or",
    "tags": [
      "midfielder",
      "ballondor"
    ],
    "match": "all",
    "icon": "2X",
    "weight": 3
  }
];

export const PLAYERS = [
  {
    "id": "zidane",
    "name": "Zinédine Zidane",
    "logos": [
      "france",
      "real",
      "juve"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "eurowinner",
      "ballondor",
      "laliga",
      "seriea",
      "real",
      "juve",
      "midfielder",
      "retired"
    ]
  },
  {
    "id": "ronaldo9",
    "name": "Ronaldo Nazário",
    "logos": [
      "brazil",
      "barca",
      "real",
      "inter",
      "milan"
    ],
    "tags": [
      "brazil",
      "worldcupwinner",
      "ballondor",
      "barca",
      "real",
      "inter",
      "milan",
      "laliga",
      "seriea",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "ronaldinho",
    "name": "Ronaldinho",
    "logos": [
      "brazil",
      "psg",
      "barca",
      "milan"
    ],
    "tags": [
      "brazil",
      "worldcupwinner",
      "ballondor",
      "barca",
      "milan",
      "laliga",
      "seriea",
      "ligue1",
      "psg",
      "midfielder",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "messi",
    "name": "Lionel Messi",
    "logos": [
      "argentina",
      "barca",
      "psg"
    ],
    "tags": [
      "argentina",
      "worldcupwinner",
      "ballondor",
      "barca",
      "psg",
      "laliga",
      "ligue1",
      "striker",
      "active",
      "leftfoot",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "cristiano",
    "name": "Cristiano Ronaldo",
    "logos": [
      "portugal",
      "manutd",
      "real",
      "juve"
    ],
    "tags": [
      "portugal",
      "ballondor",
      "manutd",
      "real",
      "juve",
      "premierleague",
      "laliga",
      "seriea",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "benzema",
    "name": "Karim Benzema",
    "logos": [
      "france",
      "lyon",
      "real"
    ],
    "tags": [
      "france",
      "lyon",
      "ligue1",
      "real",
      "laliga",
      "ballondor",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "mbappe",
    "name": "Kylian Mbappé",
    "logos": [
      "france",
      "monaco",
      "psg",
      "real"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "monaco",
      "psg",
      "real",
      "ligue1",
      "laliga",
      "striker",
      "active",
      "hundredgoals"
    ]
  },
  {
    "id": "neymar",
    "name": "Neymar",
    "logos": [
      "brazil",
      "barca",
      "psg"
    ],
    "tags": [
      "brazil",
      "barca",
      "psg",
      "laliga",
      "ligue1",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "henry",
    "name": "Thierry Henry",
    "logos": [
      "france",
      "monaco",
      "arsenal",
      "barca"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "eurowinner",
      "monaco",
      "arsenal",
      "barca",
      "ligue1",
      "premierleague",
      "laliga",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "drogba",
    "name": "Didier Drogba",
    "logos": [
      "africa",
      "om",
      "chelsea"
    ],
    "tags": [
      "africa",
      "om",
      "ligue1",
      "chelsea",
      "premierleague",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "ibrahimovic",
    "name": "Zlatan Ibrahimović",
    "logos": [
      "psg",
      "milan",
      "inter",
      "juve",
      "barca"
    ],
    "tags": [
      "psg",
      "milan",
      "inter",
      "juve",
      "barca",
      "ligue1",
      "seriea",
      "laliga",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "cavani",
    "name": "Edinson Cavani",
    "logos": [
      "psg",
      "manutd"
    ],
    "tags": [
      "psg",
      "manutd",
      "ligue1",
      "seriea",
      "premierleague",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "papin",
    "name": "Jean-Pierre Papin",
    "logos": [
      "france",
      "om",
      "milan",
      "bayern"
    ],
    "tags": [
      "france",
      "om",
      "milan",
      "bayern",
      "ligue1",
      "seriea",
      "bundesliga",
      "ballondor",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "ribery",
    "name": "Franck Ribéry",
    "logos": [
      "france",
      "om",
      "bayern"
    ],
    "tags": [
      "france",
      "om",
      "bayern",
      "ligue1",
      "bundesliga",
      "seriea",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "nasri",
    "name": "Samir Nasri",
    "logos": [
      "france",
      "om",
      "arsenal"
    ],
    "tags": [
      "france",
      "om",
      "arsenal",
      "ligue1",
      "premierleague",
      "midfielder",
      "retired"
    ]
  },
  {
    "id": "payet",
    "name": "Dimitri Payet",
    "logos": [
      "france",
      "om"
    ],
    "tags": [
      "france",
      "om",
      "ligue1",
      "premierleague",
      "midfielder",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "benarfa",
    "name": "Hatem Ben Arfa",
    "logos": [
      "france",
      "lyon",
      "om",
      "psg"
    ],
    "tags": [
      "france",
      "lyon",
      "om",
      "psg",
      "ligue1",
      "premierleague",
      "midfielder",
      "retired"
    ]
  },
  {
    "id": "valbuena",
    "name": "Mathieu Valbuena",
    "logos": [
      "france",
      "om",
      "lyon"
    ],
    "tags": [
      "france",
      "om",
      "lyon",
      "ligue1",
      "midfielder",
      "retired"
    ]
  },
  {
    "id": "barthez",
    "name": "Fabien Barthez",
    "logos": [
      "france",
      "om",
      "monaco",
      "manutd"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "eurowinner",
      "om",
      "monaco",
      "manutd",
      "ligue1",
      "premierleague",
      "goalkeeper",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "lloris",
    "name": "Hugo Lloris",
    "logos": [
      "france",
      "lyon"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "lyon",
      "ligue1",
      "premierleague",
      "goalkeeper",
      "active"
    ]
  },
  {
    "id": "mandanda",
    "name": "Steve Mandanda",
    "logos": [
      "france",
      "om"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "om",
      "ligue1",
      "premierleague",
      "goalkeeper",
      "active"
    ]
  },
  {
    "id": "buffon",
    "name": "Gianluigi Buffon",
    "logos": [
      "italy",
      "juve",
      "psg"
    ],
    "tags": [
      "italy",
      "worldcupwinner",
      "juve",
      "psg",
      "seriea",
      "ligue1",
      "goalkeeper",
      "retired"
    ]
  },
  {
    "id": "casillas",
    "name": "Iker Casillas",
    "logos": [
      "spain",
      "real"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "real",
      "laliga",
      "goalkeeper",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "ramos",
    "name": "Sergio Ramos",
    "logos": [
      "spain",
      "real",
      "psg"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "real",
      "psg",
      "laliga",
      "ligue1",
      "defender",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "puyol",
    "name": "Carles Puyol",
    "logos": [
      "spain",
      "barca"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "barca",
      "laliga",
      "defender",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "pique",
    "name": "Gerard Piqué",
    "logos": [
      "spain",
      "barca",
      "manutd"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "barca",
      "manutd",
      "laliga",
      "premierleague",
      "defender",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "maldini",
    "name": "Paolo Maldini",
    "logos": [
      "italy",
      "milan"
    ],
    "tags": [
      "italy",
      "milan",
      "seriea",
      "defender",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "cannavaro",
    "name": "Fabio Cannavaro",
    "logos": [
      "italy",
      "real",
      "juve",
      "inter"
    ],
    "tags": [
      "italy",
      "worldcupwinner",
      "ballondor",
      "real",
      "juve",
      "inter",
      "laliga",
      "seriea",
      "defender",
      "retired"
    ]
  },
  {
    "id": "vandijk",
    "name": "Virgil van Dijk",
    "logos": [
      "netherlands",
      "liverpool"
    ],
    "tags": [
      "netherlands",
      "liverpool",
      "premierleague",
      "defender",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "kaka",
    "name": "Kaká",
    "logos": [
      "brazil",
      "milan",
      "real"
    ],
    "tags": [
      "brazil",
      "worldcupwinner",
      "ballondor",
      "milan",
      "real",
      "seriea",
      "laliga",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "modric",
    "name": "Luka Modrić",
    "logos": [
      "real"
    ],
    "tags": [
      "ballondor",
      "real",
      "laliga",
      "premierleague",
      "midfielder",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "xavi",
    "name": "Xavi",
    "logos": [
      "spain",
      "barca"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "barca",
      "laliga",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "iniesta",
    "name": "Andrés Iniesta",
    "logos": [
      "spain",
      "barca"
    ],
    "tags": [
      "spain",
      "worldcupwinner",
      "eurowinner",
      "barca",
      "laliga",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "pirlo",
    "name": "Andrea Pirlo",
    "logos": [
      "italy",
      "milan",
      "juve",
      "inter"
    ],
    "tags": [
      "italy",
      "worldcupwinner",
      "milan",
      "juve",
      "inter",
      "seriea",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "seedorf",
    "name": "Clarence Seedorf",
    "logos": [
      "netherlands",
      "real",
      "milan",
      "inter"
    ],
    "tags": [
      "netherlands",
      "real",
      "milan",
      "inter",
      "laliga",
      "seriea",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "lampard",
    "name": "Frank Lampard",
    "logos": [
      "chelsea"
    ],
    "tags": [
      "chelsea",
      "premierleague",
      "midfielder",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "gerrard",
    "name": "Steven Gerrard",
    "logos": [
      "liverpool"
    ],
    "tags": [
      "liverpool",
      "premierleague",
      "midfielder",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "rooney",
    "name": "Wayne Rooney",
    "logos": [
      "manutd"
    ],
    "tags": [
      "manutd",
      "premierleague",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "shevchenko",
    "name": "Andriy Shevchenko",
    "logos": [
      "milan",
      "chelsea"
    ],
    "tags": [
      "milan",
      "chelsea",
      "seriea",
      "premierleague",
      "ballondor",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "etoo",
    "name": "Samuel Eto’o",
    "logos": [
      "africa",
      "barca",
      "inter",
      "chelsea"
    ],
    "tags": [
      "africa",
      "barca",
      "inter",
      "chelsea",
      "laliga",
      "seriea",
      "premierleague",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "mane",
    "name": "Sadio Mané",
    "logos": [
      "africa",
      "liverpool",
      "bayern"
    ],
    "tags": [
      "africa",
      "liverpool",
      "bayern",
      "premierleague",
      "bundesliga",
      "striker",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "salah",
    "name": "Mohamed Salah",
    "logos": [
      "africa",
      "chelsea",
      "liverpool"
    ],
    "tags": [
      "africa",
      "chelsea",
      "liverpool",
      "seriea",
      "premierleague",
      "striker",
      "active",
      "leftfoot",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "mahrez",
    "name": "Riyad Mahrez",
    "logos": [
      "africa"
    ],
    "tags": [
      "africa",
      "premierleague",
      "striker",
      "active",
      "leftfoot",
      "uclwinner"
    ]
  },
  {
    "id": "auba",
    "name": "Pierre-Emerick Aubameyang",
    "logos": [
      "africa",
      "om",
      "barca",
      "arsenal",
      "chelsea",
      "milan"
    ],
    "tags": [
      "africa",
      "om",
      "barca",
      "arsenal",
      "chelsea",
      "milan",
      "ligue1",
      "laliga",
      "premierleague",
      "seriea",
      "bundesliga",
      "striker",
      "active",
      "hundredgoals"
    ]
  },
  {
    "id": "giroud",
    "name": "Olivier Giroud",
    "logos": [
      "france",
      "arsenal",
      "chelsea",
      "milan"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "arsenal",
      "chelsea",
      "milan",
      "ligue1",
      "premierleague",
      "seriea",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "griezmann",
    "name": "Antoine Griezmann",
    "logos": [
      "france",
      "barca"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "barca",
      "laliga",
      "striker",
      "active",
      "leftfoot",
      "hundredgoals"
    ]
  },
  {
    "id": "kante",
    "name": "N’Golo Kanté",
    "logos": [
      "france",
      "chelsea"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "chelsea",
      "ligue1",
      "premierleague",
      "midfielder",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "pogba",
    "name": "Paul Pogba",
    "logos": [
      "france",
      "manutd",
      "juve"
    ],
    "tags": [
      "france",
      "worldcupwinner",
      "manutd",
      "juve",
      "premierleague",
      "seriea",
      "midfielder",
      "active"
    ]
  },
  {
    "id": "ozil",
    "name": "Mesut Özil",
    "logos": [
      "germany",
      "real",
      "arsenal"
    ],
    "tags": [
      "germany",
      "worldcupwinner",
      "real",
      "arsenal",
      "laliga",
      "premierleague",
      "bundesliga",
      "midfielder",
      "retired",
      "leftfoot"
    ]
  },
  {
    "id": "kroos",
    "name": "Toni Kroos",
    "logos": [
      "germany",
      "bayern",
      "real"
    ],
    "tags": [
      "germany",
      "worldcupwinner",
      "bayern",
      "real",
      "bundesliga",
      "laliga",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "muller",
    "name": "Thomas Müller",
    "logos": [
      "germany",
      "bayern"
    ],
    "tags": [
      "germany",
      "worldcupwinner",
      "bayern",
      "bundesliga",
      "midfielder",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "lewandowski",
    "name": "Robert Lewandowski",
    "logos": [
      "bayern",
      "barca"
    ],
    "tags": [
      "bayern",
      "barca",
      "bundesliga",
      "laliga",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "haaland",
    "name": "Erling Haaland",
    "logos": [],
    "tags": [
      "premierleague",
      "bundesliga",
      "striker",
      "active",
      "leftfoot",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "debruyne",
    "name": "Kevin De Bruyne",
    "logos": [
      "chelsea"
    ],
    "tags": [
      "chelsea",
      "premierleague",
      "bundesliga",
      "midfielder",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "hazard",
    "name": "Eden Hazard",
    "logos": [
      "chelsea",
      "real"
    ],
    "tags": [
      "chelsea",
      "real",
      "ligue1",
      "premierleague",
      "laliga",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "figo",
    "name": "Luís Figo",
    "logos": [
      "portugal",
      "barca",
      "real",
      "inter"
    ],
    "tags": [
      "portugal",
      "ballondor",
      "barca",
      "real",
      "inter",
      "laliga",
      "seriea",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "deco",
    "name": "Deco",
    "logos": [
      "portugal",
      "barca",
      "chelsea"
    ],
    "tags": [
      "portugal",
      "barca",
      "chelsea",
      "laliga",
      "premierleague",
      "midfielder",
      "retired",
      "uclwinner"
    ]
  },
  {
    "id": "suarez",
    "name": "Luis Suárez",
    "logos": [
      "barca",
      "liverpool"
    ],
    "tags": [
      "barca",
      "liverpool",
      "laliga",
      "premierleague",
      "striker",
      "active",
      "leftfoot",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "aguero",
    "name": "Sergio Agüero",
    "logos": [
      "argentina",
      "barca"
    ],
    "tags": [
      "argentina",
      "barca",
      "laliga",
      "premierleague",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "tevez",
    "name": "Carlos Tévez",
    "logos": [
      "argentina",
      "manutd",
      "juve"
    ],
    "tags": [
      "argentina",
      "manutd",
      "juve",
      "premierleague",
      "seriea",
      "striker",
      "retired",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "dimaria",
    "name": "Ángel Di María",
    "logos": [
      "argentina",
      "psg",
      "real",
      "juve",
      "manutd"
    ],
    "tags": [
      "argentina",
      "worldcupwinner",
      "psg",
      "real",
      "juve",
      "manutd",
      "ligue1",
      "laliga",
      "seriea",
      "premierleague",
      "midfielder",
      "active",
      "leftfoot",
      "uclwinner"
    ]
  },
  {
    "id": "verratti",
    "name": "Marco Verratti",
    "logos": [
      "italy",
      "psg"
    ],
    "tags": [
      "italy",
      "eurowinner",
      "psg",
      "ligue1",
      "midfielder",
      "active"
    ]
  },
  {
    "id": "hakimi",
    "name": "Achraf Hakimi",
    "logos": [
      "africa",
      "psg",
      "real",
      "inter"
    ],
    "tags": [
      "africa",
      "psg",
      "real",
      "inter",
      "bundesliga",
      "ligue1",
      "laliga",
      "seriea",
      "defender",
      "active"
    ]
  },
  {
    "id": "marquinhos",
    "name": "Marquinhos",
    "logos": [
      "brazil",
      "psg"
    ],
    "tags": [
      "brazil",
      "psg",
      "ligue1",
      "seriea",
      "defender",
      "active"
    ]
  },
  {
    "id": "thiagosilva",
    "name": "Thiago Silva",
    "logos": [
      "brazil",
      "psg",
      "milan",
      "chelsea"
    ],
    "tags": [
      "brazil",
      "psg",
      "milan",
      "chelsea",
      "ligue1",
      "seriea",
      "premierleague",
      "defender",
      "active",
      "uclwinner"
    ]
  },
  {
    "id": "osimhen",
    "name": "Victor Osimhen",
    "logos": [
      "africa"
    ],
    "tags": [
      "africa",
      "ligue1",
      "seriea",
      "striker",
      "active"
    ]
  },
  {
    "id": "falcao",
    "name": "Radamel Falcao",
    "logos": [
      "monaco",
      "chelsea",
      "manutd"
    ],
    "tags": [
      "monaco",
      "chelsea",
      "manutd",
      "ligue1",
      "premierleague",
      "laliga",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "pauleta",
    "name": "Pauleta",
    "logos": [
      "portugal",
      "psg"
    ],
    "tags": [
      "portugal",
      "psg",
      "ligue1",
      "laliga",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "cisse",
    "name": "Djibril Cissé",
    "logos": [
      "france",
      "om"
    ],
    "tags": [
      "france",
      "om",
      "ligue1",
      "premierleague",
      "seriea",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "niang",
    "name": "Mamadou Niang",
    "logos": [
      "africa",
      "om"
    ],
    "tags": [
      "africa",
      "om",
      "ligue1",
      "striker",
      "retired",
      "hundredgoals"
    ]
  },
  {
    "id": "gignac",
    "name": "André-Pierre Gignac",
    "logos": [
      "france",
      "om"
    ],
    "tags": [
      "france",
      "om",
      "ligue1",
      "striker",
      "active",
      "hundredgoals"
    ]
  },
  {
    "id": "lacazette",
    "name": "Alexandre Lacazette",
    "logos": [
      "france",
      "lyon",
      "arsenal"
    ],
    "tags": [
      "france",
      "lyon",
      "arsenal",
      "ligue1",
      "premierleague",
      "striker",
      "active",
      "hundredgoals"
    ]
  },
  {
    "id": "benyedder",
    "name": "Wissam Ben Yedder",
    "logos": [
      "france",
      "monaco"
    ],
    "tags": [
      "france",
      "monaco",
      "ligue1",
      "laliga",
      "striker",
      "active",
      "hundredgoals"
    ]
  },
  {
    "id": "balotelli",
    "name": "Mario Balotelli",
    "logos": [
      "italy",
      "om",
      "milan",
      "inter"
    ],
    "tags": [
      "italy",
      "om",
      "milan",
      "inter",
      "ligue1",
      "seriea",
      "premierleague",
      "striker",
      "active",
      "hundredgoals",
      "uclwinner"
    ]
  },
  {
    "id": "depay",
    "name": "Memphis Depay",
    "logos": [
      "netherlands",
      "lyon",
      "barca",
      "manutd"
    ],
    "tags": [
      "netherlands",
      "lyon",
      "barca",
      "manutd",
      "ligue1",
      "laliga",
      "premierleague",
      "striker",
      "active",
      "hundredgoals"
    ]
  }
];
