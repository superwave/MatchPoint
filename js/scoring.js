/* ============================================
   Scoring Engine
   ============================================ */

import { match, saveSnapshot, getPointScoreString } from './state.js';
import { stopTimer } from './timer.js';
import { showNotification } from './notifications.js';

// ==================== MAIN SCORING ====================

/**
 * Score a point. Returns { matchOver: boolean }.
 * Caller (app.js) is responsible for updateDisplay() and saveToStorage().
 */
export function scorePoint(scorer, type) {
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

    return { matchOver: match.matchOver };
}

// ==================== NORMAL GAME SCORING ====================

function scoreNormalGamePoint(scorer) {
    const si = scorer - 1;

    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3) {
        if (match.config.deuceType === 'noAd') {
            winGame(scorer);
            return;
        }
        if (match.advantage === 0) {
            match.advantage = scorer;
        } else if (match.advantage === scorer) {
            winGame(scorer);
        } else {
            match.advantage = 0;
        }
        return;
    }

    match.gamePoints[si]++;

    if (match.gamePoints[si] > 3) {
        winGame(scorer);
    }
}

// ==================== TIEBREAK SCORING ====================

function scoreTiebreakPoint(scorer) {
    const si = scorer - 1;
    match.tiebreakPoints[si]++;

    const p1 = match.tiebreakPoints[0];
    const p2 = match.tiebreakPoints[1];
    const total = p1 + p2;
    const target = match.tiebreakTarget;

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

// ==================== WIN GAME / SET / MATCH ====================

function winGame(scorer) {
    const si = scorer - 1;
    const currentSetGames = match.setScores[match.currentSet];

    if (match.isTiebreak) {
        match.tiebreakFinalScores[match.currentSet] = [
            match.tiebreakPoints[0],
            match.tiebreakPoints[1]
        ];
    }

    currentSetGames[si]++;

    const scorerName = scorer === 1 ? match.config.player1 : match.config.player2;
    const receiver = match.server === 1 ? 2 : 1;
    const isBreak = !match.isTiebreak && scorer === receiver;

    // Reset game state
    match.gamePoints = [0, 0];
    match.advantage = 0;
    const wasTiebreak = match.isTiebreak;
    match.isTiebreak = false;
    match.tiebreakPoints = [0, 0];

    const g1 = currentSetGames[0];
    const g2 = currentSetGames[1];

    if (checkSetWin(g1, g2)) {
        winSet(scorer);
        return;
    }

    if (g1 === 6 && g2 === 6) {
        if (shouldPlayTiebreak()) {
            startTiebreak();
            showNotification(`搶${match.tiebreakTarget} Tiebreak`, true);
            return;
        }
    }

    if (!wasTiebreak) {
        switchServer();
    } else {
        match.server = match.tiebreakFirstServer === 1 ? 2 : 1;
    }

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
    if (g1 >= 6 && g1 - g2 >= 2) return true;
    if (g2 >= 6 && g2 - g1 >= 2) return true;
    if ((g1 === 7 && g2 === 6) || (g1 === 6 && g2 === 7)) return true;
    return false;
}

function shouldPlayTiebreak() {
    const setsNeeded = Math.ceil(match.config.format / 2);
    const isFinalSet = match.setsWon[0] === setsNeeded - 1 &&
        match.setsWon[1] === setsNeeded - 1;

    if (!isFinalSet) return true;

    return match.config.finalSetType !== 'advantage';
}

function startTiebreak() {
    match.isTiebreak = true;
    match.tiebreakPoints = [0, 0];
    match.tiebreakFirstServer = match.server;

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

    if (match.setsWon[si] >= setsNeeded) {
        winMatch(scorer);
        return;
    }

    // Start new set
    match.currentSet++;
    match.setScores.push([0, 0]);
    match.tiebreakFinalScores.push(null);

    if (match.isTiebreak || match.tiebreakFinalScores[match.currentSet - 1]) {
        match.server = match.tiebreakFirstServer === 1 ? 2 : 1;
    } else {
        switchServer();
    }

    match.isTiebreak = false;
    match.tiebreakPoints = [0, 0];

    showNotification(`Set ${scorerName} ${setScore}`, true);

    const prevSet = match.setScores[match.currentSet - 1];
    const totalGames = prevSet[0] + prevSet[1];
    if (totalGames % 2 === 1) {
        setTimeout(() => showNotification('換邊 Change Ends'), 2500);
    }
}

/**
 * winMatch: sets matchOver/winner/endTime, stops timer.
 * Does NOT call saveToStorage or showSummary — caller handles that.
 */
function winMatch(scorer) {
    match.matchOver = true;
    match.winner = scorer;
    match.endTime = Date.now();
    stopTimer();

    const scorerName = scorer === 1 ? match.config.player1 : match.config.player2;
    showNotification(`🏆 ${scorerName} 獲勝！`, true);
}

function switchServer() {
    match.server = match.server === 1 ? 2 : 1;
}

// ==================== DETECTION FUNCTIONS (exported for display.js) ====================

export function isBreakPoint() {
    if (match.isTiebreak) return false;

    const receiver = match.server === 1 ? 2 : 1;
    const ri = receiver - 1;
    const si = match.server - 1;

    if (match.gamePoints[ri] >= 3 && match.gamePoints[si] < 3) {
        return true;
    }

    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3 && match.advantage === receiver) {
        return true;
    }

    if (match.config.deuceType === 'noAd' && match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3) {
        return true;
    }

    return false;
}

export function isPlayerAboutToWinGame(player) {
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

export function countPointOpportunities(player) {
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

    if (myPts >= 3 && oppPts >= 3) {
        if (match.advantage === player) return 1;
        if (match.config.deuceType === 'noAd' && match.advantage === 0) return 1;
        return 0;
    }

    if (myPts >= 3 && oppPts < 3) {
        return 3 - oppPts;
    }

    return 0;
}

export function isGameWinSetWin(player) {
    const pi = player - 1;
    const currentGames = match.setScores[match.currentSet];

    if (match.isTiebreak) return true;

    const myGames = currentGames[pi];
    const oppGames = currentGames[1 - pi];

    return (myGames + 1 >= 6) && (myGames + 1 - oppGames >= 2);
}

export function isGamePoint() {
    if (match.isTiebreak) return false;
    const si = match.server - 1;
    if (match.gamePoints[si] >= 3 && match.gamePoints[1 - si] < 3) return true;
    if (match.gamePoints[0] >= 3 && match.gamePoints[1] >= 3 && match.advantage === match.server) return true;
    return false;
}

export function isSetPoint() {
    const currentGames = match.setScores[match.currentSet];
    for (let p = 1; p <= 2; p++) {
        const pi = p - 1;
        if (currentGames[pi] >= 5 && currentGames[pi] > currentGames[1 - pi]) {
            if (isPlayerAboutToWinGame(p)) return true;
        }
        if (match.isTiebreak) {
            const tp = match.tiebreakPoints;
            if (tp[pi] >= match.tiebreakTarget - 1 && tp[pi] > tp[1 - pi]) {
                return true;
            }
        }
    }
    return false;
}

export function isMatchPoint() {
    const setsNeeded = Math.ceil(match.config.format / 2);
    for (let p = 1; p <= 2; p++) {
        if (match.setsWon[p - 1] === setsNeeded - 1 && isSetPoint()) {
            return true;
        }
    }
    return false;
}
