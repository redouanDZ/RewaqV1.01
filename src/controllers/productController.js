const db = require('../data/db-connection.js');
const { sanitizeString } = require('../utils/helpers');
const { isAdminRequest } = require('../middlewares/adminMiddleware');

// cost_price is the merchant's purchase cost (margin data): admins only, never public.
const PRIVATE_PRODUCT_FIELDS = ['cost_price', 'costPrice'];
function stripPrivateProductFields(product) {
    if (!product || typeof product !== 'object') return product;
    const copy = { ...product };
    for (const field of PRIVATE_PRODUCT_FIELDS) delete copy[field];
    return copy;
}

async function createProduct(req, res) {
    try {
        const name = sanitizeString(req.body.name);
        const category = sanitizeString(req.body.category);
        const price = Number(req.body.price);
        const stock = Number(req.body.stock);
        const status = sanitizeString(req.body.status, 'active');
        const description = sanitizeString(req.body.description || '', '', 10000);

        if (!name || !category || !Number.isFinite(price) || !Number.isFinite(stock) || stock < 0 || price < 0) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة (الاسم، القسم، السعر، الكمية)', message: 'جميع الحقول مطلوبة (الاسم، القسم، السعر، الكمية)', code: 'REQUIRED_FIELDS_MISSING' });
        }

        const rawOldPrice = req.body.old_price ?? req.body.oldPrice;
        const parsedOldPrice = Number(rawOldPrice);
        const oldPrice = (rawOldPrice !== undefined && rawOldPrice !== null && rawOldPrice !== '' && Number.isFinite(parsedOldPrice) && parsedOldPrice > 0)
            ? parsedOldPrice
            : null;

        const rawCostPrice = req.body.cost_price ?? req.body.costPrice;
        const parsedCostPrice = Number(rawCostPrice);
        const costPrice = (rawCostPrice !== undefined && rawCostPrice !== null && rawCostPrice !== '' && Number.isFinite(parsedCostPrice) && parsedCostPrice >= 0)
            ? parsedCostPrice
            : 0;

        let images = [];
        if (req.body.images) {
            if (Array.isArray(req.body.images)) {
                images = req.body.images;
            } else if (typeof req.body.images === 'string') {
                try {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) images = parsed;
                    else images = [req.body.images];
                } catch (_) {
                    images = [req.body.images];
                }
            }
        }
        const imageUrl = req.file ? (req.file.url || `/images/${req.file.filename}`) : (req.body.image_url || '/images/product-placeholder.jpg');
        if (!images.length && imageUrl) {
            images = [imageUrl];
        }

        const productData = {
            name,
            category,
            price,
            old_price: oldPrice,
            cost_price: costPrice,
            stock: Math.trunc(stock),
            status,
            description,
            image_url: imageUrl,
            images
        };

        const id = await db.createProduct(productData);

        res.status(201).json({
            id,
            message: 'تم إنشاء المنتج بنجاح',
            product: { id, ...productData }
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'خطأ أثناء إنشاء المنتج', message: 'خطأ أثناء إنشاء المنتج', code: 'PRODUCT_CREATE_FAILED' });
    }
}

async function getProducts(req, res) {
    try {
        const { category, search, minPrice, maxPrice, minRating, inStock, stockStatus, status, sortBy, page, limit } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));

        // Visitors only ever see published products; ?status=draft|all is an admin feature.
        const isAdmin = await isAdminRequest(req);
        const result = await db.getProducts({
            category,
            search,
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null,
            minRating: minRating ? parseFloat(minRating) : null,
            inStock: inStock === 'true' || inStock === '1' || inStock === true,
            stockStatus: stockStatus || req.query.stock,
            status: isAdmin ? status : 'active',
            sortBy,
            page: pageNum,
            limit: limitNum
        });
        if (result && Array.isArray(result.products) && !isAdmin) {
            result.products = result.products.map(stripPrivateProductFields);
        }
        res.json(result);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'خطأ في جلب المنتجات', message: 'خطأ في جلب المنتجات', code: 'PRODUCTS_FETCH_FAILED' });
    }
}

