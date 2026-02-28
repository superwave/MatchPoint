/* ============================================
   Toast Notifications
   ============================================ */

let notificationTimeout = null;

export function showNotification(message, big = false) {
    const el = document.getElementById('notification');
    el.textContent = message;
    el.className = 'notification show' + (big ? ' big' : '');

    if (notificationTimeout) clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, big ? 2200 : 1500);
}
