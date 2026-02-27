/* ============================================
   MatchPoint - Tennis Umpire Tool
   Application Logic
   ============================================ */

// ==================== CONSTANTS ====================
const POINT_DISPLAY = ['0', '15', '30', '40'];
const STORAGE_KEY = 'matchpoint_match';

// ==================== STATE ====================
let match = null;
let timerInterval = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    checkSavedMatch();
});

function checkSavedMatch() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && !parsed.matchOver) {
                document.getElementById('resume-banner').classList.remove('hidden');
            }
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

function resumeMatch() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            match = JSON.parse(saved);
            document.getElementById('card-name-1').textContent = match.config.player1;
            document.getElementById('card-name-2').textContent = match.config.player2;
            document.getElementById('match-screen').setAttribute('data-court', match.config.courtType);
            showScreen('match-screen');
            startTimer();
            updateDisplay();
        } catch (e) {
            alert('無法恢復比賽 / Cannot resume match');
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

function discardSavedMatch() {
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('resume-banner').classList.add('hidden');
}

// ==================== SETUP ====================
function updateFirstServerOptions() {
    const p1 = document.getElementById('player1-name').value.trim() || '選手 1';
    const p2 = document.getElementById('player2-name').value.trim() || '選手 2';
    const sel = document.getElementById('first-server');
    sel.options[0].textContent = p1;
    sel.options[1].textContent = p2;
}

function handleSetupSubmit(e) {
    e.preventDefault();

    const config = {
        umpire: document.getElementById('umpire-name').value.trim(),
        player1: document.getElementById('player1-name').value.trim(),
        player2: document.getElementById('player2-name').value.trim(),
        courtType: document.getElementById('court-type').value,
        format: parseInt(document.getElementById('match-format').value),
        finalSetType: document.getElementById('final-set-type').value,
        deuceType: document.getElementById('deuce-type').value,
        firstServer: parseInt(document.getElementById('first-server').value)
    };

    if (!config.player1 || !config.player2) {
        alert('請輸入雙方選手名稱 / Please enter both player names');
        return;
    }

    initMatch(config);
    showScreen('match-screen');
}

function initMatch(config) {
    match = {
        config: config,
        server: config.firstServer,
        currentSet: 0,
        setScores: [[0, 0]],
        setsWon: [0, 0],
        gamePoints: [0, 0],
        isTiebreak: false,
        tiebreakTarget: 7,
        tiebreakFirstServer: config.firstServer,
        tiebreakPoints: [0, 0],
        advantage: 0,
        matchOver: false,
        winner: 0,
        retirement: null,
        stats: {
            aces: [0, 0],
            doubleFaults: [0, 0],
            unforcedErrors: [0, 0],
            breakPointsWon: [0, 0],
            breakPointsFaced: [0, 0],
            pointsWon: [0, 0]
        },
        tiebreakFinalScores: [null],
        startTime: Date.now(),
        endTime: null,
        history: [],
        pointLog: []
    };

    // Set player names on cards
    document.getElementById('card-name-1').textContent = config.player1;
    document.getElementById('card-name-2').textContent = config.player2;

    // Apply court theme
    document.getElementById('match-screen').setAttribute('data-court', config.courtType);

    startTimer();
    updateDisplay();
    saveToStorage();
}

// ==================== TIMER ====================
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    if (!match || !match.startTime) return;
    const elapsed = (match.endTime || Date.now()) - match.startTime;
    const totalSec = Math.floor(elapsed / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const el = document.getElementById('match-timer');
    if (hrs > 0) {
        el.textContent = `${hrs}:${pad(mins)}:${pad(secs)}`;
    } else {
        el.textContent = `${pad(mins)}:${pad(secs)}`;
    }
}

function pad(n) {
    return n.toString().padStart(2, '0');
}

function getMatchDuration() {
    if (!match || !match.startTime) return '--';
    const end = match.endTime || Date.now();
    const elapsed = end - match.startTime;
    const totalMin = Math.floor(elapsed / 60000);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
}

// ==================== SCORING ====================
function handleTypedScore(player, type, event) {
    if (event) event.stopPropagation();
    if (!match || match.matchOver) return;
    if (type === 'ace') {
        scorePoint(match.server, 'ace');
    } else if (type === 'doubleFault') {
        const receiver = match.server === 1 ? 2 : 1;
        scorePoint(receiver, 'doubleFault');
    } else if (type === 'unforcedError') {
        scorePoint(player, 'unforcedError');
    } else {
        scorePoint(player, 'normal');
    }
}

function scorePoint(scorer, type) {
    // Save snapshot for undo
    saveSnapshot();

    const si = scorer - 1;
    const loser = scorer === 1 ? 2 : 1;
    const li = loser - 1;

    // Track stats
    match.stats.pointsWon[si]++;

    if (type === 'ace') {
        match.stats.aces[match.server - 1]++;
    } else if (type === 'doubleFault') {
        match.stats.doubleFaults[match.server - 1]++;
    } else if (type === 'unforcedError') {
        match.stats.unforcedErrors[li]++;
    }

    // Check and track break point before scoring
    if (!match.isTiebreak && isBreakPoint()) {
        const receiver = match.server === 1 ? 2 : 1;
        match.stats.breakPointsFaced[match.server - 1]++;
        if (scorer === receiver) {
            match.stats.breakPointsWon[receiver - 1]++;
        }
    }

    // Log the point
    match.pointLog.push({
        set: match.currentSet + 1,
        gameScore: `${match.setScores[match.currentSet][0]}-${match.setScores[match.currentSet][1]}`,
        pointScore: getPointScoreString(),
        server: match.server,
        scorer: scorer,
        type: type,
        isTiebreak: match.isTiebreak,
        timestamp: Date.now()
    });

    // Score the point
    if (match.isTiebreak) {
        scoreTiebreakPoint(scorer);
    } else {
        scoreNormalGamePoint(scorer);
    }

    updateDisplay();
    saveToStorage();
}

function scoreNormalGamePoint(scorer) {
    const si = scorer - 1;
    const li = (scorer === 1 ? 2 : 1) - 1;

    // Both at 40+ (deuce territory)
    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3) {
        if (match.config.deuceType === 'noAd') {
            winGame(scorer);
            return;
        }
        // AD scoring
        if (match.advantage === 0) {
            match.advantage = scorer;
        } else if (match.advantage === scorer) {
            winGame(scorer);
        } else {
            match.advantage = 0;
        }
        return;
    }

    // Normal increment
    match.gamePoints[si]++;

    // Check game win: scorer now at 4+ and opponent < 4
    if (match.gamePoints[si] > 3) {
        winGame(scorer);
    }
}