async function getProductById(req, res) {
    try {
        const product = await db.getProductById(req.params.id);
        if (!product) return res.status(404).json({ error: 'المنتج غير موجود', message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
        const isAdmin = await isAdminRequest(req);
        if (!isAdmin && product.status !== 'active') {
            // unpublished products must not be reachable by guessing their id
            return res.status(404).json({ error: 'المنتج غير موجود', message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
        }
        res.json(isAdmin ? product : stripPrivateProductFields(product));
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'خطأ في جلب المنتج', message: 'خطأ في جلب المنتج', code: 'PRODUCT_FETCH_FAILED' });
    }
}

async function updateProduct(req, res) {
    try {
        const updateData = { ...req.body };
        if (req.file) {
            updateData.image_url = req.file.url || `/images/${req.file.filename}`;
        }
        if (req.body.images !== undefined) {
            let images = [];
            if (Array.isArray(req.body.images)) {
                images = req.body.images;
            } else if (typeof req.body.images === 'string') {
                try {
                    const parsed = JSON.parse(req.body.images);
                    if (Array.isArray(parsed)) images = parsed;
                    else images = [req.body.images];
                } catch (_) {
                    images = [req.body.images];
                }
            }
            updateData.images = images;
        }
        if (updateData.price !== undefined && updateData.price !== '') {
            updateData.price = Number(updateData.price);
        }
        if (updateData.old_price !== undefined || updateData.oldPrice !== undefined) {
            const rawOld = updateData.old_price !== undefined ? updateData.old_price : updateData.oldPrice;
            const parsedOld = Number(rawOld);
            updateData.old_price = (rawOld !== '' && rawOld !== null && Number.isFinite(parsedOld) && parsedOld > 0) ? parsedOld : null;
        }
        if (updateData.cost_price !== undefined || updateData.costPrice !== undefined) {
            const rawCost = updateData.cost_price !== undefined ? updateData.cost_price : updateData.costPrice;
            updateData.cost_price = Number(rawCost) || 0;
        }
        if (updateData.stock !== undefined && updateData.stock !== '') {
            updateData.stock = Number(updateData.stock);
        }
        if (updateData.name) {
            updateData.name = sanitizeString(updateData.name);
        }
        if (updateData.category) {
            updateData.category = sanitizeString(updateData.category);
        }
        if (updateData.description !== undefined) {
            updateData.description = sanitizeString(updateData.description, '', 10000);
        }
        if (updateData.status) {
            updateData.status = sanitizeString(updateData.status);
        }

        const success = await db.updateProduct(req.params.id, updateData);
        if (!success) return res.status(404).json({ error: 'المنتج غير موجود', message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
        
        const updatedProduct = await db.getProductById(req.params.id);
        res.json({ message: 'تم تحديث المنتج بنجاح', product: updatedProduct });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'خطأ في تحديث المنتج', message: 'خطأ في تحديث المنتج', code: 'PRODUCT_UPDATE_FAILED' });
    }
}

async function deleteProduct(req, res) {
    try {
        const success = await db.deleteProduct(req.params.id);
        if (!success) return res.status(404).json({ error: 'المنتج غير موجود', message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
        res.json({ message: 'تم حذف المنتج بنجاح' });
    } catch (error) {
        console.error('Error deleting product:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(409).json({ error: 'لا يمكن حذف هذا المنتج لوجود طلبات سابقة مرتبطة به في سجل المبيعات. يمكنك تغيير حالة المنتج إلى "غير نشط" لإخفائه من المتجر.', message: 'لا يمكن حذف هذا المنتج لوجود طلبات سابقة مرتبطة به في سجل المبيعات. يمكنك تغيير حالة المنتج إلى "غير نشط" لإخفائه من المتجر.', code: 'PRODUCT_HAS_ORDERS' });
        }
        res.status(500).json({ error: 'خطأ في حذف المنتج', message: 'خطأ في حذف المنتج', code: 'PRODUCT_DELETE_FAILED' });
    }
}

async function autocomplete(req, res) {
    try {
        const query = (req.query.q || '').trim().toLowerCase();
        if (!query) return res.json([]);
        const all = await db.getProducts({ search: query, limit: 5 });
        const results = (all.products || []).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            image_url: p.image_url
        }));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'خطأ في جلب المقترحات', message: 'خطأ في جلب المقترحات', code: 'AUTOCOMPLETE_FAILED' });
    }
}

