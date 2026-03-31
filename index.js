import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import Newsletter from './models/Newsletter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://amenity:forge2025@cluster0.eiramxt.mongodb.net/Ettechx?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
  });

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
  const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|avif|heic|heif|JPG|JPEG|PNG|GIF|WEBP|BMP|AVIF|HEIC|HEIF/;
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
// Sponsors data file path
const SPONSORS_DATA_PATH = path.join(__dirname, '../public/sponsors-data.json');

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

// Helper: Read sponsors data
async function readSponsorsData() {
  try {
    const data = await fs.readFile(SPONSORS_DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default structure
    return { sponsors: [] };
  }
}

// Helper: Write sponsors data
async function writeSponsorsData(data) {
  await fs.writeFile(SPONSORS_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
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
    
    // Gallery uploads must be stored in Cloudinary.
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        error: 'Cloudinary is not configured on server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
      });
    }

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
      res.status(502).json({ error: 'Cloudinary upload failed. Image was not saved.' });
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

// ==================== SPONSORS API ROUTES ====================

// GET /api/sponsors - Get all sponsors data
app.get('/api/sponsors', async (req, res) => {
  try {
    const data = await readSponsorsData();
    res.json(data.sponsors || []);
  } catch (error) {
    console.error('Error reading sponsors data:', error);
    res.status(500).json({ error: 'Failed to read sponsors data' });
  }
});

// POST /api/sponsors - Create new sponsor or update entire sponsors data
app.post('/api/sponsors', async (req, res) => {
  try {
    const { sponsors } = req.body;
    if (!Array.isArray(sponsors)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    await writeSponsorsData({ sponsors });
    res.json({ success: true, message: 'Sponsors data saved successfully' });
  } catch (error) {
    console.error('Error saving sponsors data:', error);
    res.status(500).json({ error: 'Failed to save sponsors data' });
  }
});

// PUT /api/sponsors/:sponsorId - Update a specific sponsor
app.put('/api/sponsors/:sponsorId', async (req, res) => {
  try {
    const { sponsorId } = req.params;
    const updatedSponsor = req.body;
    
    const data = await readSponsorsData();
    const sponsorIndex = data.sponsors.findIndex(s => s.id === sponsorId);
    
    if (sponsorIndex === -1) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }
    
    data.sponsors[sponsorIndex] = { ...data.sponsors[sponsorIndex], ...updatedSponsor };
    await writeSponsorsData(data);
    
    res.json({ success: true, sponsor: data.sponsors[sponsorIndex] });
  } catch (error) {
    console.error('Error updating sponsor:', error);
    res.status(500).json({ error: 'Failed to update sponsor' });
  }
});

// DELETE /api/sponsors/:sponsorId - Delete a sponsor
app.delete('/api/sponsors/:sponsorId', async (req, res) => {
  try {
    const { sponsorId } = req.params;
    const data = await readSponsorsData();
    
    data.sponsors = data.sponsors.filter(s => s.id !== sponsorId);
    await writeSponsorsData(data);
    
    res.json({ success: true, message: 'Sponsor deleted successfully' });
  } catch (error) {
    console.error('Error deleting sponsor:', error);
    res.status(500).json({ error: 'Failed to delete sponsor' });
  }
});