function scoreTiebreakPoint(scorer) {
    const si = scorer - 1;
    match.tiebreakPoints[si]++;

    const p1 = match.tiebreakPoints[0];
    const p2 = match.tiebreakPoints[1];
    const total = p1 + p2;
    const target = match.tiebreakTarget;

    // Check tiebreak win
    if ((p1 >= target || p2 >= target) && Math.abs(p1 - p2) >= 2) {
        winGame(scorer);
        return;
    }

    // Server change: after 1st point, then every 2 points
    if (total % 2 === 1) {
        switchServer();
    }

    // Change of ends every 6 points
    if (total > 0 && total % 6 === 0) {
        showNotification('換邊 Change Ends');
    }
}

function winGame(scorer) {
    const si = scorer - 1;
    const currentSetGames = match.setScores[match.currentSet];

    // If tiebreak just ended, save tiebreak score
    if (match.isTiebreak) {
        match.tiebreakFinalScores[match.currentSet] = [
            match.tiebreakPoints[0],
            match.tiebreakPoints[1]
        ];
    }

    currentSetGames[si]++;

    // Show game notification
    const serverName = match.server === 1 ? match.config.player1 : match.config.player2;
    const scorerName = scorer === 1 ? match.config.player1 : match.config.player2;
    const receiver = match.server === 1 ? 2 : 1;

    // Check if this was a break
    const isBreak = !match.isTiebreak && scorer === receiver;

    // Reset game state
    match.gamePoints = [0, 0];
    match.advantage = 0;
    const wasTiebreak = match.isTiebreak;
    match.isTiebreak = false;
    match.tiebreakPoints = [0, 0];

    // Check set win
    const g1 = currentSetGames[0];
    const g2 = currentSetGames[1];

    if (checkSetWin(g1, g2)) {
        winSet(scorer);
        return;
    }

    // Check if tiebreak should start
    if (g1 === 6 && g2 === 6) {
        if (shouldPlayTiebreak()) {
            startTiebreak();
            showNotification(`搶${match.tiebreakTarget} Tiebreak`, true);
            return;
        }
    }

    // Switch server (in normal games, after every game)
    if (!wasTiebreak) {
        switchServer();
    } else {
        // After tiebreak, the player who received first in the tiebreak serves
        match.server = match.tiebreakFirstServer === 1 ? 2 : 1;
    }

    // Change of ends (after odd total games in set)
    const totalGames = currentSetGames[0] + currentSetGames[1];
    if (totalGames % 2 === 1) {
        showNotification('換邊 Change Ends');
    } else if (isBreak) {
        showNotification(`Break! ${scorerName}`);
    } else {
        showNotification(`Game ${scorerName}`);
    }
}

