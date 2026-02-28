/* ============================================
   Match Timer
   ============================================ */

import { match } from './state.js';

let timerInterval = null;

function pad(n) {
    return n.toString().padStart(2, '0');
}

export function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
}

export function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

export function updateTimerDisplay() {
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

export function getMatchDuration() {
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
