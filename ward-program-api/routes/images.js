// routes/images.js
// Ward image library — upload, browse, assign to programs, delete
const express = require('express');
const multer  = require('multer');
const { getPool, sql } = require('../db');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/requireRole');
const { uploadImageBuffer, generateSasUrl, deleteBlob, getContainer } = require('../utils/blob');

const router = express.Router();

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

// ── SAS expiry helper ─────────────────────────────────────────────────────────
const SAS_EXPIRY_MINUTES = 60;


// =============================================================================
// PROGRAM COVER IMAGE ASSIGNMENT
// =============================================================================


// New: GET /api/images/programs/:id/serve — stream a program's cover image
router.get('/programs/:id/serve', verifyToken, async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    const r = await getPool().request()
      .input('program_id', sql.Int, programId)
      .execute('dbo.usp_GetProgramCoverImage');
    const img = r.recordset[0];
    if (!img) return res.status(404).json({ error: 'No library image assigned.' });

    const container = getContainer();
    const blobClient = container.getBlockBlobClient(img.blob_name);
    const download = await blobClient.download();

    res.set('Content-Type', img.mime_type);
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    download.readableStreamBody.pipe(res);
  } catch (err) {
    console.error('[Images] GET /programs/:id/serve error:', err);
    return res.status(500).json({ error: 'Failed to stream image.' });
  }
});

// New: GET /api/images/:id/serve  — stream a library image
router.get('/:id/serve', verifyToken, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid image ID.' });

    const r = await getPool().request()
      .input('id', sql.Int, imageId)
      .execute('dbo.usp_GetWardImageById');
    const img = r.recordset[0];
    if (!img) return res.status(404).json({ error: 'Image not found.' });

    const container = getContainer();
    const blobClient = container.getBlockBlobClient(img.blob_name);
    const download = await blobClient.download();

    res.set('Content-Type', img.mime_type);
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    download.readableStreamBody.pipe(res);
  } catch (err) {
    console.error('[Images] GET /:id/serve error:', err);
    return res.status(500).json({ error: 'Failed to stream image.' });
  }
});


