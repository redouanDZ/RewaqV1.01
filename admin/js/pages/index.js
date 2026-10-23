let ordersChartInstance = null;
        let statusChartInstance = null;

        async function loadAdminDashboard() {
            const user = await AdminAuth.verifyAdmin();
            if (!user) return;

            document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            try {
                const headers = AdminAuth.getHeaders(false);
                const res = await fetch('/api/admin/dashboard-stats', { credentials: 'include', headers });
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        AdminUI.showToast('يرجى تسجيل الدخول بحساب مسؤول', 'error');
                        window.location.href = '../account.html';
                        return;
                    }
                    throw new Error('فشل جلب الإحصائيات');
                }

                const stats = await res.json();

                // Fill KPI cards
                document.getElementById('statTotalRevenue').textContent = `${Number(stats.totalRevenue || 0).toLocaleString()} دج`;
                const netProfitEl = document.getElementById('statNetProfit');
                if (netProfitEl) {
                    netProfitEl.textContent = `${Number(stats.netProfit || 0).toLocaleString()} دج`;
                }
                document.getElementById('statTotalOrders').textContent = stats.totalOrders || 0;
                document.getElementById('statNewOrders').textContent = stats.newOrders || 0;
                document.getElementById('statLowStock').textContent = (stats.outOfStockCount || 0) + (stats.lowStockCount || 0);

                // Render Charts
                renderMonthlyChart(stats.monthlyTrends || []);
                renderStatusChart(stats.statusBreakdown || {});

                // Render Low stock
                renderLowStockList(stats.lowStockProducts || []);

                // Render Top products
                renderTopProductsList(stats.topProducts || []);

            } catch (err) {
                console.error('Error loading dashboard stats:', err);
                AdminUI.showToast('خطأ أثناء جلب إحصائيات لوحة التحكم', 'error');
            }
        }

        function renderMonthlyChart(trends) {
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js is not loaded. Skipping chart render.');
                return;
            }
            const ctx = document.getElementById('ordersChart').getContext('2d');
            let labels = [];
            let revenues = [];

            if (trends && trends.length > 0) {
                labels = trends.map(t => t.month);
                revenues = trends.map(t => Number(t.revenue || 0));
            } else {
                const months = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    labels.push(months[d.getMonth()] + ' ' + d.getFullYear());
                    revenues.push(0);
                }
            }

            if (ordersChartInstance) ordersChartInstance.destroy();

            ordersChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'إجمالي المبيعات (دج)',
                        data: revenues,
                        backgroundColor: 'rgba(37, 99, 235, 0.75)',
                        borderColor: '#2563eb',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top' } }
                }
            });
        }

        function renderStatusChart(breakdown) {
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js is not loaded. Skipping chart render.');
                return;
            }
            const ctx = document.getElementById('statusChart').getContext('2d');
            const pending = breakdown.pending || 0;
            const processing = breakdown.processing || 0;
            const shipped = breakdown.shipped || 0;
            const delivered = breakdown.delivered || 0;
            const cancelled = breakdown.cancelled || 0;

            if (statusChartInstance) statusChartInstance.destroy();

            statusChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['قيد المعالجة', 'قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي'],
                    datasets: [{
                        data: [pending, processing, shipped, delivered, cancelled],
                        backgroundColor: ['#f59e0b', '#0284c7', '#7c3aed', '#10b981', '#ef4444']
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        function renderLowStockList(products) {
            const container = document.getElementById('lowStockItemsList');
            if (!products || !products.length) {
                container.innerHTML = '<p class="text-green">✅ جميع المنتجات متوفرة بمخزون كافٍ ولا توجد نواقص.</p>';
                return;
            }

            container.innerHTML = products.map(p => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${AdminTable.escapeHtml(p.image_url || '/images/product-placeholder.jpg')}" alt="${AdminTable.escapeHtml(p.name)}" width="42" height="42" style="width: 42px; height: 42px; border-radius: 6px; object-fit: cover;">
                        <div>
                            <strong style="display: block; font-size: 0.95rem;">${AdminTable.escapeHtml(p.name)}</strong>
                            <span style="font-size: 0.85rem; color: var(--light-text, #64748b);">السعر: ${Number(p.price).toLocaleString()} دج</span>
                        </div>
                    </div>
                    <div>
                        <span class="badge ${p.stock === 0 ? 'badge-danger-soft' : 'badge-warning-soft'}">
                            ${p.stock === 0 ? 'نفد المخزون (0)' : 'متبقي ' + p.stock + ' فقط'}
                        </span>
                    </div>
                </div>
            `).join('');
        }

        function renderTopProductsList(products) {
            const container = document.getElementById('topSoldItemsList');
            if (!products || !products.length) {
                container.innerHTML = '<p class="text-slate">لا توجد مبيعات مسجلة حتى الآن.</p>';
                return;
            }

            container.innerHTML = products.map((p, idx) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <strong style="font-size: 0.95rem;">#${idx + 1} ${AdminTable.escapeHtml(p.name)}</strong>
                        <span style="display: block; font-size: 0.85rem; color: var(--light-text, #64748b);">إجمالي الكمية المباعة: ${p.total_sold} قطعة</span>
                    </div>
                    <strong class="text-primary">${Number(p.total_sales).toLocaleString()} دج</strong>
                </div>
            `).join('');
        }

        document.addEventListener('DOMContentLoaded', loadAdminDashboard);

// Expose function to window
window.loadAdminDashboard = loadAdminDashboard;
