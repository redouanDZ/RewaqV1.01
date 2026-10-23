        let currentPage = 1;
        let totalPages = 1;

        document.addEventListener('DOMContentLoaded', async () => {
            const user = await AdminAuth.verifyAdmin();
            if (!user) return;

            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', AdminTable.debounce(() => loadAdminReviews(1), 300));
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        loadAdminReviews(1);
                    }
                });
            }
            document.getElementById('statusFilter').addEventListener('change', () => loadAdminReviews(1));
            const ratingFilter = document.getElementById('ratingFilter');
            if (ratingFilter) {
                ratingFilter.addEventListener('change', () => loadAdminReviews(1));
            }

            loadAdminReviews(1);
        });

        async function loadAdminReviews(page = 1) {
            currentPage = page;
            const search = (document.getElementById('searchInput')?.value || '').trim();
            const status = document.getElementById('statusFilter')?.value || 'all';
            const rating = document.getElementById('ratingFilter')?.value || 'all';
            const headers = AdminAuth.getHeaders(false);

            let url = `/api/admin/reviews?page=${page}&limit=15&status=${status}`;
            if (rating && rating !== 'all') url += `&rating=${encodeURIComponent(rating)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            try {
                const res = await fetch(url, { credentials: 'include', headers });
                if (!res.ok) throw new Error('فشل جلب التقييمات');
                const data = await res.json();

                const reviews = data.reviews || [];
                totalPages = data.totalPages || 1;
                document.getElementById('reviewsCountDisplay').textContent = `إجمالي التقييمات: ${data.total || reviews.length}`;

                renderReviewsTable(reviews);
                renderPagination(currentPage, totalPages);
            } catch (err) {
                const tbody = document.getElementById('reviews-tbody');
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red; padding: 20px;">خطأ: ${AdminTable.escapeHtml(err.message)}</td></tr>`;
            }
        }

        function renderReviewsTable(reviews) {
            const tbody = document.getElementById('reviews-tbody');
            if (!reviews || !reviews.length) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--light-text, #64748b);">لا توجد تقييمات مطابقة</td></tr>';
                return;
            }

            const statusLabels = { 'approved': 'موافق عليه ✅', 'pending': 'قيد المراجعة ⏳', 'rejected': 'مرفوض ❌' };

            tbody.innerHTML = reviews.map(r => {
                const stars = `<span style="color: #f59e0b; font-size: 1.05rem; letter-spacing: 1px;">${'★'.repeat(r.rating)}</span><span style="color: #cbd5e1; font-size: 1.05rem; letter-spacing: 1px;">${'☆'.repeat(5 - r.rating)}</span>`;
                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td data-label="#" style="padding: 12px 15px; font-weight: bold;">${r.id}</td>
                        <td data-label="المنتج" style="padding: 12px 15px;">
                            <div class="product-cell" style="display: flex; align-items: center; gap: 10px;">
                                <img src="${r.productImage || '../images/product-placeholder.jpg'}" alt="" width="44" height="44" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex-shrink: 0;">
                                <div class="product-cell-text" style="min-width: 0;">
                                    <strong class="product-cell-name" style="font-size: 0.95rem;">${AdminTable.escapeHtml(r.productName)}</strong>
                                </div>
                            </div>
                        </td>
                        <td data-label="العميل" style="padding: 12px 15px;">
                            <div class="customer-info-cell">
                                <strong style="display: block; font-size: 0.95rem;">${AdminTable.escapeHtml(r.username)}</strong>
                                <span style="font-size: 0.8rem; color: var(--light-text, #64748b);">${AdminTable.escapeHtml(r.email || '')}</span>
                            </div>
                        </td>
                        <td data-label="التقييم" style="padding: 12px 15px; text-align: center; font-size: 1.1rem;" class="stars-gold">${stars}</td>
                        <td data-label="التعليق" style="padding: 12px 15px; max-width: 250px; font-size: 0.9rem; color: var(--text-color, #334155);">${AdminTable.escapeHtml(r.comment) || '<span class="text-slate-light">بدون تعليق نصي</span>'}</td>
                        <td data-label="التاريخ" style="padding: 12px 15px; text-align: center; color: var(--light-text, #64748b); font-size: 0.85rem;">${new Date(r.created_at).toLocaleDateString('ar-DZ')}</td>
                        <td data-label="الحالة" style="padding: 12px 15px; text-align: center;"><span class="status-badge status-${r.status}">${statusLabels[r.status] || r.status}</span></td>
                        <td data-label="الإجراءات" style="padding: 12px 15px; text-align: center;">
                            ${r.status !== 'approved' ? `<button type="button" class="review-action-btn approve-btn" data-action="updateReviewStatus" data-args="${r.id}, 'approved'" title="الموافقة على النشر"><i class="fas fa-check"></i></button>` : ''}
                            ${r.status !== 'rejected' ? `<button type="button" class="review-action-btn reject-btn" data-action="updateReviewStatus" data-args="${r.id}, 'rejected'" title="رفض وحجب"><i class="fas fa-ban"></i></button>` : ''}
                            <button type="button" class="review-action-btn delete-btn" data-action="deleteReview" data-args="${r.id}" title="حذف نهائي"><i class="fas fa-trash-alt"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function renderPagination(current, total) {
            const container = document.getElementById('pagination');
            if (total <= 1) { container.innerHTML = ''; return; }
            let html = '';
            for (let i = 1; i <= total; i++) {
                html += `<button type="button" class="page-btn${i === current ? ' active' : ''}" data-action="loadAdminReviews" data-args="${i}">${i}</button>`;
            }
            container.innerHTML = html;
        }

        async function updateReviewStatus(id, newStatus) {
            try {
                const headers = AdminAuth.getHeaders(true);
                const res = await fetch(`/api/admin/reviews/${id}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify({ status: newStatus })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل تحديث الحالة');
                AdminUI.showToast('تم تحديث حالة التقييم بنجاح', 'success');
                loadAdminReviews(currentPage);
            } catch (err) {
                AdminUI.showToast('خطأ: ' + err.message, 'error');
            }
        }

        async function deleteReview(id) {
            const confirmed = await AdminUI.confirm('هل أنت متأكد من رغبتك في حذف هذا التقييم نهائياً؟', 'حذف التقييم');
            if (!confirmed) return;

            try {
                const headers = AdminAuth.getHeaders(false);
                const res = await fetch(`/api/admin/reviews/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل حذف التقييم');
                AdminUI.showToast('تم حذف التقييم بنجاح', 'success');
                loadAdminReviews(currentPage);
            } catch (err) {
                AdminUI.showToast('خطأ: ' + err.message, 'error');
            }
        }

        function resetReviewsFilters() {
            const searchInput = document.getElementById('searchInput');
            const statusFilter = document.getElementById('statusFilter');
            const ratingFilter = document.getElementById('ratingFilter');
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = 'all';
            if (ratingFilter) ratingFilter.value = 'all';
            loadAdminReviews(1);
        }

// Expose admin review functions globally for data-action delegation
window.loadAdminReviews = loadAdminReviews;
window.resetReviewsFilters = resetReviewsFilters;
window.updateReviewStatus = updateReviewStatus;
window.deleteReview = deleteReview;
    
