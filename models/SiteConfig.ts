import mongoose, { Schema, Document, Model } from 'mongoose';

interface IThemeColors {
  primaryColor: string;
  accentColor: string;
}

interface ISiteConfig extends Document {
  siteName: string;
  logoUrl?: string;
  faviconUrl?: string;
  themeSettings: {
    lightMode: IThemeColors;
    darkMode: IThemeColors;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SiteConfigSchema: Schema<ISiteConfig> = new Schema({
  siteName: { type: String, default: 'My E-commerce Site' },
  logoUrl: { type: String },
  faviconUrl: { type: String },
  themeSettings: {
    lightMode: {
      primaryColor: { type: String, default: '#FFFFFF' },
      accentColor: { type: String, default: '#0070f3' },
    },
    darkMode: {
      primaryColor: { type: String, default: '#000000' },
      accentColor: { type: String, default: '#0070f3' }, // Consider a different accent for dark mode
    },
  },
}, { timestamps: true }); // `timestamps: true` handles createdAt and updatedAt automatically

// Ensure only one SiteConfig document exists, or use a fixed ID for querying.
// For simplicity, we'll rely on application logic to fetch/update the single config.
// e.g., always findOne() or findOneAndUpdate() without specific ID queries.

const SiteConfig: Model<ISiteConfig> = mongoose.models.SiteConfig || mongoose.model<ISiteConfig>('SiteConfig', SiteConfigSchema);

export default SiteConfig;
export type { ISiteConfig, IThemeColors }; // Exporting types for use in API routes
