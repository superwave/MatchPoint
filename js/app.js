/* ============================================
   MatchPoint - Entry Point & Event Bindings
   ============================================ */

import { match, setMatch, clearMatch, initMatchState, saveToStorage, checkSavedMatch, STORAGE_KEY } from './state.js';
import { startTimer, stopTimer } from './timer.js';
import { showNotification } from './notifications.js';
import { scorePoint } from './scoring.js';
import { showScreen, updateDisplay } from './display.js';
import { showSummary } from './summary.js';
import { exportImage } from './pdf.js';

// ==================== SCORING FLOW ====================

function handleTypedScore(player, type, event) {
    if (event) event.stopPropagation();
    if (!match || match.matchOver) return;

    let scorer, scoreType;
    if (type === 'ace') {
        scorer = match.server;
        scoreType = 'ace';
    } else if (type === 'doubleFault') {
        scorer = match.server === 1 ? 2 : 1;
        scoreType = 'doubleFault';
    } else if (type === 'unforcedError') {
        scorer = player;
        scoreType = 'unforcedError';
    } else {
        scorer = player;
        scoreType = 'normal';
    }

    const result = scorePoint(scorer, scoreType);
    updateDisplay();
    saveToStorage();

    // Flash the scoring player's card
    const card = document.getElementById(`player-card-${player}`);
    card.classList.remove('card-flash');
    void card.offsetWidth; // force reflow
    card.classList.add('card-flash');

    if (result.matchOver) {
        setTimeout(() => {
            showSummary();
        }, 2000);
    }
}

// ==================== UNDO ====================

function undoLastPoint() {
    if (!match || match.history.length === 0) {
        showNotification('無法復原 / Cannot undo');
        return;
    }

    const snapshot = match.history.pop();
    const currentHistory = match.history;
    Object.assign(match, snapshot);
    match.history = currentHistory;

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
    setMatch(initMatchState(config));

    document.getElementById('card-name-1').textContent = config.player1;
    document.getElementById('card-name-2').textContent = config.player2;
    document.getElementById('match-screen').setAttribute('data-court', config.courtType);

    startTimer();
    updateDisplay();
    saveToStorage();
}

// ==================== RESUME / DISCARD ====================

function resumeMatch() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            setMatch(JSON.parse(saved));
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

// ==================== MATCH MENU ====================

function toggleMatchMenu() {
    document.getElementById('match-menu').classList.toggle('hidden');
}

function confirmEndMatch(option) {
    toggleMatchMenu();

    if (option === 0) {
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

// ==================== NEW MATCH ====================

function newMatch() {
    if (confirm('開始新比賽？/ Start new match?')) {
        clearMatch();
        stopTimer();
        localStorage.removeItem(STORAGE_KEY);
        document.getElementById('resume-banner').classList.add('hidden');
        showScreen('setup-screen');
    }
}

// ==================== INSTALL (Add to Home Screen) ====================

let deferredInstallPrompt = null;

function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'ios';
    }
    if (/Android/.test(ua)) return 'android';
    return 'other';
}

function setupInstallPrompt() {
    if (isStandalone()) return; // Already installed

    const installPrompt = document.getElementById('install-prompt');
    const btnInstall = document.getElementById('btn-install');
    const modal = document.getElementById('install-modal');
    const modalOverlay = document.getElementById('install-modal-overlay');
    const btnClose = document.getElementById('btn-install-close');
    const instructions = document.getElementById('install-instructions');
    const platform = detectPlatform();

    // Listen for Android native install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        installPrompt.classList.remove('hidden');
    });

    // Show button on iOS / other (no beforeinstallprompt)
    if (platform === 'ios' || platform === 'other') {
        installPrompt.classList.remove('hidden');
    }

    btnInstall.addEventListener('click', () => {
        if (deferredInstallPrompt) {
            // Android native prompt
            deferredInstallPrompt.prompt();
            deferredInstallPrompt.userChoice.then(() => {
                deferredInstallPrompt = null;
                installPrompt.classList.add('hidden');
            });
        } else {
            // Show manual instructions
            if (platform === 'ios') {
                instructions.innerHTML = `<ol class="install-steps">
                    <li>1. 點擊 Safari 底部的 <strong>分享按鈕</strong> ⬆️</li>
                    <li>2. 向下滑動，選擇 <strong>「加入主畫面」</strong></li>
                    <li>3. 點擊右上角 <strong>「新增」</strong></li>
                </ol>`;
            } else {
                instructions.innerHTML = `<ol class="install-steps">
                    <li>1. 點擊瀏覽器右上角 <strong>選單 ⋮</strong></li>
                    <li>2. 選擇 <strong>「加入主畫面」</strong>或<strong>「安裝應用程式」</strong></li>
                    <li>3. 確認安裝</li>
                </ol>`;
            }
            modal.classList.remove('hidden');
        }
    });

    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    modalOverlay.addEventListener('click', () => modal.classList.add('hidden'));

    // Hide after installed
    window.addEventListener('appinstalled', () => {
        installPrompt.classList.add('hidden');
    });
}

// ==================== EVENT BINDINGS ====================

document.addEventListener('DOMContentLoaded', () => {
    // Check saved match on load
    const saved = checkSavedMatch();
    if (saved) {
        document.getElementById('resume-banner').classList.remove('hidden');
    }

    // Setup form
    const setupForm = document.getElementById('setup-form');
    setupForm.addEventListener('submit', handleSetupSubmit);

    // Player name inputs → update first server options
    document.getElementById('player1-name').addEventListener('input', updateFirstServerOptions);
    document.getElementById('player2-name').addEventListener('input', updateFirstServerOptions);

    // Resume / Discard buttons
    document.getElementById('btn-resume').addEventListener('click', resumeMatch);
    document.getElementById('btn-discard').addEventListener('click', discardSavedMatch);

    // Match topbar: Undo + Menu
    document.getElementById('btn-undo').addEventListener('click', undoLastPoint);
    document.getElementById('btn-menu-toggle').addEventListener('click', toggleMatchMenu);

    // Match menu overlay (click to close)
    document.getElementById('menu-overlay').addEventListener('click', toggleMatchMenu);

    // Match menu buttons (end match options)
    document.querySelectorAll('[data-end-match]').forEach(btn => {
        btn.addEventListener('click', () => {
            const option = parseInt(btn.getAttribute('data-end-match'));
            confirmEndMatch(option);
        });
    });

    // Menu cancel button
    document.getElementById('btn-menu-cancel').addEventListener('click', toggleMatchMenu);

    // Scoring area: event delegation for dynamic buttons
    document.querySelector('.scoring-area').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-player][data-type]');
        if (!btn) return;
        const player = parseInt(btn.getAttribute('data-player'));
        const type = btn.getAttribute('data-type');
        handleTypedScore(player, type, e);
    });

    // Summary actions
    document.getElementById('btn-export-pdf').addEventListener('click', exportImage);
    document.getElementById('btn-new-match').addEventListener('click', newMatch);

    // Install prompt
    setupInstallPrompt();
});
