import mongoose from 'mongoose';

const SiteDataSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const SiteData = mongoose.model('SiteData', SiteDataSchema);

export default SiteData;
