        let cachedOrders = [];
        let currentStatusFilter = 'all';

        document.addEventListener('DOMContentLoaded', async () => {
            const user = await AdminAuth.verifyAdmin();
            if (!user) return;

            const searchInput = document.getElementById('orderSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', AdminTable.debounce(filterOrders, 250));
            }

            loadAdminOrders();
        });

        async function loadAdminOrders() {
            try {
                const headers = AdminAuth.getHeaders(false);
                const response = await fetch('/api/orders', { credentials: 'include', headers });
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        AdminUI.showToast('يرجى تسجيل الدخول بحساب مسؤول لعرض الطلبات', 'error');
                        window.location.href = '../account.html';
                        return;
                    }
                    throw new Error('خطأ في جلب الطلبات');
                }

                cachedOrders = await response.json();
                document.getElementById('ordersCountBadge').textContent = `${cachedOrders.length} طلب`;
                filterOrders();
            } catch (error) {
                document.getElementById('admin-orders-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: red;">فشل في جلب الطلبات: ${AdminTable.escapeHtml(error.message)}</td></tr>`;
                AdminUI.showToast('فشل في جلب الطلبات', 'error');
            }
        }

        function filterByStatus(status, btn) {
            currentStatusFilter = status;
            document.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
            filterOrders();
        }

        function filterOrders() {
            const query = (document.getElementById('orderSearchInput')?.value || '').trim().toLowerCase();
            let filtered = cachedOrders;

            if (currentStatusFilter !== 'all') {
                filtered = filtered.filter(o => o.status === currentStatusFilter);
            }

            if (query) {
                filtered = filtered.filter(o => 
                    String(o.id).includes(query) ||
                    String(o.order_number || '').toLowerCase().includes(query) ||
                    String(o.shipping_full_name || '').toLowerCase().includes(query) ||
                    String(o.phone || '').includes(query) ||
                    String(o.wilaya_name || '').toLowerCase().includes(query) ||
                    String(o.city || '').toLowerCase().includes(query) ||
                    String(o.email || '').toLowerCase().includes(query) ||
                    String(o.payment_method || '').toLowerCase().includes(query) ||
                    String(o.total || '').includes(query)
                );
            }

            const countBadge = document.getElementById('ordersCountBadge');
            if (countBadge) {
                if (currentStatusFilter !== 'all' || query) {
                    countBadge.textContent = `${filtered.length} من ${cachedOrders.length} طلب`;
                } else {
                    countBadge.textContent = `${cachedOrders.length} طلب`;
                }
            }

            renderOrdersTable(filtered);
        }

        function renderOrdersTable(orders) {
            const tbody = document.getElementById('admin-orders-tbody');
            if (!tbody) return;

            if (!orders || orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 30px; color: var(--light-text, #64748b);">لا توجد طلبات مطابقة لخيارات الفرز الحالية</td></tr>';
                return;
            }

            tbody.innerHTML = orders.map(order => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td data-label="رقم الطلب" style="padding: 12px 10px; font-weight: bold; color: var(--primary-color);">
                        ${AdminTable.escapeHtml(order.order_number || '#' + order.id)}
                    </td>
                    <td data-label="العميل والهاتف" style="padding: 12px 10px;">
                        <strong class="text-slate-900 block">${AdminTable.escapeHtml(order.shipping_full_name || 'عميل #' + (order.user_id || 'ضيف'))}</strong>
                        <span style="font-size: 0.85rem; color: var(--light-text, #64748b);"><i class="fas fa-phone"></i> ${AdminTable.escapeHtml(order.phone || '-')}</span>
                    </td>
                    <td data-label="الولاية والتوصيل" style="padding: 12px 10px;">
                        <strong style="display: block;">${AdminTable.escapeHtml(order.wilaya_name || order.city || 'الجزائر')}</strong>
                        <span style="font-size: 0.85rem; color: var(--light-text, #64748b);">${order.delivery_type === 'desk' ? 'استلام مكتب' : 'توصيل منزلي'}</span>
                    </td>
                    <td data-label="الإجمالي" style="padding: 12px 10px; font-weight: bold; color: var(--success-color);">
                        ${Number(order.total).toLocaleString()} دج
                    </td>
                    <td data-label="طريقة الدفع" style="padding: 12px 10px;">
                        ${order.payment_method === 'chargily'
                            ? '<span class="pay-badge pay-card"><i class="fas fa-credit-card"></i> بطاقة ذهبية/CIB</span>'
                            : '<span class="pay-badge pay-cod"><i class="fas fa-hand-holding-usd"></i> الدفع عند الاستلام</span>'}
                    </td>
                    <td data-label="التاريخ" style="padding: 12px 10px; font-size: 0.9rem; color: var(--light-text, #64748b);">
                        ${new Date(order.created_at).toLocaleDateString('ar-DZ')}
                    </td>
                    <td data-label="الحالة" style="padding: 12px 10px;">
                        <select class="status-select ${order.status}" data-action="changeOrderStatus" data-args="${order.id}, this.value, this">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد المراجعة</option>
                            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>قيد التجهيز</option>
                            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
                            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>تم التسليم</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                        </select>
                    </td>
                    <td data-label="إجراءات" style="padding: 12px 10px; text-align: center;">
                        <button type="button" class="order-action-btn view-btn" data-action="viewOrderDetails" data-args="${order.id}" title="معاينة تفاصيل ومحتويات الطلب"><i class="fas fa-eye"></i></button>
                        <button type="button" class="order-action-btn whatsapp-btn text-whatsapp" data-action="openWhatsAppContact" data-args="${order.id}" title="مراسلة وتأكيد الطلب عبر واتساب"><i class="fab fa-whatsapp"></i></button>
                        <button type="button" class="order-action-btn text-orange" data-action="printThermalLabel" data-args="${order.id}" title="طباعة بوليصة الشحن الحرارية (Thermal Label)"><i class="fas fa-tag"></i></button>
                        <a href="../invoice.html?id=${order.id}&phone=${encodeURIComponent(order.phone || '')}" target="_blank" class="order-action-btn invoice-btn" title="طباعة الفاتورة"><i class="fas fa-file-invoice"></i></a>
                        <a href="../track-order.html?orderId=${order.id}&phone=${encodeURIComponent(order.phone || '')}" target="_blank" class="order-action-btn" title="تتبع الشحنة"><i class="fas fa-truck"></i></a>
                        <button type="button" class="order-action-btn delete-btn text-red-600" data-action="deleteAdminOrder" data-args="${order.id}" title="حذف الطلب نهائياً"><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>
            `).join('');
        }

        function exportOrdersToCsv() {
            window.open('/api/admin/orders/export', '_blank');
        }

        async function printThermalLabel(orderId) {
            try {
                const headers = AdminAuth.getHeaders(false);

                // Fetch order data and store settings in parallel
                const [orderRes, settingsRes] = await Promise.all([
                    fetch(`/api/orders/${orderId}`, { credentials: 'include', headers }),
                    fetch('/api/settings', { credentials: 'include', headers: AdminAuth.getHeaders(false) }).catch(() => null)
                ]);

                if (!orderRes.ok) throw new Error('فشل جلب بيانات بوليصة الشحن');
                const order = await orderRes.json();

                // Get store identity — API → localStorage cache → hardcoded fallback
                let storeName = 'متجر رواق';
                let storeTagline = 'خدمة التوصيل السريع لـ 58 ولاية';
                if (settingsRes && settingsRes.ok) {
                    const s = await settingsRes.json();
                    if (s.store_name)    storeName    = String(s.store_name).trim();
                    if (s.store_tagline) storeTagline = String(s.store_tagline).trim();
                } else {
                    // Fallback: try localStorage cache (set by main.js / previous visit)
                    try {
                        const cached = localStorage.getItem('store_settings_cache');
                        if (cached) {
                            const s = JSON.parse(cached);
                            if (s.store_name)    storeName    = String(s.store_name).trim();
                            if (s.store_tagline) storeTagline = String(s.store_tagline).trim();
                        }
                    } catch(e) {}
                }

                const printWindow = window.open('', '_blank', 'width=500,height=700');
                if (!printWindow) {
                    alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
                    return;
                }

                const orderNum = order.order_number || ('DZ-' + order.id);
                const customerName = order.shipping_full_name || 'العميل';
                const phone = order.phone || '-';
                const wilaya = order.wilaya_name || order.city || 'الجزائر';
                const address = order.address || '-';
                const deliveryType = order.delivery_type === 'desk' ? '🏢 استلام من المكتب (Stop Desk)' : '🏠 توصيل للمنزل (Home)';
                const total = Number(order.total || 0).toLocaleString();
                const date = new Date(order.created_at || Date.now()).toLocaleDateString('ar-DZ');

                const safeStoreName = AdminTable.escapeHtml(storeName);
                const safeStoreTagline = AdminTable.escapeHtml(storeTagline);
                const safeOrderNum = AdminTable.escapeHtml(orderNum);
                const safeCustomerName = AdminTable.escapeHtml(customerName);
                const safePhone = AdminTable.escapeHtml(phone);
                const safeWilaya = AdminTable.escapeHtml(wilaya);
                const safeAddress = AdminTable.escapeHtml(address);
                const safeDeliveryType = AdminTable.escapeHtml(deliveryType);
                const safeTotal = AdminTable.escapeHtml(total);
                const safeDate = AdminTable.escapeHtml(date);

                printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>بوليصة شحن - ${safeOrderNum}</title>
    <style>
        @page {
            size: 100mm 150mm;
            margin: 0;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        html, body {
            width: 100mm;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff;
            color: #000;
            font-size: 10.5pt;
            line-height: 1.25;
            overflow: hidden;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .label-container {
            width: 96mm;
            max-width: 96mm;
            height: 144mm;
            max-height: 144mm;
            margin: 2mm auto 0 auto;
            border: 2px solid #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 3.5mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
        }
        .header {
            border-bottom: 2px solid #000;
            padding-bottom: 2.5mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .store-title {
            font-size: 13pt;
            font-weight: 900;
        }
        .order-badge {
            border: 2px solid #000;
            padding: 2px 6px;
            font-size: 11pt;
            font-weight: bold;
        }
        .recipient-section {
            border-bottom: 2px dashed #000;
            padding: 3mm 0;
        }
        .recipient-name {
            font-size: 13pt;
            font-weight: bold;
        }
        .recipient-phone {
            font-size: 15pt;
            font-weight: 900;
            letter-spacing: 1px;
            margin: 1.5mm 0;
            background: #f0f0f0;
            padding: 2px 4px;
            display: inline-block;
        }
        .recipient-address {
            font-size: 10pt;
            font-weight: 600;
            line-height: 1.2;
            word-break: break-word;
        }
        .wilaya-box {
            font-size: 14pt;
            font-weight: 900;
            margin-bottom: 1.5mm;
        }
        .delivery-badge {
            display: inline-block;
            font-weight: bold;
            font-size: 10pt;
            margin-top: 1.5mm;
        }
        .cod-box {
            border: 2.5px solid #000;
            text-align: center;
            padding: 2.5mm;
            margin: 2.5mm 0;
            background: #fafafa;
        }
        .cod-title {
            font-size: 10pt;
            font-weight: bold;
        }
        .cod-amount {
            font-size: 18pt;
            font-weight: 900;
        }
        .barcode-area {
            text-align: center;
            font-family: monospace;
            font-size: 11pt;
            letter-spacing: 3px;
            font-weight: bold;
            padding-top: 2mm;
            border-top: 2px solid #000;
        }
        @media print {
            @page {
                size: 100mm 150mm;
                margin: 0;
            }
            html, body {
                width: 100mm !important;
                max-width: 100mm !important;
                height: 148mm !important;
                max-height: 148mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
            .label-container {
                width: 96mm !important;
                max-width: 96mm !important;
                height: 144mm !important;
                max-height: 144mm !important;
                margin: 2mm auto 0 auto !important;
                border: 2px solid #000 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                overflow: hidden !important;
            }
        }
    </style>
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 150);
        });
    <\/script>
</head>
<body><div class="label-container">
    <div class="header">
        <div>
            <div class="store-title">${safeStoreName}</div>
            <div style="font-size: 8pt;">${safeStoreTagline}</div>
        </div>
        <div class="order-badge">${safeOrderNum}</div>
    </div>

    <div class="recipient-section">
        <div style="font-size: 8.5pt; color: #555;">المستلم (Recipient):</div>
        <div class="recipient-name">${safeCustomerName}</div>
        <div class="recipient-phone" dir="ltr">${safePhone}</div>
        <div class="wilaya-box">📍 ولاية: ${safeWilaya}</div>
        <div class="recipient-address">العنوان: ${safeAddress}</div>
        <div class="delivery-badge">${safeDeliveryType}</div>
    </div>

    <div class="cod-box">
        <div class="cod-title">المبلغ المطلوب تحصيله (COD AMOUNT)</div>
        <div class="cod-amount">${safeTotal} دج</div>
    </div>

    <div class="barcode-area">
        <div style="font-size: 8pt; letter-spacing: 0; margin-bottom: 2px;">تاريخ الشحن: ${safeDate}</div>
        <div>*${safeOrderNum}*</div>
    </div>
</div></body>
</html>`);
                printWindow.document.close();
            } catch (err) {
                alert('خطأ في تحضير بوليصة الشحن: ' + err.message);
            }
        }

        async function changeOrderStatus(orderId, newStatus, selectEl) {
            try {
                if (selectEl) selectEl.disabled = true;
                const headers = AdminAuth.getHeaders(true);

                const response = await fetch(`/api/orders/${orderId}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify({ status: newStatus })
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'فشل تحديث الحالة');
                }

                if (selectEl) selectEl.className = `status-select ${newStatus}`;
                const item = cachedOrders.find(o => o.id === orderId);
                if (item) item.status = newStatus;
                AdminUI.showToast('تم تحديث حالة الطلب بنجاح', 'success');
                filterOrders();
            } catch (err) {
                AdminUI.showToast('خطأ: ' + err.message, 'error');
                loadAdminOrders();
            } finally {
                if (selectEl) selectEl.disabled = false;
            }
        }

        async function viewOrderDetails(orderId) {
            const modal = document.getElementById('orderDetailsModal');
            const content = document.getElementById('modalOrderContent');
            const title = document.getElementById('modalOrderTitle');

            modal.style.display = 'block';
            content.innerHTML = '<p style="text-align:center; padding: 30px; color: var(--light-text);"><i class="fas fa-spinner fa-spin"></i> جاري تحميل تفاصيل الطلب...</p>';

            try {
                const headers = AdminAuth.getHeaders(false);
                const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include', headers });
                if (!res.ok) throw new Error('فشل جلب تفاصيل الطلب');

                const order = await res.json();
                title.textContent = `تفاصيل الطلب: ${order.order_number || '#' + order.id}`;

                const items = order.items || [];
                const itemsHtml = items.map(item => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px; display: flex; align-items: center; gap: 10px;">
                            <img src="${AdminTable.escapeHtml(item.image_url || '../images/product-placeholder.jpg')}" alt="${AdminTable.escapeHtml(item.name)}" width="40" height="40" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
                            <strong>${AdminTable.escapeHtml(item.name)}</strong>
                        </td>
                        <td style="padding: 10px; text-align: center;">${Number(item.price).toLocaleString()} دج</td>
                        <td style="padding: 10px; text-align: center;">${item.quantity}</td>
                        <td style="padding: 10px; text-align: left; font-weight: bold; color: var(--success-color);">${(Number(item.price) * Number(item.quantity)).toLocaleString()} دج</td>
                    </tr>
                `).join('');

                content.innerHTML = `
                    <div class="info-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding: 15px; border-radius: 6px; font-size: 0.95rem;">
                        <div>
                            <p style="margin: 4px 0;"><strong>اسم العميل:</strong> ${AdminTable.escapeHtml(order.shipping_full_name || 'ضيف')}</p>
                            <p style="margin: 4px 0;"><strong>رقم الهاتف:</strong> ${AdminTable.escapeHtml(order.phone || '-')}</p>
                            <p style="margin: 4px 0;"><strong>البريد الإلكتروني:</strong> ${AdminTable.escapeHtml(order.email || '-')}</p>
                        </div>
                        <div>
                            <p style="margin: 4px 0;"><strong>الولاية والمدينة:</strong> ${AdminTable.escapeHtml(order.wilaya_name || order.city || 'الجزائر')}</p>
                            <p style="margin: 4px 0;"><strong>العنوان التفصيلي:</strong> ${AdminTable.escapeHtml(order.address || '-')}</p>
                            <p style="margin: 4px 0;"><strong>نوع التوصيل:</strong> ${order.delivery_type === 'desk' ? 'استلام من المكتب' : 'توصيل منزلي'}</p>
                        </div>
                    </div>

                    <h3 style="font-size: 1.1rem; margin-bottom: 10px;">عناصر الطلب</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                        <thead>
                            <tr class="table-alt-row-sm">
                                <th style="padding: 8px 10px;">المنتج</th>
                                <th style="padding: 8px 10px; text-align: center;">السعر الفردي</th>
                                <th style="padding: 8px 10px; text-align: center;">الكمية</th>
                                <th style="padding: 8px 10px; text-align: left;">المجموع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding: 15px;">لا توجد عناصر</td></tr>'}
                        </tbody>
                    </table>

                    <div class="summary-box-success" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-radius: 6px;">
                        <div>
                            <span style="font-size: 0.9rem;"><strong>طريقة الدفع:</strong> ${order.payment_method === 'chargily' ? '<span class="pay-badge pay-card"><i class="fas fa-credit-card"></i> بطاقة بنكية (Chargily)</span>' : '<span class="pay-badge pay-cod"><i class="fas fa-hand-holding-usd"></i> الدفع عند الاستلام (COD)</span>'}</span>
                        </div>
                        <div>
                            <strong style="font-size: 1.15rem;">الإجمالي الكلي: ${Number(order.total).toLocaleString()} دج</strong>
                        </div>
                    </div>
                `;
            } catch(err) {
                content.innerHTML = `<p style="text-align:center; padding: 20px; color: red;">فشل جلب تفاصيل الطلب: ${AdminTable.escapeHtml(err.message)}</p>`;
            }
        }

        function closeOrderDetailsModal() {
            document.getElementById('orderDetailsModal').style.display = 'none';
        }

        function openWhatsAppContact(phoneOrId, orderNum, customerName, total) {
            let phone = phoneOrId;
            if (typeof phoneOrId === 'number' || (typeof phoneOrId === 'string' && /^\d+$/.test(phoneOrId) && !phoneOrId.startsWith('0') && !phoneOrId.startsWith('213'))) {
                const o = (cachedOrders || []).find(x => x.id === Number(phoneOrId));
                if (o) {
                    phone = o.phone;
                    orderNum = o.order_number || ('DZ-' + o.id);
                    customerName = o.shipping_full_name;
                    total = o.total;
                }
            }

            if (!phone || phone === '-' || phone === 'undefined') {
                AdminUI.showToast('رقم هاتف العميل غير متوفر لهذا الطلب', 'warning');
                return;
            }

            let cleanPhone = String(phone).replace(/[\s\-\+\(\)]/g, '');
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '213' + cleanPhone.substring(1);
            } else if (!cleanPhone.startsWith('213')) {
                cleanPhone = '213' + cleanPhone;
            }

            const greeting = customerName ? `الأستاذ(ة) ${customerName}` : 'عزيزي العميل';
            let sName = 'متجر رواق';
            try {
                const cached = localStorage.getItem('store_settings_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.store_name) sName = parsed.store_name.trim();
                }
            } catch (e) {}
            const msg = `مرحباً ${greeting} 👋\nنتواصل معك من ${sName} بخصوص طلبك رقم (${orderNum}) بمبلغ ${Number(total).toLocaleString()} دج.\nهل تؤكد رغبتك في شحن وتوصيل الطلب إلى عنوانك؟`;

            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        }

        async function deleteAdminOrder(orderId, orderNum) {
            if (!orderNum) {
                const o = (cachedOrders || []).find(x => x.id === orderId);
                orderNum = o ? (o.order_number || '#' + o.id) : ('#' + orderId);
            }
            const confirmed = await AdminUI.confirm(`هل أنت متأكد من رغبتك في حذف الطلب (${orderNum}) نهائياً؟ سيتم إلغاء الطلب واسترجاع المخزون تلقائياً.`, 'تأكيد حذف الطلب');
            if (!confirmed) return;

            try {
                const headers = AdminAuth.getHeaders(true);
                const res = await fetch(`/api/orders/${orderId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || 'فشل حذف الطلب');
                }

                AdminUI.showToast('تم حذف الطلب بنجاح', 'success');
                await loadAdminOrders();
            } catch (err) {
                AdminUI.showToast(err.message || 'فشل حذف الطلب', 'error');
            }
        }

        function resetOrdersFilters() {
            const searchInput = document.getElementById('orderSearchInput');
            if (searchInput) searchInput.value = '';
            currentStatusFilter = 'all';
            document.querySelectorAll('.status-tab-btn').forEach(b => {
                if (b.dataset.args && b.dataset.args.includes("'all'")) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            filterOrders();
        }

// Expose admin order functions globally for data-action delegation
window.filterByStatus = filterByStatus;
window.filterOrders = filterOrders;
window.resetOrdersFilters = resetOrdersFilters;
window.changeOrderStatus = changeOrderStatus;
window.viewOrderDetails = viewOrderDetails;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.openWhatsAppContact = openWhatsAppContact;
window.printThermalLabel = printThermalLabel;
window.exportOrdersToCsv = exportOrdersToCsv;
window.deleteAdminOrder = deleteAdminOrder;
    
