import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { year, category } = req.body;
    const uploadPath = path.join(__dirname, '../public/gallery', year || 'uploads', category || '');
    
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|JPG|JPEG|PNG/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Gallery data file path
const GALLERY_DATA_PATH = path.join(__dirname, '../public/gallery-data.json');

// Helper: Read gallery data
async function readGalleryData() {
  try {
    const data = await fs.readFile(GALLERY_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default structure
    return { years: [] };
  }
}

// Helper: Write gallery data
async function writeGalleryData(data) {
  await fs.writeFile(GALLERY_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ==================== API ROUTES ====================

// GET /api/gallery - Get all gallery data
app.get('/api/gallery', async (req, res) => {
  try {
    const data = await readGalleryData();
    res.json(data.years || []);
  } catch (error) {
    console.error('Error reading gallery data:', error);
    res.status(500).json({ error: 'Failed to read gallery data' });
  }
});

// POST /api/gallery - Create new year or update entire gallery
app.post('/api/gallery', async (req, res) => {
  try {
    const { years } = req.body;
    if (!Array.isArray(years)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    await writeGalleryData({ years });
    res.json({ success: true, message: 'Gallery data saved successfully' });
  } catch (error) {
    console.error('Error saving gallery data:', error);
    res.status(500).json({ error: 'Failed to save gallery data' });
  }
});

// PUT /api/gallery/year/:yearId - Update a specific year
app.put('/api/gallery/year/:yearId', async (req, res) => {
  try {
    const { yearId } = req.params;
    const updatedYear = req.body;
    
    const data = await readGalleryData();
    const yearIndex = data.years.findIndex(y => y.year === yearId);
    
    if (yearIndex === -1) {
      return res.status(404).json({ error: 'Year not found' });
    }
    
    data.years[yearIndex] = { ...data.years[yearIndex], ...updatedYear };
    await writeGalleryData(data);
    
    res.json({ success: true, year: data.years[yearIndex] });
  } catch (error) {
    console.error('Error updating year:', error);
    res.status(500).json({ error: 'Failed to update year' });
  }
});

// DELETE /api/gallery/year/:yearId - Delete a year
app.delete('/api/gallery/year/:yearId', async (req, res) => {
  try {
    const { yearId } = req.params;
    const data = await readGalleryData();
    
    data.years = data.years.filter(y => y.year !== yearId);
    await writeGalleryData(data);
    
    res.json({ success: true, message: 'Year deleted successfully' });
  } catch (error) {
    console.error('Error deleting year:', error);
    res.status(500).json({ error: 'Failed to delete year' });
  }
});

// POST /api/gallery/upload - Upload image file
app.post('/api/gallery/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { year, category } = req.body;
    const filePath = `/gallery/${year || 'uploads'}/${category || ''}/${req.file.filename}`;
    
    res.json({
      success: true,
      url: filePath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// DELETE /api/gallery/image - Delete an image file
app.delete('/api/gallery/image', async (req, res) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }
    
    // Remove leading slash and construct full path
    const filePath = path.join(__dirname, '..', imagePath.startsWith('/') ? imagePath.slice(1) : imagePath);
    
    try {
      await fs.unlink(filePath);
      res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gallery API server running on http://localhost:${PORT}`);
  console.log(`📁 Gallery data: ${GALLERY_DATA_PATH}`);
  console.log(`📸 Upload directory: ${path.join(__dirname, '../public/gallery')}`);
});