async function recommendations(req, res) {
    try {
        const productId = parseInt(req.query.productId, 10);
        const all = await db.getProducts({ limit: 10 });
        let items = all.products || [];
        if (!isNaN(productId)) {
            items = items.filter(p => p.id !== productId);
        }
        res.json(items.slice(0, 4).map(stripPrivateProductFields));
    } catch (err) {
        res.status(500).json({ error: 'خطأ في جلب التوصيات', message: 'خطأ في جلب التوصيات', code: 'RECOMMENDATIONS_FAILED' });
    }
}

async function getProductReviews(req, res) {
    try {
        const productId = parseInt(req.params.id, 10);
        if (isNaN(productId)) return res.status(400).json({ error: 'معرف المنتج غير صالح', message: 'معرف المنتج غير صالح', code: 'INVALID_PRODUCT_ID' });
        const reviews = await db.getProductReviews(productId);
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching product reviews:', error);
        res.status(500).json({ error: 'خطأ في جلب تقييمات المنتج', message: 'خطأ في جلب تقييمات المنتج', code: 'REVIEWS_FETCH_FAILED' });
    }
}

async function addProductReview(req, res) {
    try {
        const productId = parseInt(req.params.id, 10);
        if (isNaN(productId)) return res.status(400).json({ error: 'معرف المنتج غير صالح', message: 'معرف المنتج غير صالح', code: 'INVALID_PRODUCT_ID' });
        const userId = req.userId;
        if (!userId) return res.status(401).json({ error: 'يجب تسجيل الدخول لإضافة تقييم', message: 'يجب تسجيل الدخول لإضافة تقييم', code: 'LOGIN_REQUIRED_REVIEW' });

        const rating = parseInt(req.body.rating, 10);
        const comment = sanitizeString(req.body.comment || '', '');

        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5 نجوم', message: 'التقييم يجب أن يكون بين 1 و 5 نجوم', code: 'INVALID_RATING' });
        }

        const id = await db.createProductReview({
            productId,
            userId,
            rating,
            comment,
            status: 'approved'
        });

        res.status(201).json({ message: 'تمت إضافة تقييمك بنجاح! ⭐', id });
    } catch (error) {
        console.error('Error adding product review:', error);
        res.status(500).json({ error: 'خطأ في إضافة التقييم', message: 'خطأ في إضافة التقييم', code: 'REVIEW_ADD_FAILED' });
    }
}

async function getProductVariants(req, res) {
    try {
        const productId = parseInt(req.params.id, 10);
        if (isNaN(productId)) return res.status(400).json({ error: 'معرف المنتج غير صالح', message: 'معرف المنتج غير صالح', code: 'INVALID_PRODUCT_ID' });
        const variants = await db.getProductVariants(productId);
        res.json(variants);
    } catch (error) {
        console.error('Error fetching variants:', error);
        res.status(500).json({ error: 'خطأ في جلب خيارات المنتج', message: 'خطأ في جلب خيارات المنتج', code: 'VARIANTS_FETCH_FAILED' });
    }
}