function checkSetWin(g1, g2) {
    // Standard: first to 6 with 2-game lead
    if (g1 >= 6 && g1 - g2 >= 2) return true;
    if (g2 >= 6 && g2 - g1 >= 2) return true;
    // After tiebreak: 7-6 or 6-7
    if ((g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7)) return true;
    // In advantage (no tiebreak) final set: need 2-game lead at 6+
    return false;
}

function shouldPlayTiebreak() {
    const setsNeeded = Math.ceil(match.config.format / 2);
    const isFinalSet = match.setsWon[0] === setsNeeded - 1 &&
        match.setsWon[1] === setsNeeded - 1;

    // Non-final sets always have standard tiebreak
    if (!isFinalSet) return true;

    // Final set: depends on config
    return match.config.finalSetType !== 'advantage';
}

function startTiebreak() {
    match.isTiebreak = true;
    match.tiebreakPoints = [0, 0];
    match.tiebreakFirstServer = match.server;

    // Determine tiebreak target
    const setsNeeded = Math.ceil(match.config.format / 2);
    const isFinalSet = match.setsWon[0] === setsNeeded - 1 &&
        match.setsWon[1] === setsNeeded - 1;

    if (isFinalSet && match.config.finalSetType === 'tiebreak10') {
        match.tiebreakTarget = 10;
    } else {
        match.tiebreakTarget = 7;
    }
}

function winSet(scorer) {
    const si = scorer - 1;
    match.setsWon[si]++;

    const scorerName = scorer === 1 ? match.config.player1 : match.config.player2;
    const setScore = `${match.setScores[match.currentSet][0]}-${match.setScores[match.currentSet][1]}`;
    const setsNeeded = Math.ceil(match.config.format / 2);

    // Check match win
    if (match.setsWon[si] >= setsNeeded) {
        winMatch(scorer);
        return;
    }

    // Start new set
    match.currentSet++;
    match.setScores.push([0, 0]);
    match.tiebreakFinalScores.push(null);

    // Server: after tiebreak, receiver of first tiebreak point serves
    // Otherwise, normal alternation (already handled in winGame before winSet)
    if (match.isTiebreak || match.tiebreakFinalScores[match.currentSet - 1]) {
        match.server = match.tiebreakFirstServer === 1 ? 2 : 1;
    } else {
        switchServer();
    }

    match.isTiebreak = false;
    match.tiebreakPoints = [0, 0];

    showNotification(`Set ${scorerName} ${setScore}`, true);

    // Change of ends if total games in the finished set was odd
    const prevSet = match.setScores[match.currentSet - 1];
    const totalGames = prevSet[0] + prevSet[1];
    if (totalGames % 2 === 1) {
        setTimeout(() => showNotification('換邊 Change Ends'), 2500);
    }
}

function winMatch(scorer) {
    match.matchOver = true;
    match.winner = scorer;
    match.endTime = Date.now();
    stopTimer();

    const scorerName = scorer === 1 ? match.config.player1 : match.config.player2;
    showNotification(`🏆 ${scorerName} 獲勝！`, true);

    saveToStorage();

    setTimeout(() => {
        showSummary();
    }, 2000);
}

function switchServer() {
    match.server = match.server === 1 ? 2 : 1;
}