// POST /api/sponsors/upload - Upload sponsor logo file
app.post('/api/sponsors/upload', speakerUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const folder = 'sponsors';
    
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
    console.error('Error uploading sponsor logo:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// DELETE /api/sponsors/image - Delete a sponsor logo file
app.delete('/api/sponsors/image', async (req, res) => {
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
    console.error('Error deleting sponsor image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ==================== NEWSLETTER API ROUTES ====================

// GET /api/newsletters - Get all newsletters
app.get('/api/newsletters', async (req, res) => {
  try {
    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    res.json(newsletters);
  } catch (error) {
    console.error('Error fetching newsletters:', error);
    res.status(500).json({ error: 'Failed to fetch newsletters' });
  }
});

// GET /api/newsletters/published/latest - Get latest published newsletter
// NOTE: This must be defined BEFORE /api/newsletters/:id to prevent "published" from being treated as an :id
app.get('/api/newsletters/published/latest', async (req, res) => {
  try {
    const newsletter = await Newsletter.findOne({ isPublished: true })
      .sort({ createdAt: -1 });
    if (!newsletter) {
      return res.status(404).json({ error: 'No published newsletter found' });
    }
    res.json(newsletter);
  } catch (error) {
    console.error('Error fetching latest newsletter:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter' });
  }
});

// GET /api/newsletters/:id - Get a specific newsletter
app.get('/api/newsletters/:id', async (req, res) => {
  try {
    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }
    res.json(newsletter);
  } catch (error) {
    console.error('Error fetching newsletter:', error);
    res.status(500).json({ error: 'Failed to fetch newsletter' });
  }
});

// POST /api/newsletters - Create a new newsletter
app.post('/api/newsletters', async (req, res) => {
  try {
    const newsletterData = req.body;
    const newsletter = new Newsletter(newsletterData);
    await newsletter.save();
    res.status(201).json({ success: true, newsletter });
  } catch (error) {
    console.error('Error creating newsletter:', error);
    if (error && error.name === 'ValidationError') {
      const details = Object.values(error.errors || {})
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ error: `Validation failed: ${details}` });
    }
    res.status(500).json({ error: error?.message || 'Failed to create newsletter' });
  }
});

// PUT /api/newsletters/:id - Update a newsletter
app.put('/api/newsletters/:id', async (req, res) => {
  try {
    const newsletter = await Newsletter.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }
    res.json({ success: true, newsletter });
  } catch (error) {
    console.error('Error updating newsletter:', error);
    if (error && error.name === 'ValidationError') {
      const details = Object.values(error.errors || {})
        .map((e) => e.message)
        .join(', ');
      return res.status(400).json({ error: `Validation failed: ${details}` });
    }
    res.status(500).json({ error: error?.message || 'Failed to update newsletter' });
  }
});

// DELETE /api/newsletters/:id - Delete a newsletter
app.delete('/api/newsletters/:id', async (req, res) => {
  try {
    const newsletter = await Newsletter.findByIdAndDelete(req.params.id);
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }
    res.json({ success: true, message: 'Newsletter deleted successfully' });
  } catch (error) {
    console.error('Error deleting newsletter:', error);
    res.status(500).json({ error: 'Failed to delete newsletter' });
  }
});

// POST /api/newsletters/:id/publish - Publish/unpublish a newsletter
app.post('/api/newsletters/:id/publish', async (req, res) => {
  try {
    const { isPublished } = req.body;
    const newsletter = await Newsletter.findByIdAndUpdate(
      req.params.id,
      { isPublished },
      { new: true }
    );
    if (!newsletter) {
      return res.status(404).json({ error: 'Newsletter not found' });
    }
    res.json({ success: true, newsletter });
  } catch (error) {
    console.error('Error publishing newsletter:', error);
    res.status(500).json({ error: 'Failed to update newsletter status' });
  }
});

// POST /api/newsletters/upload/banner - Upload newsletter banner image
app.post('/api/newsletters/upload/banner', speakerUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const folder = 'newsletters/banners';
    
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
    console.error('Error uploading newsletter banner:', error);
    res.status(500).json({ error: 'Failed to upload banner image' });
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
  console.log(`📁 Sponsors data: ${SPONSORS_DATA_PATH}`);
  console.log(`📸 Gallery upload directory: ${path.join(__dirname, '../public/gallery')}`);
  console.log(`👤 Speakers upload directory: ${path.join(__dirname, '../public/speakers')}`);
  console.log(`🏢 Sponsors upload directory: ${path.join(__dirname, '../public/sponsors')}`);
});
