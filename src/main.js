import './style.css';

// ===== DATA LOADING =====
async function loadMatchData() {
  const res = await fetch('/data/matches.json');
  return await res.json();
}

// ===== LEADERBOARD COMPUTATION =====
function computeLeaderboard(data) {
  const stats = {};

  // Init all players
  data.players.forEach(p => {
    stats[p] = { name: p, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0 };
  });

  data.matches.forEach(match => {
    const t1 = match.team1;
    const t2 = match.team2;
    const t1Won = t1.score > t2.score;

    t1.players.forEach(p => {
      if (!stats[p]) stats[p] = { name: p, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0 };
      stats[p].roundsWon += t1.score;
      stats[p].roundsLost += t2.score;
      if (t1Won) stats[p].wins++;
      else stats[p].losses++;
    });

    t2.players.forEach(p => {
      if (!stats[p]) stats[p] = { name: p, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0 };
      stats[p].roundsWon += t2.score;
      stats[p].roundsLost += t1.score;
      if (!t1Won) stats[p].wins++;
      else stats[p].losses++;
    });
  });

  return Object.values(stats)
    .map(s => ({
      ...s,
      total: s.wins + s.losses,
      winRate: s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0,
      roundDiff: s.roundsWon - s.roundsLost,
    }))
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
      return b.wins - a.wins;
    });
}

// ===== RENDERING: PODIUM =====
function renderPodium(leaderboard) {
  const container = document.getElementById('top-three');
  const medals = ['gold', 'silver', 'bronze'];
  const rankLabels = ['1°', '2°', '3°'];

  container.innerHTML = leaderboard.slice(0, 3).map((p, i) => `
    <div class="podium-card ${medals[i]}">
      <div class="podium-rank">${rankLabels[i]}</div>
      <div class="podium-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="podium-name">${p.name}</div>
        <div class="podium-winrate">${p.winRate.toFixed(0)}% Win Rate</div>
        <div class="podium-record">${p.wins}W &ndash; ${p.losses}L</div>
      </div>
    </div>
  `).join('');
}

// ===== RENDERING: TABLE =====
function renderLeaderboardTable(leaderboard) {
  const tbody = document.getElementById('leaderboard-body');

  tbody.innerHTML = leaderboard.map((p, i) => {
    const pos = i + 1;
    let posDisplay = pos;
    if (pos === 1) posDisplay = '🥇';
    else if (pos === 2) posDisplay = '🥈';
    else if (pos === 3) posDisplay = '🥉';

    return `
      <tr>
        <td>${posDisplay}</td>
        <td class="player-name">${p.name}</td>
        <td class="stat-win">${p.wins}</td>
        <td class="stat-loss">${p.losses}</td>
        <td class="stat-neutral">${p.total}</td>
        <td>
          <div class="winrate-bar">
            <div class="winrate-track">
              <div class="winrate-fill" style="width: ${p.winRate}%"></div>
            </div>
            <span class="winrate-text" style="color: ${p.winRate >= 50 ? 'var(--neon-green)' : 'var(--neon-red)'}">
              ${p.winRate.toFixed(0)}%
            </span>
          </div>
        </td>
        <td class="stat-win">${p.roundsWon}</td>
        <td class="stat-loss">${p.roundsLost}</td>
        <td class="${p.roundDiff >= 0 ? 'rd-positive' : 'rd-negative'}">
          ${p.roundDiff >= 0 ? '+' : ''}${p.roundDiff}
        </td>
      </tr>
    `;
  }).join('');
}

// ===== RENDERING: GLOBAL STATS =====
function renderGlobalStats(data) {
  const container = document.getElementById('global-stats');
  const totalMatches = data.matches.length;
  const totalPlayers = data.players.length;

  container.innerHTML = `
    <div class="pill">Matches: <strong>${totalMatches}</strong></div>
    <div class="pill">Players: <strong>${totalPlayers}</strong></div>
  `;
}