async function createProductVariant(req, res) {
    try {
        const productId = parseInt(req.params.id, 10);
        if (isNaN(productId)) return res.status(400).json({ error: 'معرف المنتج غير صالح', message: 'معرف المنتج غير صالح', code: 'INVALID_PRODUCT_ID' });
        const { name, sku, priceModifier, stock, status } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'اسم الخيار / التفرع مطلوب', message: 'اسم الخيار / التفرع مطلوب', code: 'VARIANT_NAME_REQUIRED' });
        }
        const id = await db.createProductVariant({
            productId,
            name: sanitizeString(name),
            sku: sku ? sanitizeString(sku, '', 100) : null,
            priceModifier: Number(priceModifier) || 0,
            stock: Number(stock) || 0,
            imageUrl: req.file 
                ? (req.file.url || `/images/${req.file.filename}`) 
                : (req.body.imageUrl ? sanitizeString(req.body.imageUrl) : (req.body.image_url ? sanitizeString(req.body.image_url) : null)),
            status: status || 'active'
        });
        res.status(201).json({ message: 'تم إنشاء خيار المنتج بنجاح', id });
    } catch (error) {
        console.error('Error creating variant:', error);
        res.status(500).json({ error: 'خطأ في إنشاء خيار المنتج', message: 'خطأ في إنشاء خيار المنتج', code: 'VARIANT_CREATE_FAILED' });
    }
}

async function updateProductVariant(req, res) {
    try {
        const variantId = parseInt(req.params.variantId, 10);
        if (isNaN(variantId)) return res.status(400).json({ error: 'معرف الخيار غير صالح', message: 'معرف الخيار غير صالح', code: 'INVALID_VARIANT_ID' });
        const updateData = { ...req.body };
        if (updateData.name) updateData.name = sanitizeString(updateData.name);
        if (updateData.sku) updateData.sku = sanitizeString(updateData.sku, '', 100);
        if (updateData.priceModifier !== undefined) updateData.priceModifier = Number(updateData.priceModifier);
        if (updateData.stock !== undefined) updateData.stock = Number(updateData.stock);
        if (req.file) {
            updateData.imageUrl = req.file.url || `/images/${req.file.filename}`;
        } else if (updateData.imageUrl !== undefined || updateData.image_url !== undefined) {
            const rawUrl = updateData.imageUrl !== undefined ? updateData.imageUrl : updateData.image_url;
            updateData.imageUrl = rawUrl ? sanitizeString(rawUrl) : null;
        }

        const success = await db.updateProductVariant(variantId, updateData);
        if (!success) return res.status(404).json({ error: 'الخيار غير موجود', message: 'الخيار غير موجود', code: 'VARIANT_NOT_FOUND' });
        res.json({ message: 'تم تحديث خيار المنتج بنجاح' });
    } catch (error) {
        console.error('Error updating variant:', error);
        res.status(500).json({ error: 'خطأ في تحديث خيار المنتج', message: 'خطأ في تحديث خيار المنتج', code: 'VARIANT_UPDATE_FAILED' });
    }
}

async function deleteProductVariant(req, res) {
    try {
        const variantId = parseInt(req.params.variantId, 10);
        if (isNaN(variantId)) return res.status(400).json({ error: 'معرف الخيار غير صالح', message: 'معرف الخيار غير صالح', code: 'INVALID_VARIANT_ID' });
        const success = await db.deleteProductVariant(variantId);
        if (!success) return res.status(404).json({ error: 'الخيار غير موجود', message: 'الخيار غير موجود', code: 'VARIANT_NOT_FOUND' });
        res.json({ message: 'تم حذف خيار المنتج بنجاح' });
    } catch (error) {
        console.error('Error deleting variant:', error);
        res.status(500).json({ error: 'خطأ في حذف خيار المنتج', message: 'خطأ في حذف خيار المنتج', code: 'VARIANT_DELETE_FAILED' });
    }
}

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    autocomplete,
    recommendations,
    getProductReviews,
    addProductReview,
    getProductVariants,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant
};
