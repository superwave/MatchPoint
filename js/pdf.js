/* ============================================
   PDF Export
   ============================================ */

import { match } from './state.js';
import { getMatchDuration } from './timer.js';
import { showNotification } from './notifications.js';

// ==================== EXPORT PDF ====================

export function exportPDF() {
    showNotification('正在產生 PDF...', false);

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

// ==================== GAME-BY-GAME DATA ====================

function buildGameByGameData() {
    const rows = [];
    let currentSet = 1;
    let lastGameScore = '';

    match.pointLog.forEach((point, idx) => {
        const gameStr = point.gameScore;

        if (gameStr !== lastGameScore || point.set !== currentSet) {
            const serverName = point.server === 1 ? match.config.player1 : match.config.player2;
            const gameNum = point.isTiebreak ? 'TB' : gameStr;

            let endScore = gameStr;
            for (let j = idx + 1; j < match.pointLog.length; j++) {
                if (match.pointLog[j].gameScore !== gameStr || match.pointLog[j].set !== point.set) {
                    endScore = match.pointLog[j].gameScore;
                    break;
                }
                if (j === match.pointLog.length - 1) {
                    endScore = '(final)';
                }
            }

            rows.push([
                point.set.toString(),
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