// ==================== BREAK POINT DETECTION ====================
function isBreakPoint() {
    if (match.isTiebreak) return false;

    const receiver = match.server === 1 ? 2 : 1;
    const ri = receiver - 1;
    const si = match.server - 1;

    // Receiver at 40, server at 30 or less
    if (match.gamePoints[ri] >= 3 && match.gamePoints[si] < 3) {
        return true;
    }

    // Advantage to receiver
    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3 && match.advantage === receiver) {
        return true;
    }

    // No-Ad deuce (both at 40)
    if (match.config.deuceType === 'noAd' && match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3) {
        // In no-Ad, deuce is a break point for the receiver
        return true;
    }

    return false;
}

// ==================== UNDO ====================
function saveSnapshot() {
    const snapshot = JSON.parse(JSON.stringify(match));
    delete snapshot.history; // Don't nest history
    match.history.push(snapshot);
    // Keep max 50 history entries
    if (match.history.length > 50) {
        match.history.shift();
    }
}

function undoLastPoint() {
    if (!match || match.history.length === 0) {
        showNotification('無法復原 / Cannot undo');
        return;
    }

    const snapshot = match.history.pop();
    const currentHistory = match.history;
    Object.assign(match, snapshot);
    match.history = currentHistory;

    // Also remove last point from log
    if (match.pointLog.length > 0) {
        match.pointLog.pop();
    }

    if (match.matchOver) {
        match.matchOver = false;
        match.winner = 0;
        match.endTime = null;
        startTimer();
        showScreen('match-screen');
    }

    updateDisplay();
    saveToStorage();
    showNotification('已復原 Undo');
}

// ==================== PLAYER CARDS ====================
function updatePlayerCards() {
    // Status banner (between scoreboard and cards)
    updateStatusBanner();

    for (let p = 1; p <= 2; p++) {
        const isServing = match.server === p;
        const isReceiver = !isServing;

        // Serve indicator
        document.getElementById(`card-serve-${p}`).style.visibility = isServing ? '' : 'hidden';

        // Game score
        document.getElementById(`card-score-${p}`).textContent = getPointDisplay(p - 1);

        // Action buttons (context-aware)
        const actionsEl = document.getElementById(`card-actions-${p}`);
        let html = '';
        // [得分] — always shown
        html += `<button class="card-action normal" onclick="handleTypedScore(${p},'normal',event)">得分</button>`;
        // [得分 / 發球 ACE] — server only
        if (isServing) {
            html += `<button class="card-action ace" onclick="handleTypedScore(${p},'ace',event)">得分<br>發球 ACE</button>`;
        }
        // [得分 / 對手 DF] — receiver only
        if (isReceiver) {
            html += `<button class="card-action df" onclick="handleTypedScore(${p},'doubleFault',event)">得分<br>對手 DF</button>`;
        }
        // [得分 / 對手 UE] — both
        html += `<button class="card-action ue" onclick="handleTypedScore(${p},'unforcedError',event)">得分<br>對手 UE</button>`;
        actionsEl.innerHTML = html;
    }
}

function updateStatusBanner() {
    const banner = document.getElementById('match-status-banner');

    if (match.matchOver) {
        banner.classList.add('hidden');
        return;
    }

    // Find highest-priority status across both players
    let best = null; // { priority, text }

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
        banner.className = 'match-status-banner hidden';
    }
}

function countPointOpportunities(player) {
    const pi = player - 1;
    const oi = 1 - pi;

    if (match.isTiebreak) {
        const myPts = match.tiebreakPoints[pi];
        const oppPts = match.tiebreakPoints[oi];
        if (myPts >= match.tiebreakTarget - 1 && myPts > oppPts) {
            return myPts - oppPts;
        }
        return 0;
    }

    const myPts = match.gamePoints[pi];
    const oppPts = match.gamePoints[oi];

    // Deuce territory
    if (myPts >= 3 && oppPts >= 3) {
        if (match.advantage === player) return 1;
        if (match.config.deuceType === 'noAd' && match.advantage === 0) return 1;
        return 0;
    }

    // Player at 40, opponent below
    if (myPts >= 3 && oppPts < 3) {
        return 3 - oppPts;
    }

    return 0;
}

function isGameWinSetWin(player) {
    const pi = player - 1;
    const currentGames = match.setScores[match.currentSet];

    // In tiebreak, winning the tiebreak always wins the set
    if (match.isTiebreak) return true;

    const myGames = currentGames[pi];
    const oppGames = currentGames[1 - pi];

    // Winning this game gives myGames+1. Need 6+ games and 2-game lead, or 7 after tiebreak
    return (myGames + 1 >= 6) && (myGames + 1 - oppGames >= 2);
}

