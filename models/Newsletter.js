import mongoose from 'mongoose';

const NewsletterSchema = new mongoose.Schema({
  // Header Section
  bannerImageUrl: {
    type: String,
    required: true,
  },
  issueNumber: {
    type: String,
    required: true,
  },
  month: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  
  // Main Banner
  mainBannerHeading: {
    type: String,
    required: true,
  },
  mainBannerDescription: {
    type: String,
    required: true,
  },
  mainBannerCtaText: {
    type: String,
    required: true,
  },
  mainBannerCtaLink: {
    type: String,
    required: true,
  },
  
  // Featured Articles (3 articles)
  article1: {
    image: String,
    title: String,
    description: String,
    link: String,
  },
  article2: {
    image: String,
    title: String,
    description: String,
    link: String,
  },
  article3: {
    image: String,
    title: String,
    description: String,
    link: String,
  },
  
  // Optional Advertisement
  ad: {
    enabled: {
      type: Boolean,
      default: false,
    },
    image: String,
    link: String,
  },
  
  // Multiple Articles (array)
  articles: [{
    image: String,
    title: String,
    description: String,
    link: String,
  }],
  
  // Optional YouTube
  youtube: {
    enabled: {
      type: Boolean,
      default: false,
    },
    thumbnail: String,
    title: String,
    link: String,
  },
  
  // Feedback
  feedbackLink: {
    type: String,
    required: true,
  },
  
  // Contact Info
  officeAddress: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  websiteLink: {
    type: String,
    required: true,
  },
  
  // Disclaimer
  disclaimerText: {
    type: String,
    required: true,
  },
  
  // Social Links
  instagramLink: {
    type: String,
    required: true,
  },
  linkedinLink: {
    type: String,
    required: true,
  },
  youtubeChannelLink: {
    type: String,
    required: true,
  },
  
  // Metadata
  isPublished: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
NewsletterSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Newsletter = mongoose.model('Newsletter', NewsletterSchema);

export default Newsletter;
