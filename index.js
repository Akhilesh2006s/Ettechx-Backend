import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Convert buffer to stream
    const stream = Readable.from(file.buffer);
    stream.pipe(uploadStream);
  });
};

// Helper function to delete from Cloudinary
const deleteFromCloudinary = async (imageUrl) => {
  try {
    // Extract public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{filename}
    if (imageUrl.includes('cloudinary.com')) {
      const urlParts = imageUrl.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      if (uploadIndex !== -1) {
        const pathParts = urlParts.slice(uploadIndex + 1);
        // Remove file extension for public_id
        const publicId = pathParts.join('/').replace(/\.[^/.]+$/, '');
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
      }
    }
    return null;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for gallery file uploads
const galleryStorage = multer.diskStorage({
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

// Configure multer for speaker image uploads
const speakerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/speakers');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename or generate unique one
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|JPG|JPEG|PNG/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Use memory storage for Cloudinary (files will be uploaded directly)
const memoryStorage = multer.memoryStorage();

const galleryUpload = multer({
  storage: memoryStorage, // Changed to memory storage for Cloudinary
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: imageFilter
});

const speakerUpload = multer({
  storage: memoryStorage, // Changed to memory storage for Cloudinary
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: imageFilter
});

// Gallery data file path
const GALLERY_DATA_PATH = path.join(__dirname, '../public/gallery-data.json');
// Speakers data file path
const SPEAKERS_DATA_PATH = path.join(__dirname, '../public/speakers-data.json');

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

// Helper: Read speakers data
async function readSpeakersData() {
  try {
    const data = await fs.readFile(SPEAKERS_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default structure
    return { groups: [] };
  }
}

// Helper: Write speakers data
async function writeSpeakersData(data) {
  await fs.writeFile(SPEAKERS_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
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
app.post('/api/gallery/upload', galleryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { year, category } = req.body;
    const folder = `gallery/${year || 'uploads'}/${category || ''}`;
    
    // Upload to Cloudinary if configured, otherwise use local storage
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const result = await uploadToCloudinary(req.file, folder);
        res.json({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          filename: result.original_filename,
          originalName: req.file.originalname,
          size: result.bytes
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        // Fallback to local storage if Cloudinary fails
        const uploadPath = path.join(__dirname, '../public', folder);
        await fs.mkdir(uploadPath, { recursive: true });
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(req.file.originalname);
        const filename = `${uniqueSuffix}${ext}`;
        const filePath = path.join(uploadPath, filename);
        await fs.writeFile(filePath, req.file.buffer);
        res.json({
          success: true,
          url: `/${folder}/${filename}`,
          filename: filename,
          originalName: req.file.originalname,
          size: req.file.size
        });
      }
    } else {
      // Local storage fallback
      const uploadPath = path.join(__dirname, '../public', folder);
      await fs.mkdir(uploadPath, { recursive: true });
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname);
      const filename = `${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadPath, filename);
      await fs.writeFile(filePath, req.file.buffer);
      res.json({
        success: true,
        url: `/${folder}/${filename}`,
        filename: filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    }
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
    
    // Check if it's a Cloudinary URL
    if (imagePath.includes('cloudinary.com')) {
      try {
        await deleteFromCloudinary(imagePath);
        res.json({ success: true, message: 'Image deleted successfully from Cloudinary' });
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        res.status(500).json({ error: 'Failed to delete image from Cloudinary' });
      }
    } else {
      // Local file deletion
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
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ==================== SPEAKERS API ROUTES ====================

// GET /api/speakers - Get all speakers data
app.get('/api/speakers', async (req, res) => {
  try {
    const data = await readSpeakersData();
    res.json(data.groups || []);
  } catch (error) {
    console.error('Error reading speakers data:', error);
    res.status(500).json({ error: 'Failed to read speakers data' });
  }
});

// POST /api/speakers - Create new speaker group or update entire speakers data
app.post('/api/speakers', async (req, res) => {
  try {
    const { groups } = req.body;
    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    await writeSpeakersData({ groups });
    res.json({ success: true, message: 'Speakers data saved successfully' });
  } catch (error) {
    console.error('Error saving speakers data:', error);
    res.status(500).json({ error: 'Failed to save speakers data' });
  }
});

// PUT /api/speakers/group/:groupId - Update a specific speaker group
app.put('/api/speakers/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const updatedGroup = req.body;
    
    const data = await readSpeakersData();
    const groupIndex = data.groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    data.groups[groupIndex] = { ...data.groups[groupIndex], ...updatedGroup };
    await writeSpeakersData(data);
    
    res.json({ success: true, group: data.groups[groupIndex] });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/speakers/group/:groupId - Delete a speaker group
app.delete('/api/speakers/group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const data = await readSpeakersData();
    
    data.groups = data.groups.filter(g => g.id !== groupId);
    await writeSpeakersData(data);
    
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/speakers/upload - Upload speaker image file
app.post('/api/speakers/upload', speakerUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const folder = 'speakers';
    
    // Upload to Cloudinary if configured, otherwise use local storage
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const result = await uploadToCloudinary(req.file, folder);
        res.json({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          filename: result.original_filename,
          originalName: req.file.originalname,
          size: result.bytes
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        // Fallback to local storage if Cloudinary fails
        const uploadPath = path.join(__dirname, '../public', folder);
        await fs.mkdir(uploadPath, { recursive: true });
        const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext);
        const filename = `${nameWithoutExt}-${uniqueSuffix}${ext}`;
        const filePath = path.join(uploadPath, filename);
        await fs.writeFile(filePath, req.file.buffer);
        res.json({
          success: true,
          url: `/${folder}/${filename}`,
          filename: filename,
          originalName: req.file.originalname,
          size: req.file.size
        });
      }
    } else {
      // Local storage fallback
      const uploadPath = path.join(__dirname, '../public', folder);
      await fs.mkdir(uploadPath, { recursive: true });
      const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      const filename = `${nameWithoutExt}-${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadPath, filename);
      await fs.writeFile(filePath, req.file.buffer);
      res.json({
        success: true,
        url: `/${folder}/${filename}`,
        filename: filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    }
  } catch (error) {
    console.error('Error uploading speaker image:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// DELETE /api/speakers/image - Delete a speaker image file
app.delete('/api/speakers/image', async (req, res) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }
    
    // Check if it's a Cloudinary URL
    if (imagePath.includes('cloudinary.com')) {
      try {
        await deleteFromCloudinary(imagePath);
        res.json({ success: true, message: 'Image deleted successfully from Cloudinary' });
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        res.status(500).json({ error: 'Failed to delete image from Cloudinary' });
      }
    } else {
      // Local file deletion
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
    }
  } catch (error) {
    console.error('Error deleting speaker image:', error);
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
  console.log(`📁 Speakers data: ${SPEAKERS_DATA_PATH}`);
  console.log(`📸 Gallery upload directory: ${path.join(__dirname, '../public/gallery')}`);
  console.log(`👤 Speakers upload directory: ${path.join(__dirname, '../public/speakers')}`);
});
