/**
 * Rewaq Admin Dashboard - Store Settings Page Logic
 */

        async function loadSettings() {
            try {
                const user = await AdminAuth.verifyAdmin();
                if (!user) return;

                const res = await fetch('/api/admin/settings', { 
                    credentials: 'include',
                    headers: AdminAuth.getHeaders(false)
                });
                if (res.status === 401 || res.status === 403) {
                    window.location.href = '../index.html';
                    return;
                }
                const settings = await res.json();
                if (settings) {
                    for (const [k, v] of Object.entries(settings)) {
                        const input = document.getElementById(`setting_${k}`);
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = (v === 'true' || v === true);
                            } else {
                                input.value = v || '';
                            }
                        }
                    }

                    if (settings.store_logo) {
                        const preview = document.getElementById('logoPreview');
                        if (preview) {
                            preview.src = settings.store_logo;
                            preview.style.display = 'block';
                        }
                    }
                    if (settings.store_favicon) {
                        const preview = document.getElementById('faviconPreview');
                        if (preview) {
                            preview.src = settings.store_favicon;
                            preview.style.display = 'block';
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading settings:', err);
            }
        }

        async function uploadSingleMedia(fileInput, targetInputId, previewImgId) {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            // Find matching label to show feedback
            const uploadBtn = document.querySelector(`.upload-btn[for="${fileInput.id}"]`) || fileInput.closest('.upload-btn');
            const originalBtnHtml = uploadBtn ? uploadBtn.innerHTML : '';
            if (uploadBtn) {
                uploadBtn.style.pointerEvents = 'none';
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>جاري الرفع...</span>';
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                if (!AdminAuth.csrfToken) {
                    await AdminAuth.fetchCsrfToken();
                }
                const headers = AdminAuth.getHeaders(false);

                const res = await fetch('/api/admin/upload-media', {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || data.message || 'فشل رفع الملف');

                const targetInput = document.getElementById(targetInputId);
                if (targetInput) {
                    targetInput.value = data.url;
                }
                const preview = document.getElementById(previewImgId);
                if (preview) {
                    preview.src = data.url;
                    preview.style.display = 'block';
                }

                AdminUI.showToast('تم رفع الصورة بنجاح! ☁️', 'success');
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            } finally {
                if (uploadBtn) {
                    uploadBtn.style.pointerEvents = '';
                    uploadBtn.innerHTML = originalBtnHtml;
                }
                fileInput.value = '';
            }
        }

        function initMediaUploaders() {
            const logoFileInput = document.getElementById('logoFileInput');
            if (logoFileInput) {
                logoFileInput.addEventListener('change', function() {
                    uploadSingleMedia(this, 'setting_store_logo', 'logoPreview');
                });
            }
            const faviconFileInput = document.getElementById('faviconFileInput');
            if (faviconFileInput) {
                faviconFileInput.addEventListener('change', function() {
                    uploadSingleMedia(this, 'setting_store_favicon', 'faviconPreview');
                });
            }

            // Keyboard support for upload labels (Enter / Space)
            document.querySelectorAll('.upload-btn[for]').forEach(lbl => {
                lbl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const targetId = lbl.getAttribute('for');
                        const targetInput = document.getElementById(targetId);
                        if (targetInput) targetInput.click();
                    }
                });
            });
        }

        async function saveSettings(e) {
            e.preventDefault();

            // CCP fields are digits only (spaces are ignored); stop early with a clear message if not.
            const ccpValue = (id) => document.getElementById(id).value.replace(/\s+/g, '');
            const ccpFields = [['setting_ccp_account_number', 'رقم الحساب البريدي'], ['setting_ccp_account_key', 'المفتاح'], ['setting_ccp_rip', 'RIP']];
            for (const [id, label] of ccpFields) {
                const v = ccpValue(id);
                if (v && !/^\d+$/.test(v)) {
                    alert(`حقل "${label}" يجب أن يحتوي على أرقام فقط.`);
                    document.getElementById(id).focus();
                    return;
                }
            }

            const btn = document.getElementById('saveSettingsBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            const payload = {
                store_name: document.getElementById('setting_store_name').value.trim(),
                store_currency: document.getElementById('setting_store_currency').value.trim() || 'دج',
                store_logo: document.getElementById('setting_store_logo').value.trim(),
                store_favicon: document.getElementById('setting_store_favicon').value.trim(),
                store_phone: document.getElementById('setting_store_phone').value.trim(),
                store_whatsapp: document.getElementById('setting_store_whatsapp').value.trim(),
                store_email: document.getElementById('setting_store_email').value.trim(),
                store_address: document.getElementById('setting_store_address').value.trim(),
                facebook_url: document.getElementById('setting_facebook_url').value.trim(),
                instagram_url: document.getElementById('setting_instagram_url').value.trim(),
                tiktok_url: document.getElementById('setting_tiktok_url').value.trim(),
                shipping_policy: document.getElementById('setting_shipping_policy').value.trim(),
                return_policy: document.getElementById('setting_return_policy').value.trim(),
                warranty_policy: document.getElementById('setting_warranty_policy').value.trim(),
                enable_cod: document.getElementById('setting_enable_cod').checked ? 'true' : 'false',
                enable_chargily: document.getElementById('setting_enable_chargily').checked ? 'true' : 'false',
                enable_ccp: document.getElementById('setting_enable_ccp').checked ? 'true' : 'false',
                ccp_account_number: ccpValue('setting_ccp_account_number'),
                ccp_account_key: ccpValue('setting_ccp_account_key'),
                ccp_rip: ccpValue('setting_ccp_rip'),
                ccp_account_holder: document.getElementById('setting_ccp_account_holder').value.trim(),
                announcement_bar_text: document.getElementById('setting_announcement_bar_text').value.trim(),
                facebook_pixel_id: document.getElementById('setting_facebook_pixel_id').value.trim(),
                tiktok_pixel_id: document.getElementById('setting_tiktok_pixel_id').value.trim(),
                google_analytics_id: document.getElementById('setting_google_analytics_id').value.trim(),
                snapchat_pixel_id: document.getElementById('setting_snapchat_pixel_id').value.trim(),
                google_client_id: document.getElementById('setting_google_client_id').value.trim(),
                telegram_bot_token: document.getElementById('setting_telegram_bot_token').value.trim(),
                telegram_chat_id: document.getElementById('setting_telegram_chat_id').value.trim(),
                telegram_notifications_enabled: document.getElementById('setting_telegram_notifications_enabled').checked ? 'true' : 'false'
            };

            try {
                const res = await fetch('/api/admin/settings', {
                    method: 'PUT',
                    credentials: 'include',
                    headers: AdminAuth.getHeaders(true),
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'فشل حفظ الإعدادات');

                AdminUI.showToast('تم حفظ كافة الإعدادات بنجاح! ⚙️', 'success');
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> حفظ كافة التغييرات والإعدادات';
            }
        }

        async function testTelegramNotification() {
            const btn = document.getElementById('testTelegramBtn');
            const botToken = document.getElementById('setting_telegram_bot_token').value.trim();
            const chatId = document.getElementById('setting_telegram_chat_id').value.trim();

            if (!botToken || !chatId) {
                AdminUI.showToast('يرجى إدخال رمز البوت (Bot Token) ومعرّف المحادثة (Chat ID) أولاً', 'warning');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إرسال الاختبار...';

            try {
                const res = await fetch('/api/admin/test-telegram', {
                    method: 'POST',
                    credentials: 'include',
                    headers: AdminAuth.getHeaders(true),
                    body: JSON.stringify({ botToken, chatId })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'فشل إرسال رسالة الاختبار');

                AdminUI.showToast(data.message || 'تم إرسال رسالة الاختبار بنجاح! تفقد تطبيق تيليجرام 📱', 'success');
            } catch (err) {
                AdminUI.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> اختبار الإرسال الفوري للتيليجرام';
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            loadSettings();
            initMediaUploaders();
        });

// Expose admin settings functions globally for data-action delegation
window.loadSettings = loadSettings;
window.uploadSingleMedia = uploadSingleMedia;
window.saveSettings = saveSettings;
window.testTelegramNotification = testTelegramNotification;
