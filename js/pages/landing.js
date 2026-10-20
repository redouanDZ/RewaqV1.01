
        function selectPackage(packageName) {
            const selectEl = document.getElementById('orderPackage');
            if (selectEl) {
                selectEl.value = packageName;
            }
        }

        function handleLandingOrder(e) {
            e.preventDefault();
            const fullName = document.getElementById('orderFullName').value.trim();
            const phone = document.getElementById('orderPhone').value.trim();
            const wilaya = document.getElementById('orderWilaya').value.trim();
            const selectedPackage = document.getElementById('orderPackage').value;
            const storeType = document.getElementById('orderStoreType').value.trim();
            const notes = document.getElementById('orderNotes').value.trim();

            const message = `مرحباً، أود طلب متجر إلكتروني (متجر رواق برو) التفاصيل كالتالي:\n\n` +
                            `👤 الاسم: ${fullName}\n` +
                            `📞 الهاتف: ${phone}\n` +
                            `📍 الولاية: ${wilaya}\n` +
                            `📦 الباقة المطلوبة: ${selectedPackage}\n` +
                            (storeType ? `🏷️ نوع النشاط: ${storeType}\n` : '') +
                            (notes ? `📝 ملاحظات: ${notes}\n` : '') +
                            `\nأرجو تزويدي بكيفية الدفع وبدء التنفيذ. شكراً!`;

            // Store admin WhatsApp number
            const targetPhone = '213669754875';
            const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
        }
    

// Event Delegation
document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'selectPackage') {
        e.preventDefault();
        let args = [];
        if (actionEl.dataset.args) {
            try {
                args = actionEl.dataset.args.split(',').map(s => {
                    s = s.trim();
                    if (s === 'this') return actionEl;
                    if (s === 'this.value') return actionEl.value;
                    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
                    if (s.startsWith("&quot;") && s.endsWith("&quot;")) return s.slice(6, -6);
                    if (!isNaN(s) && s !== '') return Number(s);
                    return s;
                });
            } catch(err) {}
        }
        if (typeof window.selectPackage === 'function') window.selectPackage(...args);
    }
});

document.addEventListener('submit', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'handleLandingOrder') {
        e.preventDefault();
        if (typeof window.handleLandingOrder === 'function') window.handleLandingOrder(e);
    }
});


// Capture image load errors
document.addEventListener('error', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
        if (e.target.src !== window.location.origin + '/images/product-placeholder.jpg') {
            e.target.onerror = null;
            e.target.src = '/images/product-placeholder.jpg';
        }
    }
}, true);

// Expose functions to window
window.selectPackage = selectPackage;
window.handleLandingOrder = handleLandingOrder;
