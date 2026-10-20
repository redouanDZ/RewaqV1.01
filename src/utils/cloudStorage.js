const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Check if Cloud Storage is enabled via environment variables
 */
function getStorageProvider() {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        return 'cloudinary';
    }
    if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
        return 's3';
    }
    return 'local';
}

/**
 * Upload file to Cloudinary using secure signed HTTPS REST API
 */
async function uploadToCloudinary(filePath, options = {}) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = options.folder || process.env.CLOUDINARY_FOLDER || 'rewaq';

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const fileBuffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };
    const mimeType = mimeMap[ext] || 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    const payload = {
        file: base64Data,
        api_key: apiKey,
        timestamp: timestamp,
        folder: folder,
        signature: signature
    };

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Cloudinary upload failed with status ${response.status}`);
    }

    const data = await response.json();

    // Delete local temporary file after successful cloud upload
    await fs.promises.unlink(filePath).catch(() => {});

    return {
        url: data.secure_url || data.url,
        publicId: data.public_id,
        provider: 'cloudinary',
        bytes: data.bytes,
        format: data.format
    };
}

/**
 * Process uploaded file from multer:
 * Uploads to Cloud Storage if configured, or keeps in local /images directory.
 */
async function processUploadedFile(file, options = {}) {
    if (!file) return null;

    // Convert to WebP and scale to max width 1000px if needed
    if (file.path && fs.existsSync(file.path) && path.extname(file.path).toLowerCase() !== '.webp') {
        try {
            const sharp = require('sharp');
            const parsed = path.parse(file.path);
            const webpFilename = `${parsed.name}.webp`;
            const webpPath = path.join(parsed.dir, webpFilename);

            await sharp(file.path)
                .resize({ width: 1000, withoutEnlargement: true })
                .webp({ quality: 82 })
                .toFile(webpPath);

            if (file.path !== webpPath) {
                await fs.promises.unlink(file.path).catch(() => {});
            }

            file.path = webpPath;
            file.filename = webpFilename;
            file.mimetype = 'image/webp';
        } catch (e) {
            // Keep original if sharp conversion fails
        }
    }

    const provider = getStorageProvider();

    if (provider === 'cloudinary') {
        try {
            const cloudResult = await uploadToCloudinary(file.path, options);
            file.url = cloudResult.url;
            file.storageProvider = 'cloudinary';
            return file.url;
        } catch (err) {
            console.error('⚠️ Cloudinary upload failed, falling back to local file:', err.message);
            file.url = `/images/${file.filename}`;
            file.storageProvider = 'local';
            return file.url;
        }
    }

    // Default Local Storage
    file.url = `/images/${file.filename}`;
    file.storageProvider = 'local';
    return file.url;
}

module.exports = {
    getStorageProvider,
    uploadToCloudinary,
    processUploadedFile
};