// ── PUT /api/images/programs/:id — Assign a library image to a program ────────
router.put(
  '/programs/:id',
  verifyToken,
  requireRole('bishopric', 'editor'),
  async (req, res) => {
    try {
      const programId = parseInt(req.params.id);
      if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

      const { imageId } = req.body; // null = clear image
      const resolvedImageId = imageId ? parseInt(imageId) : null;

      // Validate the image exists if one is being assigned
      if (resolvedImageId) {
        const check = await getPool().request()
          .input('id', sql.Int, resolvedImageId)
          .execute('dbo.usp_GetWardImageById');
        if (!check.recordset[0]) {
          return res.status(404).json({ error: 'Image not found in library.' });
        }
      }

      await getPool().request()
        .input('program_id',   sql.Int,         programId)
        .input('image_id',     sql.Int,         resolvedImageId)
        .input('image_source', sql.NVarChar(20), resolvedImageId ? 'library' : 'url')
        .execute('dbo.usp_SetProgramCoverImage');

      // Return fresh SAS URL if an image was assigned
      let sasUrl = null;
      if (resolvedImageId) {
        const r = await getPool().request()
          .input('id', sql.Int, resolvedImageId)
          .execute('dbo.usp_GetWardImageById');
        sasUrl = await generateSasUrl(r.recordset[0].blob_name, SAS_EXPIRY_MINUTES);
      }

      return res.json({ message: 'Cover image updated.', sasUrl });
    } catch (err) {
      if (err.message?.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      console.error('[Images] PUT /programs/:id error:', err);
      return res.status(500).json({ error: 'Failed to update cover image.' });
    }
  }
);

// ── GET /api/images/programs/:id/sas — Fresh SAS for a program's cover image ──
// Called by PDFGenerator on generate — ensures URL is never expired
router.get('/programs/:id/sas', verifyToken, async (req, res) => {
  try {
    const programId = parseInt(req.params.id);
    if (isNaN(programId)) return res.status(400).json({ error: 'Invalid program ID.' });

    const r = await getPool().request()
      .input('program_id', sql.Int, programId)
      .execute('dbo.usp_GetProgramCoverImage');

    const img = r.recordset[0];
    if (!img) return res.status(404).json({ error: 'No library image assigned to this program.' });

    const sasUrl = await generateSasUrl(img.blob_name, SAS_EXPIRY_MINUTES);
    return res.json({ sasUrl });
  } catch (err) {
    console.error('[Images] GET /programs/:id/sas error:', err);
    return res.status(500).json({ error: 'Failed to generate image URL.' });
  }
});

// =============================================================================
// LIBRARY ROUTES
// =============================================================================

// ── GET /api/images — Get all library images (with fresh SAS URLs) ────────────
router.get('/', verifyToken, async (_req, res) => {
  try {
    const r = await getPool().request().execute('dbo.usp_GetWardImages');
    // Generate SAS URLs for all images in parallel
    const images = await Promise.all(r.recordset.map(async (img) => ({
      id:          img.id,
      fileName:    img.file_name,
      mimeType:    img.mime_type,
      fileSizeKb:  img.file_size_kb,
      uploadedAt:  img.uploaded_at,
      sasUrl:      await generateSasUrl(img.blob_name, SAS_EXPIRY_MINUTES),
    })));
    return res.json(images);
  } catch (err) {
    console.error('[Images] GET / error:', err);
    return res.status(500).json({ error: 'Failed to fetch image library.' });
  }
});

// ── POST /api/images — Upload a new image to the library ─────────────────────
router.post(
  '/',
  verifyToken,
  requireRole('bishopric', 'editor'),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

      const fileSizeKb = Math.ceil(req.file.size / 1024);

      // ── Upload to blob storage ──────────────────────────────────────────
      // Use timestamp-based name — no program ID needed anymore
      const blobName = await uploadImageBuffer(
        req.file.buffer,
        req.file.mimetype,
        'library'   // ← goes into library/ folder in blob storage
      );

      // ── Save to WardImages table ────────────────────────────────────────
      
      const safeFileName = req.file.originalname
        .replace(/[^a-zA-Z0-9._\- ]/g, '_')  // strip unsafe chars
        .substring(0, 255);                    // enforce max length


      const r = await getPool().request()
        .input('blob_name',    sql.NVarChar(500), blobName)
        .input('file_name',    sql.NVarChar(255), safeFileName)
        .input('mime_type',    sql.NVarChar(50),  req.file.mimetype)
        .input('file_size_kb', sql.Int,           fileSizeKb)
        .input('uploaded_by',  sql.Int,           req.user.id)
        .execute('dbo.usp_CreateWardImage');

      const img = r.recordset[0];
      const sasUrl = await generateSasUrl(blobName, SAS_EXPIRY_MINUTES);

      return res.status(201).json({
        id:         img.id,
        fileName:   img.file_name,
        mimeType:   img.mime_type,
        fileSizeKb: img.file_size_kb,
        uploadedAt: img.uploaded_at,
        sasUrl,
      });
    } catch (err) {
      console.error('[Images] POST / error:', err);
      return res.status(500).json({ error: 'Failed to upload image.' });
    }
  }
);

// ── GET /api/images/:id/sas — Get a fresh SAS URL for a single library image ──
// Used by PDFGenerator when it needs to refresh an expired URL
router.get('/:id/sas', verifyToken, async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid image ID.' });

    const r = await getPool().request()
      .input('id', sql.Int, imageId)
      .execute('dbo.usp_GetWardImageById');

    const img = r.recordset[0];
    if (!img) return res.status(404).json({ error: 'Image not found.' });

    const sasUrl = await generateSasUrl(img.blob_name, SAS_EXPIRY_MINUTES);
    return res.json({ sasUrl });
  } catch (err) {
    console.error('[Images] GET /:id/sas error:', err);
    return res.status(500).json({ error: 'Failed to generate image URL.' });
  }
});



// ── DELETE /api/images/:id — Delete a library image ──────────────────────────
// Only succeeds if no active programs are using it
router.delete(
  '/:id',
  verifyToken,
  requireRole('bishopric', 'editor'),
  async (req, res) => {
    try {
      const imageId = parseInt(req.params.id);
      if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid image ID.' });

      // usp_DeleteWardImage throws 50409 if image is in use,
      // and returns blob_name before deleting the row
      const r = await getPool().request()
        .input('id', sql.Int, imageId)
        .execute('dbo.usp_DeleteWardImage');

      const blobName = r.recordset[0]?.blob_name ?? null;
      await deleteBlob(blobName);

      return res.json({ message: 'Image deleted from library.' });
    } catch (err) {
      if (err.number === 50409) {
        return res.status(409).json({
          error: 'This image is in use by one or more active programs and cannot be deleted.',
        });
      }
      console.error('[Images] DELETE /:id error:', err);
      return res.status(500).json({ error: 'Failed to delete image.' });
    }
  }
);



module.exports = router;