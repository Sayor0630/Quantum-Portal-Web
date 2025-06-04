import mongoose, { Document, Schema, Model } from 'mongoose';
import Product from './Product'; // Assuming Product.ts is in the same directory
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

// Static method to update product rating
ReviewSchema.statics.updateProductRating = async function(productId: mongoose.Types.ObjectId) {
  try {
    const reviews = await this.find({ product: productId, status: 'approved' });
    const numberOfReviews = reviews.length;
    const averageRating = numberOfReviews > 0
      ? reviews.reduce((acc: number, item: any) => item.rating + acc, 0) / numberOfReviews
      : 0;

    await Product.findByIdAndUpdate(productId, {
      averageRating: parseFloat(averageRating.toFixed(2)), // Store with 2 decimal places
      numberOfReviews: numberOfReviews,
    });
  } catch (error) {
    console.error(`Error updating product rating for productId ${productId}:`, error);
    // Decide if this error should be propagated further or just logged
  }
};

// Hook to update product rating after a review is saved
ReviewSchema.post<IReview>('save', async function() {
  // 'this' refers to the review document that was saved
  // Access the static method via this.constructor
  await (this.constructor as any).updateProductRating(this.product);
});

// Hook to update product rating after a review is deleted
ReviewSchema.post<IReview>('findOneAndDelete', async function(doc: IReview | null) {
  if (doc) {
    // 'doc' is the review document that was deleted
    // Access the static method via doc.constructor
    await (doc.constructor as any).updateProductRating(doc.product);
  }
});


const ReviewModel: Model<IReview> = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

export default ReviewModel;
export type { IReview }; // Exporting IReview for use in API routes
