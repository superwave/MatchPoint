/* ============================================
   Image Export (Save to Camera Roll)
   ============================================ */

import { match } from './state.js';
import { showNotification } from './notifications.js';

// ==================== EXPORT IMAGE ====================

export function exportImage() {
    showNotification('正在產生圖片...');

    const card = document.getElementById('result-card');

    html2canvas(card, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) {
                alert('圖片產生失敗 / Image export failed');
                return;
            }

            // Try Web Share API (best for mobile — saves to Photos directly)
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], getFileName(), { type: 'image/png' });
                const shareData = { files: [file] };

                if (navigator.canShare(shareData)) {
                    navigator.share(shareData)
                        .then(() => showNotification('已分享！'))
                        .catch(err => {
                            // User cancelled or share failed — fallback to download
                            if (err.name !== 'AbortError') {
                                downloadBlob(blob);
                            }
                        });
                    return;
                }
            }

            // Fallback: direct download
            downloadBlob(blob);
        }, 'image/png');
    }).catch(err => {
        console.error('Image export error:', err);
        alert('圖片產生失敗 / Image export failed');
    });
}

function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('圖片已儲存！');
}

function getFileName() {
    const date = new Date(match.startTime);
    return `MatchPoint_${match.config.player1}_vs_${match.config.player2}_${date.toISOString().slice(0, 10)}.png`;
}
