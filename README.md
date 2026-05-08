<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kun Foot Bingo</title>
  <link rel="preconnect" href="https://www.gstatic.com">
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Multijoueur · 5x5</p>
        <h1>Kun Foot Bingo</h1>
      </div>
      <div class="room-pill hidden" id="roomPill">
        Room <strong id="roomCodeDisplay">----</strong>
        <button id="copyRoomBtn" class="ghost-btn">Copier</button>
      </div>
    </header>

    <main>
      <section id="setupView" class="setup-card">
        <div class="hero-copy">
          <p class="eyebrow">Prototype test</p>
          <h2>Crée une room, partage le code, tout le monde joue sur la même grille.</h2>
          <p>
            Chaque joueur a sa propre grille à remplir. Le streamer peut passer au joueur suivant.
            Les scores se mettent à jour en direct.
          </p>
        </div>

        <div class="setup-panel">
          <label for="playerName">Ton pseudo</label>
          <input id="playerName" maxlength="20" placeholder="Ex : Kun" />

          <div class="divider"></div>

          <button id="createRoomBtn" class="primary-btn">Créer une partie</button>

          <div class="join-row">
            <input id="joinCode" maxlength="6" placeholder="Code room" />
            <button id="joinRoomBtn" class="secondary-btn">Rejoindre</button>
          </div>

          <p class="tiny">
            Besoin de Firebase configuré pour le vrai multijoueur. Voir README.
          </p>
        </div>
      </section>

      <section id="gameView" class="game-layout hidden">
        <aside class="side-panel">
          <div class="current-card">
            <p class="eyebrow">Joueur actuel</p>
            <h2 id="currentPlayerName">—</h2>
            <p id="currentPlayerMeta">Sélectionne une case. Le verdict reste caché jusqu’à la fin.</p>
            <div id="currentPlayerBadges" class="team-strip"></div>
            <div class="timer-box">
              <span>Prochain joueur</span>
              <strong id="countdownText">15s</strong>
            </div>
            <div class="current-actions">
              <button id="nextPlayerBtn" class="primary-btn hidden">Passer maintenant</button>
              <button id="leaveRoomBtn" class="ghost-btn">Quitter</button>
            </div>
          </div>

          <div class="status-card">
            <p class="eyebrow">Ta partie</p>
            <div class="stat-line">
              <span id="scoreLabel">Cases remplies</span>
              <strong id="myScore">0 / 25</strong>
            </div>
            <div class="stat-line">
              <span id="bingoLabel">Bingos</span>
              <strong id="myBingos">?</strong>
            </div>
            <p id="gameMessage" class="message">Clique une case vide pour placer le joueur. Verdict caché jusqu’à la grille complète.</p>
          </div>

          <div class="leaderboard-card">
            <p class="eyebrow">Classement live</p>
            <ol id="leaderboard"></ol>
          </div>
        </aside>

        <section class="board-wrap">
          <div id="board" class="board"></div>
        </section>
      </section>
    </main>
  </div>

  <script type="module" src="./app.js"></script>
</body>
</html>
