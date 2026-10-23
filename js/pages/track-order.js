document.addEventListener('DOMContentLoaded', () => {
    const trackingForm = document.getElementById('trackingForm');
    if (trackingForm) {
        trackingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitTrack();
        });
    }

    const orderInput = document.getElementById('orderInput');
    const phoneInput = document.getElementById('phoneInput');

    if (orderInput) {
        orderInput.addEventListener('input', () => {
            const val = orderInput.value.trim();
            if (val.length >= 3) {
                orderInput.style.borderColor = 'var(--success-color, #10b981)';
            } else if (val.length > 0) {
                orderInput.style.borderColor = 'var(--warning-color, #f59e0b)';
            } else {
                orderInput.style.borderColor = '';
            }
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            const clean = phoneInput.value.replace(/[^0-9+]/g, '');
            if (clean !== phoneInput.value) phoneInput.value = clean;
            if (clean.length >= 9) {
                phoneInput.style.borderColor = 'var(--success-color, #10b981)';
            } else if (clean.length > 0) {
                phoneInput.style.borderColor = 'var(--warning-color, #f59e0b)';
            } else {
                phoneInput.style.borderColor = '';
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId') || urlParams.get('id');
    const phone = urlParams.get('phone');
    if (orderId && phone) {
        document.getElementById('orderInput').value = orderId;
        document.getElementById('phoneInput').value = phone;
        submitTrack();
    }
});

async function submitTrack() {
    const orderId = document.getElementById('orderInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();
    const msgBox = document.getElementById('trackingMessage');
    const resBox = document.getElementById('orderResultBox');
    const submitBtn = document.getElementById('trackSubmitBtn');

    if (!orderId || !phone) return;

    msgBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (window.I18n ? window.I18n.t('common.searching', 'جاري البحث...') : 'جاري البحث...');

    try {
        const response = await fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`);
        const data = await response.json();

        if (!response.ok) {
            msgBox.className = 'status-cancelled';
            msgBox.textContent = getErrorMessage(data, 'messages.tracking_not_found');
            msgBox.style.display = 'block';
            resBox.style.display = 'none';
            return;
        }

        const order = data.order;
        const items = data.items || [];

        // Fill UI
        document.getElementById('resOrderNumber').textContent = order.order_number || `#${order.id}`;
        document.getElementById('resOrderDate').textContent = window.I18n ? window.I18n.formatDate(order.created_at) : new Date(order.created_at).toLocaleDateString();
        document.getElementById('resWilaya').textContent = `${order.wilaya_name || order.city || (window.I18n ? window.I18n.t('wilayas.algiers', 'الجزائر') : 'الجزائر')} (${order.delivery_type === 'desk' ? (window.I18n ? window.I18n.t('invoice.desk_pickup', 'استلام من المكتب') : 'استلام من المكتب') : (window.I18n ? window.I18n.t('invoice.home_delivery', 'توصيل للمنزل') : 'توصيل للمنزل')})`;
        document.getElementById('resPaymentMethod').textContent = order.payment_method === 'chargily' ? (window.I18n ? window.I18n.t('conf.epay', 'دفع إلكتروني (بطاقة ذهبية / CIB)') : 'دفع إلكتروني (بطاقة ذهبية / CIB)') : (window.I18n ? window.I18n.t('features.cod_title', 'الدفع عند الاستلام') + ' (COD)' : 'الدفع عند الاستلام (COD)');
        document.getElementById('resOrderTotal').textContent = `${window.I18n ? window.I18n.formatNumber(order.total) : Number(order.total).toLocaleString()} ${window.I18n ? window.I18n.t('common.currency', 'د.ج') : 'د.ج'}`;

        // Status Badge & Stepper
        renderOrderStatus(order.status);

        // Items list
        const tbody = document.getElementById('resOrderItemsBody');
        tbody.innerHTML = items.map(item => {
            const safeName = window.escapeHtml ? window.escapeHtml(item.name) : item.name;
            return `
            <tr>
                <td>
                    <div class="product-cell">
                        <img src="${item.image_url || '/images/product-placeholder.jpg'}" alt="${safeName}" width="55" height="55" loading="lazy">
                        <span>${safeName}</span>
                    </div>
                </td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: left; font-weight: bold;">${window.I18n ? window.I18n.formatNumber(Number(item.price) * Number(item.quantity)) : (Number(item.price) * Number(item.quantity)).toLocaleString()} ${window.I18n ? window.I18n.t('common.currency', 'دج') : 'د.ج'}</td>
            </tr>
        `}).join('');

        // Invoice button link
        const invoicePhone = phone || '';
        const phoneParam = invoicePhone ? `&phone=${encodeURIComponent(invoicePhone)}` : '';
        document.getElementById('viewInvoiceBtn').href = `invoice.html?id=${order.id}${phoneParam}`;

        resBox.style.display = 'block';
    } catch (err) {
        msgBox.className = 'status-cancelled';
        msgBox.textContent = window.I18n ? window.I18n.t('messages.tracking_error_network', 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى.') : 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى.';
        msgBox.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-search"></i> <span data-i18n="track.submit_btn">تتبع الطلب</span>';
    }
}

function renderOrderStatus(status) {
    const badge = document.getElementById('resStatusBadge');
    const progressBar = document.getElementById('timelineProgressBar');
    const s1 = document.getElementById('stepNode1');
    const s2 = document.getElementById('stepNode2');
    const s3 = document.getElementById('stepNode3');
    const s4 = document.getElementById('stepNode4');

    [s1, s2, s3, s4].forEach(s => { s.className = 'step-node'; });

    const statusMap = {
        'pending': { text: window.I18n ? window.I18n.t('track.status_pending', 'قيد المراجعة') : 'قيد المراجعة', class: 'status-pending', width: '0%', ratio: 0, activeNode: s1 },
        'processing': { text: window.I18n ? window.I18n.t('track.status_processing', 'قيد التجهيز والتأكيد') : 'قيد التجهيز والتأكيد', class: 'status-processing', width: '33.33%', ratio: 0.3333, completedNodes: [s1], activeNode: s2 },
        'shipped': { text: window.I18n ? window.I18n.t('track.status_shipped_truck', 'تم الشحن مع الموزع 🚚') : 'تم الشحن مع الموزع 🚚', class: 'status-shipped', width: '66.66%', ratio: 0.6666, completedNodes: [s1, s2], activeNode: s3 },
        'delivered': { text: window.I18n ? window.I18n.t('track.status_delivered_check', 'تم التسليم بنجاح ✅') : 'تم التسليم بنجاح ✅', class: 'status-delivered', width: '100%', ratio: 1, completedNodes: [s1, s2, s3, s4], activeNode: null },
        'cancelled': { text: window.I18n ? window.I18n.t('track.status_cancelled_cross', 'ملغي ❌') : 'ملغي ❌', class: 'status-cancelled', width: '0%', ratio: 0, activeNode: null }
    };

    const current = statusMap[status] || statusMap['pending'];
    badge.textContent = current.text;
    badge.className = `status-badge-custom ${current.class}`;
    progressBar.style.setProperty('--progress-perc', current.width);
    progressBar.style.setProperty('--progress-ratio', current.ratio !== undefined ? current.ratio : 0);

    if (current.completedNodes) {
        current.completedNodes.forEach(node => node.classList.add('completed'));
    }
    if (current.activeNode) {
        current.activeNode.classList.add('active');
    }
}