// ==================== DISPLAY ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateDisplay() {
    if (!match) return;
    updateScoreboard();
    updateTopBar();
    updatePlayerCards();
}

function updateTopBar() {
    const setNum = match.currentSet + 1;
    const setLabel = match.isTiebreak ? `Set ${setNum} · Tiebreak` : `Set ${setNum}`;
    document.getElementById('match-set-info').textContent = setLabel;

    const serverName = match.server === 1 ? match.config.player1 : match.config.player2;
    document.getElementById('match-server-info').textContent = `發球 ${serverName}`;
}

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
                // Determine if this player won this set
                const otherGames = match.setScores[s][1 - p];
                const setFinished = s < match.currentSet;
                const wonSet = setFinished && games > otherGames;

                let cellContent = `${games}`;
                // Show tiebreak score
                if (match.tiebreakFinalScores[s] && setFinished) {
                    const tbLoser = Math.min(match.tiebreakFinalScores[s][0], match.tiebreakFinalScores[s][1]);
                    if (games === 7 || (games === 6 && otherGames === 7)) {
                        // Only show tiebreak score on the 7
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

        // Current game score
        const pointDisplay = getPointDisplay(p);
        html += `<td class="game-score">${pointDisplay}</td>`;
        html += '</tr>';
    }

    html += '</tbody></table>';
    document.getElementById('scoreboard').innerHTML = html;
}

function getPointDisplay(playerIndex) {
    if (match.matchOver) return '-';

    if (match.isTiebreak) {
        return match.tiebreakPoints[playerIndex].toString();
    }

    const myPoints = match.gamePoints[playerIndex];
    const oppPoints = match.gamePoints[1 - playerIndex];

    // Deuce territory
    if (myPoints >= 3 && oppPoints >= 3) {
        if (match.advantage === 0) return '40';
        if (match.advantage === (playerIndex + 1)) return 'AD';
        return '-';
    }

    if (myPoints <= 3) {
        return POINT_DISPLAY[myPoints];
    }

    return POINT_DISPLAY[3]; // shouldn't happen
}

function getPointScoreString() {
    if (match.isTiebreak) {
        return `${match.tiebreakPoints[0]}-${match.tiebreakPoints[1]}`;
    }
    return `${getPointDisplay(0)}-${getPointDisplay(1)}`;
}


function isGamePoint() {
    if (match.isTiebreak) return false;
    const si = match.server - 1;
    // Server at 40, opponent at 30 or less
    if (match.gamePoints[si] >= 3 && match.gamePoints[1 - si] < 3) return true;
    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3 && match.advantage === match.server) return true;
    return false;
}

function isSetPoint() {
    const currentGames = match.setScores[match.currentSet];
    for (let p = 1; p <= 2; p++) {
        const pi = p - 1;
        if (currentGames[pi] >= 5 && currentGames[pi] > currentGames[1 - pi]) {
            // Player p is leading 5-x (x<5) or could win at 6-5
            if (isPlayerAboutToWinGame(p)) return true;
        }
        // In tiebreak, if someone is at tiebreak target -1 with lead
        if (match.isTiebreak) {
            const tp = match.tiebreakPoints;
            if (tp[pi] >= match.tiebreakTarget - 1 && tp[pi] > tp[1 - pi]) {
                return true;
            }
        }
    }
    return false;
}

function isMatchPoint() {
    const setsNeeded = Math.ceil(match.config.format / 2);
    for (let p = 1; p <= 2; p++) {
        if (match.setsWon[p - 1] === setsNeeded - 1 && isSetPoint()) {
            return true;
        }
    }
    return false;
}

function isPlayerAboutToWinGame(player) {
    const pi = player - 1;
    const oi = 1 - pi;

    if (match.isTiebreak) {
        return match.tiebreakPoints[pi] >= match.tiebreakTarget - 1 &&
               match.tiebreakPoints[pi] > match.tiebreakPoints[oi];
    }

    if (match.gamePoints[pi] >= 3 && match.gamePoints[oi] < 3) return true;
    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3 && match.advantage === player) return true;
    if (match.config.deuceType === 'noAd' && match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3) return true;
    return false;
}

