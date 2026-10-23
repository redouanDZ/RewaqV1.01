async function loadOrderConfirmation() {
            const urlParams = new URLSearchParams(window.location.search);
            const orderId = urlParams.get('id') || localStorage.getItem('lastOrderId');
            const token = urlParams.get('token') || localStorage.getItem('lastOrderToken');
            const phone = urlParams.get('phone') || localStorage.getItem('lastOrderPhone');

            if (!orderId) return;

            const t = (key, fallback) => (window.I18n && typeof window.I18n.t === 'function') ? window.I18n.t(key, fallback) : fallback;

            try {
                let fetchUrl = `/api/orders/${orderId}`;
                const q = [];
                if (token) q.push(`token=${encodeURIComponent(token)}`);
                if (phone) q.push(`phone=${encodeURIComponent(phone)}`);
                if (q.length) fetchUrl += `?${q.join('&')}`;

                const headers = {};
                if (token) headers['X-Tracking-Token'] = token;
                if (phone) headers['X-Verification-Phone'] = phone;

                const response = await fetch(fetchUrl, { credentials: 'include', headers });
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(getErrorMessage(errData, 'messages.fetch_order_fail'));
                }
                const order = await response.json();

                // Fill details
                document.getElementById('confOrderNumber').textContent = order.order_number || `#${order.id}`;
                document.getElementById('confOrderDate').textContent = window.I18n ? window.I18n.formatDate(order.created_at || Date.now()) : new Date(order.created_at || Date.now()).toLocaleDateString();
                document.getElementById('confPaymentMethod').textContent = order.payment_method === 'chargily' ? t('conf.epay', 'دفع إلكتروني (بطاقة ذهبية / CIB)') : t('features.cod_title', 'الدفع عند الاستلام') + ' (COD)';
                document.getElementById('confCustomerName').textContent = order.shipping_full_name || t('product.store_customer', 'عميل المتجر');
                document.getElementById('confWilaya').textContent = `${order.wilaya_name || order.city || t('wilayas.algiers', 'الجزائر')} (${order.delivery_type === 'desk' ? t('checkout.desk_delivery', 'مكتب') : t('checkout.home_delivery', 'منزل')})`;

                // Status Badge
                const badge = document.getElementById('confStatusBadge');
                const statusMap = {
                    'pending': { text: t('conf.status_pending', 'قيد المعالجة'), class: 'status-pending' },
                    'processing': { text: t('conf.status_processing', 'قيد التجهيز والتأكيد'), class: 'status-processing' },
                    'shipped': { text: t('conf.status_shipped', 'تم الشحن'), class: 'status-shipped' },
                    'delivered': { text: t('conf.status_delivered', 'تم التسليم بنجاح'), class: 'status-delivered' }
                };
                const st = statusMap[order.status] || { text: order.status, class: 'status-pending' };
                badge.textContent = st.text;
                badge.className = `status-badge-custom ${st.class}`;

                // Items
                const items = order.items || [];
                let subtotal = 0;
                const itemsContainer = document.getElementById('confOrderItemsList');
                itemsContainer.innerHTML = items.map(item => {
                    const lineTotal = Number(item.price) * Number(item.quantity);
                    subtotal += lineTotal;
                    const safeName = window.escapeHtml ? window.escapeHtml(item.name) : item.name;
                    return `
                        <div class="order-item-card">
                            <div class="item-info-wrapper">
                                <img src="${item.image_url || '/images/product-placeholder.jpg'}" alt="${safeName}" width="55" height="55" loading="lazy">
                                <div>
                                    <strong style="display: block; color: var(--text-color);">${safeName}</strong>
                                    <span style="font-size: 0.85rem; color: var(--light-text);">${t('cart.item_qty', 'الكمية: {qty}').replace('{qty}', item.quantity)}</span>
                                </div>
                            </div>
                            <strong style="color: var(--primary-color);">${window.I18n ? window.I18n.formatNumber(lineTotal) : lineTotal.toLocaleString()} ${t('common.currency', 'دج')}</strong>
                        </div>
                    `;
                }).join('');

                const shipping = Number(order.shipping_cost || 0);
                const total = Number(order.total || (subtotal + shipping));
                const discount = Math.max(0, subtotal + shipping - total);

                document.getElementById('confSubtotal').textContent = `${window.I18n ? window.I18n.formatNumber(subtotal) : subtotal.toLocaleString()} ${t('common.currency', 'دج')}`;
                document.getElementById('confShipping').textContent = `${window.I18n ? window.I18n.formatNumber(shipping) : shipping.toLocaleString()} ${t('common.currency', 'دج')}`;
                document.getElementById('confTotal').textContent = `${window.I18n ? window.I18n.formatNumber(total) : total.toLocaleString()} ${t('common.currency', 'دج')}`;

                const discRow = document.getElementById('confDiscountRow');
                const discEl = document.getElementById('confDiscount');
                if (discount > 0 && discRow && discEl) {
                    discRow.style.display = 'flex';
                    discEl.textContent = `-${window.I18n ? window.I18n.formatNumber(discount) : discount.toLocaleString()} ${t('common.currency', 'دج')}`;
                }

                // Set Action Links
                const custPhone = order.phone || phone || '';
                document.getElementById('trackOrderBtn').href = `track-order.html?orderId=${order.id}&phone=${encodeURIComponent(custPhone)}`;
                document.getElementById('viewInvoiceBtn').href = `invoice.html?id=${order.id}&phone=${encodeURIComponent(custPhone)}&token=${token || ''}`;

                if (window.I18n && typeof window.I18n.translatePage === 'function') {
                    window.I18n.translatePage();
                }
            } catch (err) {
                console.error('Confirmation load error:', err);
            }
        }

        document.addEventListener('DOMContentLoaded', loadOrderConfirmation);

// Expose function to window
window.loadOrderConfirmation = loadOrderConfirmation;