// ===== RENDERING: MATCHES =====
function renderMatches(data) {
  const container = document.getElementById('matches-list');
  // Show most recent first
  const sorted = [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(match => {
    const t1Won = match.team1.score > match.team2.score;

    const formatDate = (d) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return `
      <div class="match-card">
        <div class="match-meta">
          <span class="match-date">${formatDate(match.date)}</span>
          <span class="match-map">${match.map}</span>
        </div>
        <div class="match-score-area">
          <div class="team-block">
            <div class="team-name">${match.team1.name}</div>
            <div class="team-score ${t1Won ? 'winner' : 'loser'}">${match.team1.score}</div>
          </div>
          <div class="score-divider">vs</div>
          <div class="team-block">
            <div class="team-name">${match.team2.name}</div>
            <div class="team-score ${!t1Won ? 'winner' : 'loser'}">${match.team2.score}</div>
          </div>
        </div>
        <div class="match-players">
          <div class="team-players">
            <div class="team-players-label">${match.team1.name}</div>
            ${match.team1.players.map(p => `<div class="team-player-name">${p}</div>`).join('')}
          </div>
          <div class="team-players" style="text-align:right">
            <div class="team-players-label">${match.team2.name}</div>
            ${match.team2.players.map(p => `<div class="team-player-name">${p}</div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== RENDERING: STATS PAGE =====
function renderStats(data, leaderboard) {
  const container = document.getElementById('stats-content');

  // Map frequency
  const mapCount = {};
  data.matches.forEach(m => {
    mapCount[m.map] = (mapCount[m.map] || 0) + 1;
  });
  const maxMapCount = Math.max(...Object.values(mapCount));

  // Best winrate
  const bestPlayer = leaderboard.filter(p => p.total > 0)[0];
  // Most matches
  const mostMatches = [...leaderboard].sort((a, b) => b.total - a.total)[0];
  // Best round diff
  const bestRD = [...leaderboard].sort((a, b) => b.roundDiff - a.roundDiff)[0];
  // Total rounds
  const totalRounds = data.matches.reduce((acc, m) => acc + m.team1.score + m.team2.score, 0);
  // Avg rounds per match
  const avgRounds = data.matches.length > 0 ? (totalRounds / data.matches.length).toFixed(1) : 0;

  // Streak calc
  const playerStreaks = {};
  const sortedMatches = [...data.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedMatches.forEach(m => {
    const t1Won = m.team1.score > m.team2.score;
    [...m.team1.players, ...m.team2.players].forEach(p => {
      if (!playerStreaks[p]) playerStreaks[p] = { current: 0, best: 0 };
      const isTeam1 = m.team1.players.includes(p);
      const won = isTeam1 ? t1Won : !t1Won;
      if (won) {
        playerStreaks[p].current++;
        playerStreaks[p].best = Math.max(playerStreaks[p].best, playerStreaks[p].current);
      } else {
        playerStreaks[p].current = 0;
      }
    });
  });
  const bestStreakPlayer = Object.entries(playerStreaks).sort((a, b) => b[1].best - a[1].best)[0];

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-title">👑 Best Win Rate</div>
      <div class="stat-card-value">${bestPlayer ? bestPlayer.winRate.toFixed(0) + '%' : '-'}</div>
      <div class="stat-card-sub">${bestPlayer ? bestPlayer.name + ' (' + bestPlayer.wins + 'W-' + bestPlayer.losses + 'L)' : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">🔥 Best Win Streak</div>
      <div class="stat-card-value">${bestStreakPlayer ? bestStreakPlayer[1].best + 'W' : '-'}</div>
      <div class="stat-card-sub">${bestStreakPlayer ? bestStreakPlayer[0] : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">📊 Total Rounds</div>
      <div class="stat-card-value">${totalRounds}</div>
      <div class="stat-card-sub">Avg ${avgRounds} rounds/match</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">⚡ Best Round Diff</div>
      <div class="stat-card-value">${bestRD ? (bestRD.roundDiff >= 0 ? '+' : '') + bestRD.roundDiff : '-'}</div>
      <div class="stat-card-sub">${bestRD ? bestRD.name : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">🎮 Most Matches Played</div>
      <div class="stat-card-value">${mostMatches ? mostMatches.total : '-'}</div>
      <div class="stat-card-sub">${mostMatches ? mostMatches.name : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">🗺️ Maps Played</div>
      <div class="stat-bar-list">
        ${Object.entries(mapCount)
          .sort((a, b) => b[1] - a[1])
          .map(([map, count]) => `
            <div class="stat-bar-item">
              <span class="stat-bar-label">${map}</span>
              <div class="stat-bar-track">
                <div class="stat-bar-fill" style="width: ${(count / maxMapCount) * 100}%"></div>
              </div>
              <span class="stat-bar-value">${count}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

// ===== NAVIGATION =====
function initNavigation() {
  const buttons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.section');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => {
        s.classList.remove('active');
        if (s.id === `section-${target}`) {
          s.classList.add('active');
        }
      });
    });
  });
}

// ===== PARTICLES =====
function initParticles() {
  const container = document.getElementById('particles-bg');
  const colors = ['var(--neon-cyan)', 'var(--neon-green)', 'var(--neon-purple)'];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    const size = Math.random() * 4 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${color};
      box-shadow: 0 0 ${size * 3}px ${color};
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(particle);
  }
}

// ===== INIT =====
async function init() {
  initNavigation();
  initParticles();

  try {
    const data = await loadMatchData();
    const leaderboard = computeLeaderboard(data);

    renderGlobalStats(data);
    renderPodium(leaderboard);
    renderLeaderboardTable(leaderboard);
    renderMatches(data);
    renderStats(data, leaderboard);
  } catch (err) {
    console.error('Error loading data:', err);
    document.getElementById('app').innerHTML = `
      <div style="text-align:center;padding:4rem;color:var(--neon-red);">
        <h2>Error loading data</h2>
        <p>Make sure <code>public/data/matches.json</code> exists and is valid.</p>
      </div>
    `;
  }
}

init();
