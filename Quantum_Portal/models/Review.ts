import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReview extends Document {
  product: mongoose.Schema.Types.ObjectId;
  customer: mongoose.Schema.Types.ObjectId; // Or user ID if not using a separate Customer model initially
  rating: number;
  comment?: string;
  status: 'pending' | 'approved' | 'rejected'; // New field for moderation
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema: Schema<IReview> = new Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }, // New field
  // createdAt and updatedAt are handled by timestamps: true
}, { timestamps: true }); // This automatically adds createdAt and updatedAt

// Pre-save hook for updatedAt (already handled by timestamps: true, but explicit for clarity if needed elsewhere)
// ReviewSchema.pre('save', function(next) {
//   if (this.isModified()) {
//     this.updatedAt = new Date();
//   }
//   next();
// });

const ReviewModel: Model<IReview> = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

export default ReviewModel;
export type { IReview }; // Exporting IReview for use in API routes
