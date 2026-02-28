/* ============================================
   Post-Match Summary Screen
   ============================================ */

import { match } from './state.js';
import { getMatchDuration } from './timer.js';
import { showScreen } from './display.js';

// ==================== SHOW SUMMARY ====================

export function showSummary() {
    renderResultCard();
    showScreen('summary-screen');
}

// ==================== RENDER RESULT CARD ====================

function renderResultCard() {
    // Date
    const date = new Date(match.startTime);
    const dateStr = date.toLocaleDateString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    document.getElementById('summary-date').textContent = dateStr;

    // Court & format (Chinese)
    const courtMap = { Hard: '硬地', Clay: '紅土', Grass: '草地', Carpet: '地毯', Indoor: '室內' };
    document.getElementById('summary-court').textContent = courtMap[match.config.courtType] || match.config.courtType;
    const formatStr = match.config.format === 1 ? '一盤決勝' : match.config.format === 3 ? '三盤兩勝' : '五盤三勝';
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