// ==================== NOTIFICATIONS ====================
let notificationTimeout = null;

function showNotification(message, big = false) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification show' + (big ? ' big' : '');

    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, big ? 2200 : 1500);
}

// ==================== MATCH MENU ====================
function toggleMatchMenu() {
    document.getElementById('match-menu').classList.toggle('hidden');
}

function confirmEndMatch(option) {
    toggleMatchMenu();

    if (option === 0) {
        // Suspend
        if (confirm('確定要中止比賽？/ Suspend match?')) {
            match.endTime = Date.now();
            match.matchOver = true;
            match.retirement = 'suspended';
            stopTimer();
            saveToStorage();
            showSummary();
        }
    } else {
        const retiringPlayer = option === 1 ? match.config.player1 : match.config.player2;
        if (confirm(`${retiringPlayer} 退賽？/ ${retiringPlayer} retires?`)) {
            const winner = option === 1 ? 2 : 1;
            match.winner = winner;
            match.matchOver = true;
            match.retirement = option;
            match.endTime = Date.now();
            stopTimer();
            saveToStorage();
            showSummary();
        }
    }
}

// ==================== SUMMARY ====================
function showSummary() {
    renderResultCard();
    showScreen('summary-screen');
}

function renderResultCard() {
    // Date
    const date = new Date(match.startTime);
    const dateStr = date.toLocaleDateString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    document.getElementById('summary-date').textContent = dateStr;

    // Court & format
    document.getElementById('summary-court').textContent = match.config.courtType;
    const formatStr = match.config.format === 3 ? 'Best of 3' : 'Best of 5';
    document.getElementById('summary-format').textContent = formatStr;

    // Player names
    document.getElementById('summary-p1-name').textContent = match.config.player1;
    document.getElementById('summary-p2-name').textContent = match.config.player2;
    document.getElementById('stats-p1-header').textContent = match.config.player1.substring(0, 8);
    document.getElementById('stats-p2-header').textContent = match.config.player2.substring(0, 8);

    // Set scores
    let p1Sets = '', p2Sets = '';
    for (let s = 0; s < match.setScores.length; s++) {
        const g1 = match.setScores[s][0];
        const g2 = match.setScores[s][1];

        let s1 = g1.toString();
        let s2 = g2.toString();

        // Add tiebreak notation
        if (match.tiebreakFinalScores[s]) {
            const tb = match.tiebreakFinalScores[s];
            const tbLoser = Math.min(tb[0], tb[1]);
            if (g1 > g2) {
                s1 = `${g1}`;
                s2 = `${g2}(${tbLoser})`;
            } else {
                s1 = `${g1}(${tbLoser})`;
                s2 = `${g2}`;
            }
        }

        p1Sets += (p1Sets ? '  ' : '') + s1;
        p2Sets += (p2Sets ? '  ' : '') + s2;
    }

    document.getElementById('summary-p1-sets').textContent = p1Sets;
    document.getElementById('summary-p2-sets').textContent = p2Sets;

    // Winner badge
    const p1Row = document.getElementById('summary-p1-row');
    const p2Row = document.getElementById('summary-p2-row');
    const p1Badge = document.getElementById('summary-p1-badge');
    const p2Badge = document.getElementById('summary-p2-badge');

    p1Row.classList.remove('winner');
    p2Row.classList.remove('winner');
    p1Badge.classList.add('hidden');
    p2Badge.classList.add('hidden');

    if (match.winner === 1) {
        p1Row.classList.add('winner');
        p1Badge.classList.remove('hidden');
    } else if (match.winner === 2) {
        p2Row.classList.add('winner');
        p2Badge.classList.remove('hidden');
    }

    // Retirement notice
    const retEl = document.getElementById('summary-retirement');
    if (match.retirement === 'suspended') {
        retEl.textContent = '比賽中止 Match Suspended';
        retEl.classList.remove('hidden');
    } else if (match.retirement) {
        const retiree = match.retirement === 1 ? match.config.player1 : match.config.player2;
        retEl.textContent = `${retiree} 退賽 Retired`;
        retEl.classList.remove('hidden');
    } else {
        retEl.classList.add('hidden');
    }

    // Stats
    const stats = match.stats;
    const statsRows = [
        ['Aces 發球直接得分', stats.aces[0], stats.aces[1]],
        ['Double Faults 雙發失誤', stats.doubleFaults[0], stats.doubleFaults[1]],
        ['Unforced Errors 非受迫性失誤', stats.unforcedErrors[0], stats.unforcedErrors[1]],
        ['Break Points Won 破發成功',
            `${stats.breakPointsWon[0]}/${stats.breakPointsFaced[1]}`,
            `${stats.breakPointsWon[1]}/${stats.breakPointsFaced[0]}`],
        ['Total Points 總得分', stats.pointsWon[0], stats.pointsWon[1]]
    ];

    const tbody = document.getElementById('summary-stats-body');
    tbody.innerHTML = '';
    statsRows.forEach(row => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.textContent = row[0];
        const td2 = document.createElement('td');
        td2.textContent = row[1];
        const td3 = document.createElement('td');
        td3.textContent = row[2];

        // Highlight better stat
        if (typeof row[1] === 'number' && typeof row[2] === 'number') {
            const label = row[0].toLowerCase();
            if (label.includes('double') || label.includes('unforced')) {
                if (row[1] < row[2]) td2.classList.add('highlight');
                else if (row[2] < row[1]) td3.classList.add('highlight');
            } else {
                if (row[1] > row[2]) td2.classList.add('highlight');
                else if (row[2] > row[1]) td3.classList.add('highlight');
            }
        }

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
    });

    // Duration
    document.getElementById('summary-duration').textContent = `比賽時間 Duration: ${getMatchDuration()}`;

    // Umpire
    const umpireEl = document.getElementById('summary-umpire');
    if (match.config.umpire) {
        umpireEl.textContent = `裁判 Umpire: ${match.config.umpire}`;
        umpireEl.style.display = '';
    } else {
        umpireEl.style.display = 'none';
    }
}

