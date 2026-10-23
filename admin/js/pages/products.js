        let editingProductId = null;
        let currentPage = 1;
        let totalPages = 1;
        let storeCategories = [];

        // Image Preview Handler
        document.addEventListener('DOMContentLoaded', async function() {
            const user = await AdminAuth.verifyAdmin();
            if (!user) return;

            const productImage = document.getElementById('productImage');
            const imagePreview = document.getElementById('imagePreview');
            if (productImage && imagePreview) {
                productImage.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            imagePreview.src = evt.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                });
            }

            // Variant Image Preview Handler
            const newVariantImage = document.getElementById('newVariantImage');
            const variantImagePreview = document.getElementById('variantImagePreview');
            const variantImagePreviewContainer = document.getElementById('variantImagePreviewContainer');
            if (newVariantImage && variantImagePreview) {
                newVariantImage.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            variantImagePreview.src = evt.target.result;
                            if (variantImagePreviewContainer) variantImagePreviewContainer.style.display = 'inline-flex';
                        };
                        reader.readAsDataURL(file);
                    } else {
                        resetVariantImagePreview();
                    }
                });
            }

            const newVariantImageUrl = document.getElementById('newVariantImageUrl');
            if (newVariantImageUrl && variantImagePreview) {
                newVariantImageUrl.addEventListener('input', function() {
                    const val = this.value.trim();
                    if (val && (!newVariantImage || !newVariantImage.files[0])) {
                        variantImagePreview.src = val;
                        if (variantImagePreviewContainer) variantImagePreviewContainer.style.display = 'inline-flex';
                    } else if (!val && (!newVariantImage || !newVariantImage.files[0])) {
                        resetVariantImagePreview();
                    }
                });
            }

            // Filter Event Listeners
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', AdminTable.debounce(() => loadProducts(1), 300));
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        loadProducts(1);
                    }
                });
            }
            document.getElementById('categoryFilter').addEventListener('change', () => loadProducts(1));
            document.getElementById('stockFilter').addEventListener('change', () => loadProducts(1));
            document.getElementById('sortFilter').addEventListener('change', () => loadProducts(1));

            document.getElementById('prevPage').addEventListener('click', () => {
                if (currentPage > 1) loadProducts(currentPage - 1);
            });
            document.getElementById('nextPage').addEventListener('click', () => {
                if (currentPage < totalPages) loadProducts(currentPage + 1);
            });

            // Close modal when clicking on dark backdrop
            window.addEventListener('click', (e) => {
                if (e.target && e.target.classList && e.target.classList.contains('modal')) {
                    e.target.style.display = 'none';
                }
            });

            await loadStoreCategories();
            loadProducts(1);
        });

        async function loadStoreCategories() {
            try {
                const res = await fetch('/api/categories', { credentials: 'include' });
                if (res.ok) {
                    storeCategories = await res.json();
                    populateCategoryDropdowns();
                }
            } catch (err) {
                console.error('Failed to load categories:', err);
            }
        }

        function populateCategoryDropdowns() {
            const filter = document.getElementById('categoryFilter');
            const formSelect = document.getElementById('productCategory');
            const datalist = document.getElementById('categoriesDatalist');
            const currentFilterVal = filter.value;
            const currentFormVal = formSelect.value;

            filter.innerHTML = '<option value="">جميع التصنيفات</option>';
            if (datalist) datalist.innerHTML = '';

            storeCategories.forEach(cat => {
                const opt1 = document.createElement('option');
                opt1.value = cat.name;
                opt1.textContent = cat.name;
                filter.appendChild(opt1);

                if (datalist) {
                    const opt2 = document.createElement('option');
                    opt2.value = cat.name;
                    datalist.appendChild(opt2);
                }
            });

            filter.value = currentFilterVal;
        }

        function openCategoriesModal() {
            document.getElementById('categoriesModal').style.display = 'block';
            renderCategoriesList();
        }

        function closeCategoriesModal() {
            document.getElementById('categoriesModal').style.display = 'none';
        }

        async function renderCategoriesList() {
            const tbody = document.getElementById('categoriesTbody');
            await loadStoreCategories();
            if (!storeCategories.length) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--light-text);">لا توجد أقسام مسجلة</td></tr>';
                return;
            }
            tbody.innerHTML = storeCategories.map(c => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px 12px; font-weight: bold;">${c.id}</td>
                    <td style="padding: 10px 12px; font-weight: bold; color: var(--text-color, #1e293b);">${AdminTable.escapeHtml(c.name_ar || c.name)}</td>
                    <td style="padding: 10px 12px; color: var(--text-color, #1e293b);">${AdminTable.escapeHtml(c.name_fr || '-')}</td>
                    <td style="padding: 10px 12px; color: var(--text-color, #1e293b);">${AdminTable.escapeHtml(c.name_en || '-')}</td>
                    <td style="padding: 10px 12px; text-align: center; color: var(--light-text, #64748b);">${c.productsCount || 0}</td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <button type="button" data-action="deleteCategoryItem" data-args="${c.id}" class="btn-icon btn-icon-danger"  title="حذف القسم">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        async function handleAddCategory(e) {
            e.preventDefault();
            const input = document.getElementById('newCategoryName');
            const inputFr = document.getElementById('newCategoryNameFr');
            const inputEn = document.getElementById('newCategoryNameEn');
            const btn = document.getElementById('addCategoryBtn');
            const name = input.value.trim();
            const name_fr = inputFr ? inputFr.value.trim() : '';
            const name_en = inputEn ? inputEn.value.trim() : '';
            if (!name) return;

            AdminUI.setButtonLoading(btn, true, 'إضافة...');
            try {
                const headers = AdminAuth.getHeaders(true);
                const res = await fetch('/api/admin/categories', {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: JSON.stringify({ name, name_fr, name_en })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل إنشاء القسم');

                AdminUI.showToast('تمت إضافة القسم بنجاح', 'success');
                input.value = '';
                if (inputFr) inputFr.value = '';
                if (inputEn) inputEn.value = '';
                await renderCategoriesList();
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            } finally {
                AdminUI.setButtonLoading(btn, false);
            }
        }

        async function deleteCategoryItem(id) {
            const confirmed = await AdminUI.confirm('هل أنت متأكد من حذف هذا القسم؟', 'حذف قسم');
            if (!confirmed) return;

            try {
                const headers = AdminAuth.getHeaders(false);
                const res = await fetch(`/api/admin/categories/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل حذف القسم');

                AdminUI.showToast('تم حذف القسم بنجاح', 'success');
                await renderCategoriesList();
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            }
        }

        function openAddProductModal() {
            editingProductId = null;
            document.getElementById('modalTitle').textContent = 'إضافة منتج جديد';
            document.getElementById('productName').value = '';
            document.getElementById('productCategory').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productOldPrice').value = '';
            document.getElementById('productCostPrice').value = '';
            document.getElementById('productStock').value = '';
            document.getElementById('productStatus').value = 'active';
            document.getElementById('productDescription').value = '';
            document.getElementById('productImage').value = '';
            document.getElementById('imagePreview').src = '../images/product-placeholder.jpg';
            document.getElementById('productModal').style.display = 'block';
        }

        function closeProductModal() {
            document.getElementById('productModal').style.display = 'none';
        }

        async function editProduct(id) {
            try {
                const response = await fetch(`/api/products/${id}`, { credentials: 'include' });
                if (!response.ok) throw new Error('فشل جلب بيانات المنتج');
                const product = await response.json();

                editingProductId = product.id;
                document.getElementById('modalTitle').textContent = 'تعديل المنتج #' + product.id;
                document.getElementById('productName').value = product.name || '';
                document.getElementById('productCategory').value = product.category_name || product.category || '';
                document.getElementById('productPrice').value = product.price || '';
                document.getElementById('productOldPrice').value = product.old_price || '';
                document.getElementById('productCostPrice').value = product.cost_price || '';
                document.getElementById('productStock').value = product.stock || '0';
                document.getElementById('productStatus').value = product.status || 'active';
                document.getElementById('productDescription').value = product.description || '';
                document.getElementById('imagePreview').src = product.image_url || '../images/product-placeholder.jpg';
                document.getElementById('productModal').style.display = 'block';
            } catch (error) {
                AdminUI.showToast('خطأ: ' + error.message, 'error');
            }
        }

        async function saveProduct(e) {
            if (e && e.preventDefault) e.preventDefault();
            const form = document.getElementById('productForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            AdminUI.setButtonLoading(submitBtn, true, editingProductId ? 'جاري التحديث...' : 'جاري الحفظ...');

            try {
                const formData = new FormData();
                formData.append('name', document.getElementById('productName').value.trim());
                formData.append('category', document.getElementById('productCategory').value.trim());
                formData.append('price', document.getElementById('productPrice').value);
                formData.append('old_price', document.getElementById('productOldPrice').value || '');
                formData.append('cost_price', document.getElementById('productCostPrice').value || '0');
                formData.append('stock', document.getElementById('productStock').value);
                formData.append('status', document.getElementById('productStatus').value);
                formData.append('description', document.getElementById('productDescription').value.trim());

                const imageFile = document.getElementById('productImage').files[0];
                if (imageFile) {
                    formData.append('image', imageFile);
                }

                const headers = AdminAuth.getHeaders(false);

                let response;
                if (editingProductId) {
                    response = await fetch(`/api/products/${editingProductId}`, {
                        method: 'PUT',
                        credentials: 'include',
                        headers,
                        body: formData
                    });
                } else {
                    response = await fetch('/api/products', {
                        method: 'POST',
                        credentials: 'include',
                        headers,
                        body: formData
                    });
                }

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'حدث خطأ أثناء حفظ المنتج');
                }

                AdminUI.showToast(editingProductId ? 'تم تحديث المنتج بنجاح! 🎉' : 'تمت إضافة المنتج بنجاح! 🎉', 'success');
                closeProductModal();
                await loadStoreCategories();
                loadProducts(currentPage);
            } catch (error) {
                AdminUI.showToast('خطأ: ' + error.message, 'error');
            } finally {
                AdminUI.setButtonLoading(submitBtn, false);
            }
        }

        async function deleteProduct(id) {
            const confirmed = await AdminUI.confirm('هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً؟', 'حذف المنتج');
            if (!confirmed) return;

            try {
                const headers = AdminAuth.getHeaders(false);
                const response = await fetch(`/api/products/${id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'فشل حذف المنتج');
                }

                AdminUI.showToast('تم حذف المنتج بنجاح', 'success');
                await loadStoreCategories();
                loadProducts(currentPage);
            } catch (error) {
                AdminUI.showToast('خطأ: ' + error.message, 'error');
            }
        }

        async function loadProducts(page = 1) {
            currentPage = page;
            const search = (document.getElementById('searchInput').value || '').trim();
            const category = document.getElementById('categoryFilter').value;
            const stockVal = document.getElementById('stockFilter').value;
            const sortBy = document.getElementById('sortFilter').value;

            let url = `/api/products?page=${page}&limit=10&status=all`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (category) url += `&category=${encodeURIComponent(category)}`;
            if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;
            if (stockVal) url += `&stockStatus=${encodeURIComponent(stockVal)}`;

            try {
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) throw new Error('فشل في جلب المنتجات');

                const data = await response.json();
                let products = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);

                totalPages = data.totalPages || 1;
                // Auto-stepback if page is out of bounds after deletion
                if (products.length === 0 && currentPage > 1 && totalPages < currentPage) {
                    loadProducts(currentPage - 1);
                    return;
                }

                renderProductsTable(products);
                renderPagination(currentPage, totalPages);
            } catch (error) {
                const tbody = document.getElementById('products-tbody');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: red;">فشل في جلب المنتجات: ${AdminTable.escapeHtml(error.message)}</td></tr>`;
                }
            }
        }

        function renderProductsTable(products) {
            window.adminCurrentProducts = products || [];
            const tbody = document.getElementById('products-tbody');
            if (!tbody) return;

            if (!products || products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--light-text, #64748b);">لا توجد منتجات مطابقة لخيارات البحث الحالية</td></tr>';
                return;
            }

            tbody.innerHTML = products.map(product => {
                const stockNum = Number(product.stock);
                const stockHtml = stockNum === 0
                    ? `<span class="badge badge-danger-soft">نفد المخزون (0)</span>`
                    : stockNum <= 3
                    ? `<span class="badge badge-warning-soft">${stockNum} (منخفض)</span>`
                    : `<span style="font-weight: bold; color: var(--text-color, #1e293b);">${stockNum} قطعة</span>`;

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td data-label="المنتج" style="padding: 12px 10px;">
                            <div class="product-cell" style="display: flex; align-items: center; gap: 10px;">
                                <img src="${AdminTable.escapeHtml(product.image_url || '../images/product-placeholder.jpg')}" alt="${AdminTable.escapeHtml(product.name)}" width="44" height="44" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
                                <div class="product-cell-text">
                                    <strong class="product-cell-name" style="display: block; font-size: 0.95rem; color: var(--text-color, #1e293b);">${AdminTable.escapeHtml(product.name)}</strong>
                                    <span style="font-size: 0.8rem; color: var(--light-text);">ID: #${product.id}</span>
                                </div>
                            </div>
                        </td>
                        <td data-label="التصنيف" style="padding: 12px 10px; color: var(--text-color, #475569); font-size: 0.9rem;">
                            ${AdminTable.escapeHtml(product.category_name || product.category || 'عام')}
                        </td>
                        <td data-label="السعر" style="padding: 12px 10px; font-weight: bold; color: var(--success-color);">
                            ${Number(product.price).toLocaleString()} دج
                            ${(product.old_price && Number(product.old_price) > Number(product.price)) ? `<div style="font-size: 0.78rem; font-weight: normal; margin-top: 2px;"><span style="text-decoration: line-through; color: var(--light-text);">${Number(product.old_price).toLocaleString()} دج</span> <span class="badge badge-warning-soft" style="font-size: 0.7rem; padding: 1px 5px; border-radius: 4px;">-${Math.round((1 - Number(product.price) / Number(product.old_price)) * 100)}%</span></div>` : ''}
                        </td>
                        <td data-label="الكمية المتوفرة" style="padding: 12px 10px;">
                            ${stockHtml}
                        </td>
                        <td data-label="الحالة" style="padding: 12px 10px;">
                            <span class="${product.status === 'active' ? 'badge-success-soft' : 'badge-neutral-soft'}" style="font-size: 0.8rem; padding: 3px 8px; border-radius: 12px; font-weight: bold;">
                                ${product.status === 'active' ? 'نشط' : 'غير نشط'}
                            </span>
                        </td>
                        <td data-label="الإجراءات" style="padding: 12px 10px; text-align: center; white-space: nowrap;">
                            <button type="button" class="product-action-btn" data-action="openVariantsModal" data-args="${product.id}" title="إدارة متغيرات المنتج (المقاسات والألوان)" style="color: var(--primary-color);">
                                <i class="fas fa-layer-group"></i>
                            </button>
                            <button type="button" class="product-action-btn" data-action="editProduct" data-args="${product.id}" title="تعديل المنتج">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="product-action-btn delete-btn" data-action="deleteProduct" data-args="${product.id}" title="حذف المنتج">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        let activeVariantProductId = null;

        function resetVariantImagePreview() {
            const input = document.getElementById('newVariantImage');
            const preview = document.getElementById('variantImagePreview');
            const container = document.getElementById('variantImagePreviewContainer');
            if (input) input.value = '';
            if (preview) preview.src = '';
            if (container) container.style.display = 'none';
        }

        function openVariantsModal(productId, productName) {
            activeVariantProductId = productId;
            const p = (window.adminCurrentProducts || []).find(item => item.id === productId);
            document.getElementById('variantProductTitle').textContent = p ? p.name : (productName || '');
            document.getElementById('variantsModal').style.display = 'block';
            resetVariantImagePreview();
            if (document.getElementById('newVariantName')) document.getElementById('newVariantName').value = '';
            if (document.getElementById('newVariantSku')) document.getElementById('newVariantSku').value = '';
            if (document.getElementById('newVariantPriceMod')) document.getElementById('newVariantPriceMod').value = '0';
            if (document.getElementById('newVariantStock')) document.getElementById('newVariantStock').value = '10';
            if (document.getElementById('newVariantImageUrl')) document.getElementById('newVariantImageUrl').value = '';
            loadProductVariants(productId);
        }

        function closeVariantsModal() {
            document.getElementById('variantsModal').style.display = 'none';
            activeVariantProductId = null;
            resetVariantImagePreview();
        }

        async function loadProductVariants(productId) {
            const tbody = document.getElementById('variantsTbody');
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--light-text);"><i class="fas fa-spinner fa-spin"></i> جاري تحميل المتغيرات...</td></tr>';
            try {
                const res = await fetch(`/api/products/${productId}/variants`, { credentials: 'include' });
                if (!res.ok) throw new Error('فشل جلب المتغيرات');
                const variants = await res.json();
                if (!variants || !variants.length) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--light-text);">لا توجد متغيرات مسجلة لهذا المنتج (يمكنك إضافة خيارات مثل المقاس أو اللون مع الصورة أعلاه)</td></tr>';
                    return;
                }
                tbody.innerHTML = variants.map(v => `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 6px 12px; text-align: center;">
                            ${v.imageUrl ? `<img src="${AdminTable.escapeHtml(v.imageUrl)}" alt="${AdminTable.escapeHtml(v.name)}" width="38" height="38" style="width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); vertical-align: middle;">` : '<span style="color:var(--light-text); font-size: 0.8rem;">-</span>'}
                        </td>
                        <td style="padding: 10px 12px; font-weight: bold; color: var(--text-color, #1e293b);">${AdminTable.escapeHtml(v.name)}</td>
                        <td style="padding: 10px 12px; color: var(--light-text); font-size: 0.85rem;">${AdminTable.escapeHtml(v.sku || '-')}</td>
                        <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: ${v.priceModifier > 0 ? 'var(--success-color)' : (v.priceModifier < 0 ? 'var(--danger-color)' : 'var(--light-text)')};">
                            ${v.priceModifier > 0 ? '+' : ''}${Number(v.priceModifier || 0).toLocaleString()} دج
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span class="badge ${v.stock <= 0 ? 'badge-danger-soft' : (v.stock <= 3 ? 'badge-warning-soft' : 'badge-success-soft')}" style="padding: 2px 8px; border-radius: 10px; font-weight: bold;">
                                ${v.stock}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <button type="button" data-action="handleDeleteVariant" data-args="${v.id}" class="btn-icon btn-icon-danger" title="حذف الخيار">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--danger-color);">${AdminTable.escapeHtml(err.message)}</td></tr>`;
            }
        }

        async function handleCreateVariant(e) {
            e.preventDefault();
            if (!activeVariantProductId) return;

            const name = document.getElementById('newVariantName').value.trim();
            const sku = document.getElementById('newVariantSku').value.trim();
            const priceModifier = Number(document.getElementById('newVariantPriceMod').value || 0);
            const stock = Number(document.getElementById('newVariantStock').value || 0);
            const imageFile = document.getElementById('newVariantImage') ? document.getElementById('newVariantImage').files[0] : null;
            const imageUrl = document.getElementById('newVariantImageUrl') ? document.getElementById('newVariantImageUrl').value.trim() : '';
            const btn = document.getElementById('addVariantBtn');

            if (!name) return;

            AdminUI.setButtonLoading(btn, true, '...');
            try {
                let res;
                if (imageFile) {
                    const formData = new FormData();
                    formData.append('name', name);
                    if (sku) formData.append('sku', sku);
                    formData.append('priceModifier', String(priceModifier));
                    formData.append('stock', String(stock));
                    formData.append('image', imageFile);

                    const headers = AdminAuth.getHeaders(false);
                    res = await fetch(`/api/products/${activeVariantProductId}/variants`, {
                        method: 'POST',
                        credentials: 'include',
                        headers,
                        body: formData
                    });
                } else {
                    const headers = AdminAuth.getHeaders(true);
                    res = await fetch(`/api/products/${activeVariantProductId}/variants`, {
                        method: 'POST',
                        credentials: 'include',
                        headers,
                        body: JSON.stringify({
                            name,
                            sku,
                            priceModifier,
                            stock,
                            imageUrl: imageUrl || null
                        })
                    });
                }

                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل إضافة الخيار');

                AdminUI.showToast('تمت إضافة الخيار بنجاح! 🎉', 'success');
                document.getElementById('newVariantName').value = '';
                document.getElementById('newVariantSku').value = '';
                document.getElementById('newVariantPriceMod').value = '0';
                document.getElementById('newVariantStock').value = '10';
                if (document.getElementById('newVariantImageUrl')) document.getElementById('newVariantImageUrl').value = '';
                resetVariantImagePreview();
                loadProductVariants(activeVariantProductId);
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            } finally {
                AdminUI.setButtonLoading(btn, false);
            }
        }

        async function handleDeleteVariant(variantId) {
            const confirmed = await AdminUI.confirm('هل أنت متأكد من حذف هذا الخيار؟', 'حذف المتغير');
            if (!confirmed) return;

            try {
                const headers = AdminAuth.getHeaders(false);
                const res = await fetch(`/api/products/variants/${variantId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'فشل حذف الخيار');

                AdminUI.showToast('تم حذف الخيار بنجاح', 'success');
                if (activeVariantProductId) loadProductVariants(activeVariantProductId);
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            }
        }

        function renderPagination(current, total) {
            const container = document.getElementById('pageNumbers');
            if (!container) return;

            document.getElementById('prevPage').disabled = current <= 1;
            document.getElementById('nextPage').disabled = current >= total;

            let html = '';
            for (let i = 1; i <= total; i++) {
                if (i === current) {
                    html += `<button class="page-btn active">${i}</button>`;
                } else if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                    html += `<button type="button" data-action="loadProducts" data-args="${i}" class="page-btn">${i}</button>`;
                } else if (i === current - 2 || i === current + 2) {
                    html += `<span style="padding: 6px 4px;">...</span>`;
                }
            }
            container.innerHTML = html;
        }
    

// Buttons that open the hidden file inputs (data-action delegation lives in admin.js)
window.clickFileproductImage = function () { const el = document.getElementById('productImage'); if (el) el.click(); };
window.clickFilenewVariantImage = function () { const el = document.getElementById('newVariantImage'); if (el) el.click(); };

        function resetProductsFilters() {
            const searchInput = document.getElementById('searchInput');
            const categoryFilter = document.getElementById('categoryFilter');
            const stockFilter = document.getElementById('stockFilter');
            const sortFilter = document.getElementById('sortFilter');
            if (searchInput) searchInput.value = '';
            if (categoryFilter) categoryFilter.value = '';
            if (stockFilter) stockFilter.value = '';
            if (sortFilter) sortFilter.value = 'newest';
            loadProducts(1);
        }

// Expose admin product functions globally for data-action delegation
window.openAddProductModal = openAddProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.loadProducts = loadProducts;
window.resetProductsFilters = resetProductsFilters;
window.openCategoriesModal = openCategoriesModal;
window.closeCategoriesModal = closeCategoriesModal;
window.handleAddCategory = handleAddCategory;
window.deleteCategoryItem = deleteCategoryItem;
window.openVariantsModal = openVariantsModal;
window.closeVariantsModal = closeVariantsModal;
window.handleCreateVariant = handleCreateVariant;
window.handleDeleteVariant = handleDeleteVariant;
window.resetVariantImagePreview = resetVariantImagePreview;
