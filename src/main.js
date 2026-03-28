import './style.css';

// ===== HELPERS =====
// Players can be stored as strings (legacy) or objects with full stats
function playerName(p) {
  return typeof p === 'string' ? p : p.name;
}

// ===== DATA LOADING =====
async function loadMatchData() {
  const res = await fetch(import.meta.env.BASE_URL + 'data/matches.json');
  return await res.json();
}

// ===== LEADERBOARD COMPUTATION =====
function computeLeaderboard(data) {
  const stats = {};

  // Init all registered players
  data.players.forEach(p => {
    stats[p] = {
      name: p, wins: 0, losses: 0, draws: 0,
      roundsWon: 0, roundsLost: 0,
      kills: 0, deaths: 0, assists: 0,
      adr: [], kast: [], hltv: [], matches: 0
    };
  });

  data.matches.forEach(match => {
    const t1 = match.team1;
    const t2 = match.team2;
    const tie = t1.score === t2.score;
    const t1Won = t1.score > t2.score;

    const processPlayers = (teamPlayers, teamScore, oppScore, teamWon) => {
      teamPlayers.forEach(p => {
        const name = playerName(p);
        if (!stats[name]) stats[name] = {
          name, wins: 0, losses: 0, draws: 0,
          roundsWon: 0, roundsLost: 0,
          kills: 0, deaths: 0, assists: 0,
          adr: [], kast: [], hltv: [], matches: 0
        };
        const s = stats[name];
        s.roundsWon += teamScore;
        s.roundsLost += oppScore;
        s.matches++;
        if (tie) s.draws++;
        else if (teamWon) s.wins++;
        else s.losses++;

        // Accumulate per-match stats if available
        if (typeof p === 'object') {
          if (p.kills   != null) s.kills   += p.kills;
          if (p.deaths  != null) s.deaths  += p.deaths;
          if (p.assists != null) s.assists += p.assists;
          if (p.adr     != null) s.adr.push(p.adr);
          if (p.kast    != null) s.kast.push(p.kast);
          if (p.hltv    != null) s.hltv.push(p.hltv);
        }
      });
    };

    processPlayers(t1.players, t1.score, t2.score, t1Won && !tie);
    processPlayers(t2.players, t2.score, t1.score, !t1Won && !tie);
  });

  // Only show registered players in the leaderboard
  return Object.values(stats)
    .filter(s => data.players.includes(s.name))
    .map(s => ({
      ...s,
      total: s.wins + s.losses + s.draws,
      winRate: (s.wins + s.losses + s.draws) > 0
        ? (s.wins / (s.wins + s.losses + s.draws)) * 100
        : 0,
      roundDiff: s.roundsWon - s.roundsLost,
      avgADR:  s.adr.length  ? (s.adr.reduce((a,b)=>a+b,0)  / s.adr.length).toFixed(0)  : null,
      avgKAST: s.kast.length ? (s.kast.reduce((a,b)=>a+b,0) / s.kast.length).toFixed(0) : null,
      avgHLTV: s.hltv.length ? (s.hltv.reduce((a,b)=>a+b,0) / s.hltv.length).toFixed(2) : null,
      kd: s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills > 0 ? '∞' : '-',
    }))
    .sort((a, b) => {
      // Players with no games always go last
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;

      // Primary sort: wins
      if (b.wins !== a.wins) return b.wins - a.wins;

      // Tiebreaker: composite performance score
      // HLTV rating is the most complete indicator, then K/D, then ADR, then round diff
      const perf = p => (parseFloat(p.avgHLTV) || 0) * 3
                      + (parseFloat(p.kd) || 0) * 2
                      + (parseFloat(p.avgADR) || 0) / 50
                      + p.roundDiff / 10;
      return perf(b) - perf(a);
    });
}

// ===== RENDERING: PODIUM =====
function renderPodium(leaderboard) {
  const container = document.getElementById('top-three');

  if (leaderboard.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);font-family:var(--font-display);letter-spacing:2px;">No matches played yet — come back tonight! 🎮</div>`;
    return;
  }

  const medals = ['gold', 'silver', 'bronze'];
  const rankLabels = ['1°', '2°', '3°'];

  container.innerHTML = leaderboard.slice(0, 3).map((p, i) => `
    <div class="podium-card ${medals[i]}">
      <div class="podium-rank">${rankLabels[i]}</div>
      <div class="podium-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="podium-name">${p.name}</div>
        <div class="podium-winrate">${p.winRate.toFixed(0)}% Win Rate</div>
        <div class="podium-record">${p.wins}W &ndash; ${p.draws}D &ndash; ${p.losses}L</div>
        ${p.avgHLTV ? `<div class="podium-hltv">HLTV ${p.avgHLTV}</div>` : ''}
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
        <td style="color:var(--text-muted);font-weight:700">${p.draws}</td>
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
        <td class="${p.roundDiff >= 0 ? 'rd-positive' : 'rd-negative'}">${p.roundDiff >= 0 ? '+' : ''}${p.roundDiff}</td>
        <td class="stat-win">${p.kills}</td>
        <td class="stat-neutral">${p.assists}</td>
        <td class="stat-loss">${p.deaths}</td>
        <td class="stat-neutral">${p.kd}</td>
        <td class="stat-neutral">${p.avgADR ?? '-'}</td>
        <td class="stat-neutral">${p.avgKAST != null ? p.avgKAST + '%' : '-'}</td>
        <td class="${p.avgHLTV >= 1 ? 'rd-positive' : 'stat-neutral'}">${p.avgHLTV ?? '-'}</td>
      </tr>
    `;
  }).join('');
}