// ==================== PDF EXPORT ====================
function exportPDF() {
    showNotification('正在產生 PDF...', false);

    // Use html2canvas to capture the result card
    const card = document.getElementById('result-card');

    html2canvas(card, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
    }).then(canvas => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - margin * 2;

        // Add result card image
        const imgData = canvas.toDataURL('image/png');
        const imgAspect = canvas.height / canvas.width;
        const imgWidth = contentWidth;
        const imgHeight = imgWidth * imgAspect;

        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));

        // Page 2: Detailed Stats
        pdf.addPage();
        let y = margin;

        pdf.setFontSize(16);
        pdf.setFont(undefined, 'bold');
        pdf.text('Match Detail Report', margin, y);
        y += 10;

        pdf.setFontSize(10);
        pdf.setFont(undefined, 'normal');

        const date = new Date(match.startTime);
        pdf.text(`Date: ${date.toLocaleDateString('en-US')}`, margin, y);
        y += 5;
        pdf.text(`Court: ${match.config.courtType}`, margin, y);
        y += 5;
        pdf.text(`Format: Best of ${match.config.format}`, margin, y);
        y += 5;
        if (match.config.umpire) {
            pdf.text(`Umpire: ${match.config.umpire}`, margin, y);
            y += 5;
        }
        pdf.text(`Duration: ${getMatchDuration()}`, margin, y);
        y += 10;

        // Score line
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        const winner = match.winner === 1 ? match.config.player1 : match.config.player2;
        const loser = match.winner === 1 ? match.config.player2 : match.config.player1;

        let scoreLine = '';
        for (let s = 0; s < match.setScores.length; s++) {
            if (scoreLine) scoreLine += '  ';
            const g1 = match.setScores[s][match.winner === 1 ? 0 : 1];
            const g2 = match.setScores[s][match.winner === 1 ? 1 : 0];
            scoreLine += `${g1}-${g2}`;
            if (match.tiebreakFinalScores[s]) {
                const tbLoser = Math.min(match.tiebreakFinalScores[s][0], match.tiebreakFinalScores[s][1]);
                scoreLine = scoreLine.slice(0, -1) + `(${tbLoser})`;
            }
        }

        pdf.text(`${winner} def. ${loser}`, margin, y);
        y += 6;
        pdf.text(scoreLine, margin, y);
        y += 10;

        if (match.retirement) {
            const retText = match.retirement === 'suspended' ? 'Match Suspended' :
                `${match.retirement === 1 ? match.config.player1 : match.config.player2} Retired`;
            pdf.setFont(undefined, 'italic');
            pdf.text(retText, margin, y);
            pdf.setFont(undefined, 'normal');
            y += 10;
        }

        // Stats table
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Statistics', margin, y);
        y += 2;

        const stats = match.stats;
        pdf.autoTable({
            startY: y,
            margin: { left: margin, right: margin },
            head: [['', match.config.player1, match.config.player2]],
            body: [
                ['Aces', stats.aces[0], stats.aces[1]],
                ['Double Faults', stats.doubleFaults[0], stats.doubleFaults[1]],
                ['Unforced Errors', stats.unforcedErrors[0], stats.unforcedErrors[1]],
                ['Break Points Won',
                    `${stats.breakPointsWon[0]}/${stats.breakPointsFaced[1]}`,
                    `${stats.breakPointsWon[1]}/${stats.breakPointsFaced[0]}`],
                ['Total Points Won', stats.pointsWon[0], stats.pointsWon[1]]
            ],
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [46, 125, 50], textColor: 255 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'center' },
                2: { halign: 'center' }
            }
        });

        y = pdf.lastAutoTable.finalY + 10;

        // Point Log Summary (game by game)
        if (match.pointLog.length > 0) {
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text('Game-by-Game Scoring', margin, y);
            y += 2;

            const gameRows = buildGameByGameData();
            pdf.autoTable({
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Set', 'Game', 'Server', 'Score', 'Result']],
                body: gameRows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [46, 125, 50], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 15, halign: 'center' },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 30, halign: 'center' },
                    4: { cellWidth: 30 }
                }
            });
        }

        // Footer
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(150);
            pdf.text(
                'Generated by MatchPoint | Made by Wayne | wayne.superwave@gmail.com',
                pageWidth / 2, pageHeight - 8,
                { align: 'center' }
            );
            pdf.text(
                `Page ${i} / ${totalPages}`,
                pageWidth - margin, pageHeight - 8,
                { align: 'right' }
            );
            pdf.setTextColor(0);
        }

        // Save
        const fileName = `MatchPoint_${match.config.player1}_vs_${match.config.player2}_${date.toISOString().slice(0, 10)}.pdf`;
        pdf.save(fileName);
        showNotification('PDF 已下載！');
    }).catch(err => {
        console.error('PDF export error:', err);
        alert('PDF 匯出失敗 / PDF export failed');
    });
}

