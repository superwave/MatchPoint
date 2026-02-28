/* ============================================
   UI Rendering (Scoreboard, Player Cards, Status)
   ============================================ */

import { match, getPointDisplay, escapeHtml } from './state.js';
import { isPlayerAboutToWinGame, countPointOpportunities, isGameWinSetWin } from './scoring.js';

// ==================== SCREEN NAVIGATION ====================

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ==================== MAIN UPDATE ====================

export function updateDisplay() {
    if (!match) return;
    updateScoreboard();
    updateTopBar();
    updatePlayerCards();
}

// ==================== PLAYER CARDS ====================

export function updatePlayerCards() {
    updateStatusBanner();

    for (let p = 1; p <= 2; p++) {
        const isServing = match.server === p;
        const isReceiver = !isServing;

        document.getElementById(`card-serve-${p}`).style.visibility = isServing ? '' : 'hidden';
        document.getElementById(`card-score-${p}`).textContent = getPointDisplay(p - 1);

        const actionsEl = document.getElementById(`card-actions-${p}`);
        let html = '';
        html += `<div class="card-actions-primary"><button class="card-action normal" data-player="${p}" data-type="normal">得分</button></div>`;
        html += `<div class="card-actions-secondary">`;
        if (isServing) {
            html += `<button class="card-action ace" data-player="${p}" data-type="ace">得分<br><span class="action-tag">發球 ACE</span></button>`;
        }
        if (isReceiver) {
            html += `<button class="card-action df" data-player="${p}" data-type="doubleFault">得分<br><span class="action-tag">對手 DF</span></button>`;
        }
        html += `<button class="card-action ue" data-player="${p}" data-type="unforcedError">得分<br><span class="action-tag">對手 UE</span></button>`;
        html += `</div>`;
        actionsEl.innerHTML = html;
    }
}

// ==================== STATUS BANNER ====================

function updateStatusBanner() {
    const banner = document.getElementById('match-status-banner');

    if (match.matchOver) {
        banner.classList.add('banner-hidden');
        return;
    }

    let best = null;

    for (let p = 1; p <= 2; p++) {
        if (!isPlayerAboutToWinGame(p)) continue;

        const name = p === 1 ? match.config.player1 : match.config.player2;
        const count = countPointOpportunities(p);
        if (count === 0) continue;

        const isServer = match.server === p;
        const wouldWinSet = isGameWinSetWin(p);
        const setsNeeded = Math.ceil(match.config.format / 2);
        const wouldWinMatch = wouldWinSet && match.setsWon[p - 1] === setsNeeded - 1;

        const cntLabel = count > 1 ? `${count} 個` : '';
        const cntEn = count > 1 ? `${count} ` : '';
        const plural = count > 1 ? 's' : '';
        let priority = 0;
        let text = '';

        if (wouldWinMatch) {
            priority = 4;
            text = `🏆 ${cntLabel}賽末點 ${cntEn}Match Point${plural} — ${name}`;
        } else if (wouldWinSet) {
            priority = 3;
            text = `★ ${cntLabel}盤末點 ${cntEn}Set Point${plural} — ${name}`;
        } else if (!isServer) {
            priority = 2;
            text = `⚡ ${cntLabel}破發點 ${cntEn}Break Point${plural} — ${name}`;
        } else {
            priority = 1;
            text = `● ${cntLabel}局點 ${cntEn}Game Point${plural} — ${name}`;
        }

        if (!best || priority > best.priority) {
            best = { priority, text };
        }
    }

    if (best) {
        banner.textContent = best.text;
        banner.className = 'match-status-banner';
    } else {
        banner.className = 'match-status-banner banner-hidden';
    }
}

// ==================== TOP BAR ====================

function updateTopBar() {
    const setNum = match.currentSet + 1;
    const setLabel = match.isTiebreak ? `Set ${setNum} · Tiebreak` : `Set ${setNum}`;
    document.getElementById('match-set-info').textContent = setLabel;

    const serverName = match.server === 1 ? match.config.player1 : match.config.player2;
    document.getElementById('match-server-info').textContent = `發球 ${serverName}`;
}

// ==================== SCOREBOARD ====================

function updateScoreboard() {
    const maxSets = match.config.format;
    const totalSetsPlayed = match.setScores.length;

    let html = '<table><thead><tr>';
    html += '<th></th>';
    for (let i = 0; i < maxSets; i++) {
        html += `<th>S${i + 1}</th>`;
    }
    html += '<th class="game-col">Game</th>';
    html += '</tr></thead><tbody>';

    for (let p = 0; p < 2; p++) {
        const playerName = p === 0 ? match.config.player1 : match.config.player2;
        const isServing = match.server === (p + 1);

        html += '<tr>';
        html += `<td><div class="player-name-cell">`;
        if (isServing) {
            html += `<span class="serve-dot">●</span>`;
        }
        html += `${escapeHtml(playerName)}</div></td>`;

        for (let s = 0; s < maxSets; s++) {
            if (s < totalSetsPlayed) {
                const games = match.setScores[s][p];
                const otherGames = match.setScores[s][1 - p];
                const setFinished = s < match.currentSet;
                const wonSet = setFinished && games > otherGames;

                let cellContent = `${games}`;
                if (match.tiebreakFinalScores[s] && setFinished) {
                    const tbLoser = Math.min(match.tiebreakFinalScores[s][0], match.tiebreakFinalScores[s][1]);
                    if (games === 7 || (games === 6 && otherGames === 7)) {
                        if (games === 7) {
                            cellContent = `7<span class="tiebreak-score">${tbLoser}</span>`;
                        }
                    }
                }

                html += `<td class="set-score ${wonSet ? 'set-won' : ''}">${cellContent}</td>`;
            } else {
                html += '<td class="set-score">-</td>';
            }
        }

        const pointDisplay = getPointDisplay(p);
        html += `<td class="game-score">${pointDisplay}</td>`;
        html += '</tr>';
    }

    html += '</tbody></table>';
    document.getElementById('scoreboard').innerHTML = html;
}