// ===== RENDERING: GLOBAL STATS =====
function renderGlobalStats(data) {
  const container = document.getElementById('global-stats');
  const totalMatches = data.matches.length;
  const totalPlayers = data.players.length;
  const season = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  container.innerHTML = `
    <div class="pill">Matches: <strong>${totalMatches}</strong></div>
    <div class="pill">Players: <strong>${totalPlayers}</strong></div>
    <div class="pill">Season: <strong>${season}</strong></div>
  `;
}

// ===== RENDERING: MATCH PLAYER STATS TABLE =====
function renderPlayerStatsTable(players, highlightNames) {
  // Check if any player has detailed stats
  const hasStats = players.some(p => typeof p === 'object' && p.kills != null);

  if (!hasStats) {
    return players.map(p => `<div class="team-player-name">${playerName(p)}</div>`).join('');
  }

  return `
    <div class="match-stats-table-wrapper">
      <table class="match-stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>K</th>
            <th>A</th>
            <th>D</th>
            <th>K/D</th>
            <th>ADR</th>
            <th>KAST</th>
            <th>HLTV</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => {
            const name = playerName(p);
            const isRegistered = highlightNames.includes(name);
            const kd = typeof p === 'object' && p.deaths > 0
              ? (p.kills / p.deaths).toFixed(2)
              : typeof p === 'object' && p.kd != null ? p.kd : '-';
            const ratingVal = typeof p === 'object' && p.rating != null ? p.rating : null;
            const ratingColor = ratingVal != null
              ? (ratingVal >= 0 ? 'var(--neon-green)' : 'var(--neon-red)')
              : 'var(--text-secondary)';

            return `
              <tr class="${isRegistered ? 'registered-player' : ''}">
                <td class="ms-name">${isRegistered ? `<span class="glab-dot"></span>` : ''}${name}</td>
                <td class="ms-kill">${typeof p === 'object' && p.kills != null ? p.kills : '-'}</td>
                <td class="ms-assist">${typeof p === 'object' && p.assists != null ? p.assists : '-'}</td>
                <td class="ms-death">${typeof p === 'object' && p.deaths != null ? p.deaths : '-'}</td>
                <td class="${typeof p === 'object' && p.kd >= 1 ? 'ms-kd-pos' : 'ms-kd-neg'}">${typeof p === 'object' && p.kd != null ? p.kd : kd}</td>
                <td>${typeof p === 'object' && p.adr != null ? p.adr : '-'}</td>
                <td>${typeof p === 'object' && p.kast != null ? p.kast + '%' : '-'}</td>
                <td class="${typeof p === 'object' && p.hltv >= 1 ? 'ms-hltv-pos' : ''}">${typeof p === 'object' && p.hltv != null ? p.hltv : '-'}</td>
                <td style="color:${ratingColor};font-weight:700">${ratingVal != null ? (ratingVal >= 0 ? '+' : '') + ratingVal.toFixed(2) : '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ===== RENDERING: MATCHES =====
function renderMatches(data) {
  const container = document.getElementById('matches-list');

  if (data.matches.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-family:var(--font-display);letter-spacing:2px;">No matches recorded yet.<br><br>Add your first match to <code style="color:var(--neon-cyan)">public/data/matches.json</code> 🕹️</div>`;
    return;
  }

  const sorted = [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(match => {
    const t1Won = match.team1.score > match.team2.score;
    const isTie = match.team1.score === match.team2.score;

    const formatDate = d =>
      new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const resultLabel = isTie ? 'TIE' : t1Won ? 'WIN' : 'LOSS';
    const resultClass = isTie ? 'result-tie' : t1Won ? 'result-win' : 'result-loss';

    return `
      <div class="match-card match-card-full">
        <div class="match-meta">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="match-date">${formatDate(match.date)}</span>
            <span class="match-map">${match.map}</span>
          </div>
          <span class="match-result-badge ${resultClass}">${resultLabel}</span>
        </div>

        <div class="match-score-area">
          <div class="team-block">
            <div class="team-name">${match.team1.name}</div>
            <div class="team-score ${isTie ? 'tie' : t1Won ? 'winner' : 'loser'}">${match.team1.score}</div>
          </div>
          <div class="score-divider">vs</div>
          <div class="team-block">
            <div class="team-name">${match.team2.name}</div>
            <div class="team-score ${isTie ? 'tie' : !t1Won ? 'winner' : 'loser'}">${match.team2.score}</div>
          </div>
        </div>

        <div class="match-team-section">
          <div class="match-team-label team-label-glab">${match.team1.name}</div>
          ${renderPlayerStatsTable(match.team1.players, data.players)}
        </div>

        <div class="match-team-section" style="margin-top:1rem">
          <div class="match-team-label team-label-enemy">${match.team2.name}</div>
          ${renderPlayerStatsTable(match.team2.players, data.players)}
        </div>
      </div>
    `;
  }).join('');
}

// ===== RENDERING: STATS PAGE =====
function renderStats(data, leaderboard) {
  const container = document.getElementById('stats-content');

  if (data.matches.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-family:var(--font-display);letter-spacing:2px;">Stats will appear here once matches are played. 📊</div>`;
    return;
  }

  const mapCount = {};
  data.matches.forEach(m => { mapCount[m.map] = (mapCount[m.map] || 0) + 1; });
  const maxMapCount = Math.max(...Object.values(mapCount));

  const bestPlayer = leaderboard.filter(p => p.total > 0)[0];
  const mostMatches = [...leaderboard].sort((a, b) => b.total - a.total)[0];
  const bestRD = [...leaderboard].sort((a, b) => b.roundDiff - a.roundDiff)[0];
  const bestHLTV = [...leaderboard].filter(p => p.avgHLTV != null).sort((a, b) => b.avgHLTV - a.avgHLTV)[0];
  const totalRounds = data.matches.reduce((acc, m) => acc + m.team1.score + m.team2.score, 0);
  const avgRounds = data.matches.length > 0 ? (totalRounds / data.matches.length).toFixed(1) : 0;

  const playerStreaks = {};
  const sortedMatches = [...data.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedMatches.forEach(m => {
    const t1Won = m.team1.score > m.team2.score;
    const isTie = m.team1.score === m.team2.score;
    [...m.team1.players, ...m.team2.players].forEach(p => {
      const name = playerName(p);
      if (!playerStreaks[name]) playerStreaks[name] = { current: 0, best: 0 };
      const isTeam1 = m.team1.players.map(playerName).includes(name);
      const won = isTie ? false : (isTeam1 ? t1Won : !t1Won);
      if (won) {
        playerStreaks[name].current++;
        playerStreaks[name].best = Math.max(playerStreaks[name].best, playerStreaks[name].current);
      } else {
        playerStreaks[name].current = 0;
      }
    });
  });
  const bestStreakPlayer = Object.entries(playerStreaks).sort((a, b) => b[1].best - a[1].best)[0];

  container.innerHTML = `
    <div class="stats-standings">
      <div class="stats-section-label">📋 Overall Standings</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pos</th><th>Player</th><th>W</th><th>D</th><th>L</th><th>GP</th><th>Win%</th><th>RD</th><th>K/D</th><th>ADR</th><th>KAST</th><th>HLTV</th>
            </tr>
          </thead>
          <tbody>
            ${leaderboard.map((p, i) => {
              const pos = i + 1;
              const posDisplay = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
              return `<tr>
                <td style="text-align:center;font-family:var(--font-display);font-weight:700;color:var(--text-muted)">${posDisplay}</td>
                <td class="player-name">${p.name}</td>
                <td class="stat-win">${p.wins}</td>
                <td style="color:var(--text-muted);font-weight:700">${p.draws}</td>
                <td class="stat-loss">${p.losses}</td>
                <td class="stat-neutral">${p.total}</td>
                <td>
                  <div class="winrate-bar">
                    <div class="winrate-track"><div class="winrate-fill" style="width:${p.winRate}%"></div></div>
                    <span class="winrate-text" style="color:${p.winRate >= 50 ? 'var(--neon-green)' : 'var(--neon-red)'}">${p.winRate.toFixed(0)}%</span>
                  </div>
                </td>
                <td class="${p.roundDiff >= 0 ? 'rd-positive' : 'rd-negative'}">${p.roundDiff >= 0 ? '+' : ''}${p.roundDiff}</td>
                <td class="stat-neutral">${p.kd}</td>
                <td class="stat-neutral">${p.avgADR ?? '-'}</td>
                <td class="stat-neutral">${p.avgKAST != null ? p.avgKAST + '%' : '-'}</td>
                <td class="${p.avgHLTV >= 1 ? 'rd-positive' : 'stat-neutral'}">${p.avgHLTV ?? '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="stats-cards-grid">
    <div class="stat-card">
      <div class="stat-card-title">👑 Best Win Rate</div>
      <div class="stat-card-value">${bestPlayer ? bestPlayer.winRate.toFixed(0) + '%' : '-'}</div>
      <div class="stat-card-sub">${bestPlayer ? bestPlayer.name + ' (' + bestPlayer.wins + 'W-' + bestPlayer.losses + 'L)' : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-title">🎯 Best HLTV Rating</div>
      <div class="stat-card-value">${bestHLTV ? bestHLTV.avgHLTV : '-'}</div>
      <div class="stat-card-sub">${bestHLTV ? bestHLTV.name : ''}</div>
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
        if (s.id === `section-${target}`) s.classList.add('active');
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