function buildGameByGameData() {
    const rows = [];
    let currentSet = 1;
    let currentGame = '0-0';
    let gameServer = '';
    let lastGameScore = '';

    match.pointLog.forEach((point, idx) => {
        const setStr = point.set.toString();
        const gameStr = point.gameScore;

        if (gameStr !== lastGameScore || point.set !== currentSet) {
            // New game started
            const serverName = point.server === 1 ? match.config.player1 : match.config.player2;
            const gameNum = point.isTiebreak ? 'TB' : gameStr;

            // Find the end of this game
            let endScore = gameStr;
            for (let j = idx + 1; j < match.pointLog.length; j++) {
                if (match.pointLog[j].gameScore !== gameStr || match.pointLog[j].set !== point.set) {
                    endScore = match.pointLog[j].gameScore;
                    break;
                }
                if (j === match.pointLog.length - 1) {
                    // Last point in match
                    endScore = '(final)';
                }
            }

            rows.push([
                setStr,
                gameNum,
                serverName,
                `${gameStr}`,
                endScore === '(final)' ? 'Match End' : `→ ${endScore}`
            ]);

            lastGameScore = gameStr;
            currentSet = point.set;
        }
    });

    return rows;
}

// ==================== NEW MATCH ====================
function newMatch() {
    if (confirm('開始新比賽？/ Start new match?')) {
        match = null;
        stopTimer();
        localStorage.removeItem(STORAGE_KEY);
        document.getElementById('resume-banner').classList.add('hidden');
        showScreen('setup-screen');
    }
}

// ==================== LOCAL STORAGE ====================
function saveToStorage() {
    if (!match) return;
    try {
        // Save without history to reduce storage size
        const toSave = JSON.parse(JSON.stringify(match));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save match:', e);
    }
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
