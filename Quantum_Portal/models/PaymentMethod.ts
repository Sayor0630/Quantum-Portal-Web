import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPaymentMethod extends Document {
  name: string;
  isEnabled: boolean;
  details?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema: Schema<IPaymentMethod> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Payment method name is required.'],
      unique: true,
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    details: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexing for frequent queries
PaymentMethodSchema.index({ name: 1 });
PaymentMethodSchema.index({ isEnabled: 1 });

const PaymentMethodModel: Model<IPaymentMethod> =
  mongoose.models.PaymentMethod || mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);

export default PaymentMethodModel;
