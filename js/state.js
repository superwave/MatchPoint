/* ============================================
   State Management & Pure Utilities
   ============================================ */

// ==================== CONSTANTS ====================
export const POINT_DISPLAY = ['0', '15', '30', '40'];
export const STORAGE_KEY = 'matchpoint_match';

// ==================== STATE ====================
export let match = null;

export function setMatch(value) {
    match = value;
}

export function clearMatch() {
    match = null;
}

// ==================== MATCH INITIALIZATION (pure state, no DOM) ====================
export function initMatchState(config) {
    return {
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
}

// ==================== SNAPSHOT & STORAGE ====================
export function saveSnapshot() {
    const snapshot = JSON.parse(JSON.stringify(match));
    delete snapshot.history;
    match.history.push(snapshot);
    if (match.history.length > 50) {
        match.history.shift();
    }
}

export function saveToStorage() {
    if (!match) return;
    try {
        const toSave = JSON.parse(JSON.stringify(match));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save match:', e);
    }
}

export function checkSavedMatch() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && !parsed.matchOver) {
                return parsed;
            }
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    return null;
}

// ==================== PURE STATE READERS ====================
export function getPointDisplay(playerIndex) {
    if (match.matchOver) return '-';

    if (match.isTiebreak) {
        return match.tiebreakPoints[playerIndex].toString();
    }

    const myPoints = match.gamePoints[playerIndex];
    const oppPoints = match.gamePoints[1 - playerIndex];

    if (myPoints >= 3 && oppPoints >= 3) {
        if (match.advantage === 0) return '40';
        if (match.advantage === (playerIndex + 1)) return 'AD';
        return '-';
    }

    if (myPoints <= 3) {
        return POINT_DISPLAY[myPoints];
    }

    return POINT_DISPLAY[3];
}

export function getPointScoreString() {
    if (match.isTiebreak) {
        return `${match.tiebreakPoints[0]}-${match.tiebreakPoints[1]}`;
    }
    return `${getPointDisplay(0)}-${getPointDisplay(1)}`;
}

// ==================== UTILITIES ====================
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
