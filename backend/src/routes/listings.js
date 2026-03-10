const express = require('express');
const { body, query } = require('express-validator');
const multer = require('multer');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /listings - get all active listings with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT l.*, u.business_name, u.city as user_city, u.rating_score, u.phone as user_phone, u.avatar_url as user_avatar
       FROM listings l
       JOIN users u ON l.user_id = u.id
       WHERE l.is_active = TRUE AND u.is_suspended = FALSE
       ORDER BY l.is_featured DESC, l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM listings l JOIN users u ON l.user_id = u.id WHERE l.is_active = TRUE AND u.is_suspended = FALSE'
    );

    res.json({
      listings: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /listings/featured - get featured listings (active slots only)
router.get('/featured', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Unfeatured expired slots
    await db.query(
      `UPDATE listings SET is_featured = FALSE
       WHERE is_featured = TRUE AND id NOT IN (
         SELECT listing_id FROM featured_slots WHERE start_date <= $1 AND end_date > $1
       )`,
      [today]
    );

    const result = await db.query(
      `SELECT l.*, u.business_name, u.city as user_city, u.rating_score, u.phone as user_phone, u.avatar_url as user_avatar
       FROM listings l
       JOIN users u ON l.user_id = u.id
       JOIN featured_slots fs ON fs.listing_id = l.id
       WHERE l.is_active = TRUE AND u.is_suspended = FALSE
         AND fs.start_date <= $1 AND fs.end_date > $1
       ORDER BY l.type, fs.created_at DESC`,
      [today]
    );

    const wts = result.rows.filter(l => l.type === 'WTS').slice(0, 3);
    const wtb = result.rows.filter(l => l.type === 'WTB').slice(0, 3);

    res.json({ featured: { wts, wtb } });
  } catch (err) {
    console.error('Get featured error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /listings/search - search listings
router.get('/search', async (req, res) => {
  try {
    const { keyword, type, city, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'l.is_active = TRUE AND u.is_suspended = FALSE';
    const values = [];
    let paramCount = 0;

    if (keyword) {
      paramCount++;
      whereClause += ` AND (l.title ILIKE $${paramCount} OR l.description ILIKE $${paramCount})`;
      values.push(`%${keyword}%`);
    }
    if (type && (type === 'WTS' || type === 'WTB')) {
      paramCount++;
      whereClause += ` AND l.type = $${paramCount}`;
      values.push(type);
    }
    if (city) {
      paramCount++;
      whereClause += ` AND l.city ILIKE $${paramCount}`;
      values.push(`%${city}%`);
    }
    if (category) {
      paramCount++;
      whereClause += ` AND l.category ILIKE $${paramCount}`;
      values.push(`%${category}%`);
    }

    paramCount++;
    values.push(limit);
    paramCount++;
    values.push(offset);

    const result = await db.query(
      `SELECT l.*, u.business_name, u.city as user_city, u.rating_score, u.phone as user_phone, u.avatar_url as user_avatar
       FROM listings l
       JOIN users u ON l.user_id = u.id
       WHERE ${whereClause}
       ORDER BY l.is_featured DESC, l.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      values
    );

    res.json({ listings: result.rows });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /listings/mine - get current user's listings
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: result.rows });
  } catch (err) {
    console.error('Get my listings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /listings/:id - get single listing with photos
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT l.*, u.business_name, u.city as user_city, u.rating_score, u.rating_count, u.phone as user_phone, u.bio as user_bio, u.avatar_url as user_avatar
       FROM listings l
       JOIN users u ON l.user_id = u.id
       WHERE l.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const photos = await db.query(
      'SELECT id, photo_url, sort_order FROM listing_photos WHERE listing_id = $1 ORDER BY sort_order',
      [req.params.id]
    );

    res.json({ listing: { ...result.rows[0], photos: photos.rows } });
  } catch (err) {
    console.error('Get listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /listings - create listing
router.post(
  '/',
  authenticate,
  [
    body('type').isIn(['WTS', 'WTB']).withMessage('Type must be WTS or WTB'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('price').optional().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('condition').optional().trim(),
    body('category').optional().trim(),
    body('city').trim().notEmpty().withMessage('City is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { type, title, description, price, quantity, condition, category, city } = req.body;

      const result = await db.query(
        `INSERT INTO listings (user_id, type, title, description, price, quantity, condition, category, city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          req.user.id,
          type,
          title,
          description || '',
          price || null,
          quantity || 1,
          condition || 'new',
          category || 'electronics',
          city,
        ]
      );

      res.status(201).json({ listing: result.rows[0] });
    } catch (err) {
      console.error('Create listing error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /listings/:id - update listing
router.put(
  '/:id',
  authenticate,
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('price').optional().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('condition').optional().trim(),
    body('category').optional().trim(),
    body('city').optional().trim().notEmpty(),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      // Verify ownership
      const existing = await db.query('SELECT user_id FROM listings WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Listing not found' });
      }
      if (existing.rows[0].user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const allowed = ['title', 'description', 'price', 'quantity', 'condition', 'category', 'city', 'is_active'];
      const fields = [];
      const values = [];
      let paramCount = 0;

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          paramCount++;
          fields.push(`${key} = $${paramCount}`);
          values.push(req.body[key]);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      fields.push('updated_at = NOW()');
      paramCount++;
      values.push(req.params.id);

      const result = await db.query(
        `UPDATE listings SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      res.json({ listing: result.rows[0] });
    } catch (err) {
      console.error('Update listing error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /listings/:id - delete listing
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await db.query('SELECT user_id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (existing.rows[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /listings/:id/photos - upload photos (up to 5)
router.post('/:id/photos', authenticate, upload.array('photos', 5), async (req, res) => {
  try {
    const existing = await db.query('SELECT user_id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (existing.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No photos provided' });

    // Check existing photo count
    const countResult = await db.query('SELECT COUNT(*) FROM listing_photos WHERE listing_id = $1', [req.params.id]);
    const existingCount = parseInt(countResult.rows[0].count);
    if (existingCount + req.files.length > 5) {
      return res.status(400).json({ error: `Can only have 5 photos total. Currently have ${existingCount}.` });
    }

    const uploaded = [];
    for (let i = 0; i < req.files.length; i++) {
      const { url, public_id } = await uploadImage(req.files[i].buffer);
      const result = await db.query(
        'INSERT INTO listing_photos (listing_id, photo_url, photo_public_id, sort_order) VALUES ($1, $2, $3, $4) RETURNING id, photo_url, sort_order',
        [req.params.id, url, public_id, existingCount + i]
      );
      uploaded.push(result.rows[0]);
    }

    res.status(201).json({ photos: uploaded });
  } catch (err) {
    console.error('Upload photos error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /listings/featured-slots - check today's slot availability
router.get('/featured-slots', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(
      `SELECT l.type, COUNT(*) as count
       FROM featured_slots fs
       JOIN listings l ON fs.listing_id = l.id
       WHERE fs.start_date <= $1 AND fs.end_date > $1
       GROUP BY l.type`,
      [today]
    );

    const slots = { WTS: 0, WTB: 0 };
    result.rows.forEach(r => { slots[r.type] = parseInt(r.count); });

    res.json({
      slots: {
        WTS: { used: slots.WTS, available: 3 - slots.WTS },
        WTB: { used: slots.WTB, available: 3 - slots.WTB },
      },
      price: 2.99,
    });
  } catch (err) {
    console.error('Featured slots error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /listings/:id/feature - purchase a featured slot ($2.99/day)
router.post('/:id/feature', authenticate, async (req, res) => {
  try {
    const listing = await db.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (listing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (listing.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
    if (!listing.rows[0].is_active) return res.status(400).json({ error: 'Listing is not active' });

    const today = new Date().toISOString().split('T')[0];
    const type = listing.rows[0].type;

    // Check if user already has a featured listing today
    const userSlot = await db.query(
      `SELECT fs.id FROM featured_slots fs
       JOIN listings l ON fs.listing_id = l.id
       WHERE l.user_id = $1 AND fs.start_date <= $2 AND fs.end_date > $2`,
      [req.user.id, today]
    );
    if (userSlot.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a featured listing today. Limit is 1 per day.' });
    }

    // Check type slot availability (max 3 per type per day)
    const typeCount = await db.query(
      `SELECT COUNT(*) FROM featured_slots fs
       JOIN listings l ON fs.listing_id = l.id
       WHERE l.type = $1 AND fs.start_date <= $2 AND fs.end_date > $2`,
      [type, today]
    );
    if (parseInt(typeCount.rows[0].count) >= 3) {
      return res.status(400).json({ error: `All 3 featured ${type} slots are taken for today. Try again tomorrow.` });
    }

    // Create featured slot (1 day)
    await db.query(
      `INSERT INTO featured_slots (listing_id, start_date, end_date, cost)
       VALUES ($1, $2, $2 + INTERVAL '1 day', 2.99)`,
      [req.params.id, today]
    );

    // Mark listing as featured
    await db.query('UPDATE listings SET is_featured = TRUE, updated_at = NOW() WHERE id = $1', [req.params.id]);

    res.json({ success: true, message: `Listing featured for today! Cost: $2.99` });
  } catch (err) {
    console.error('Feature listing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /listings/:id/photos/:photoId - delete a photo
router.delete('/:id/photos/:photoId', authenticate, async (req, res) => {
  try {
    const existing = await db.query('SELECT user_id FROM listings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
    if (existing.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const photo = await db.query('SELECT photo_public_id FROM listing_photos WHERE id = $1 AND listing_id = $2', [req.params.photoId, req.params.id]);
    if (photo.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });

    await deleteImage(photo.rows[0].photo_public_id);
    await db.query('DELETE FROM listing_photos WHERE id = $1', [req.params.photoId]);

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Delete photo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
