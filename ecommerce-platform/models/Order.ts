import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrderItem extends Document {
  product: Types.ObjectId; // Reference to Product model
  name: string; // Denormalized product name
  price: number; // Price at the time of order
  quantity: number;
  image?: string; // Denormalized product image
}

const OrderItemSchema: Schema<IOrderItem> = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String }, // Optional
});


export interface IOrder extends Document {
  customer: Types.ObjectId; // Reference to Customer model
  orderItems: IOrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'failed' | 'completed' | 'on-hold';
  shippingAddress: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: { // Optional, if different from shipping
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  paymentMethod?: string;
  paymentResult?: { // Store some payment gateway response details
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  shippingPrice?: number;
  taxPrice?: number; // If you calculate taxes
  isPaid?: boolean;
  paidAt?: Date;
  isDelivered?: boolean;
  deliveredAt?: Date;
  trackingNumber?: string; // Added trackingNumber
  adminNotes?: { // Added adminNotes
    note: string;
    date: Date;
    by?: string;
  }[];
  createdAt: Date; // Provided by timestamps
  updatedAt: Date; // Provided by timestamps
}

const OrderSchema: Schema<IOrder> = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    orderItems: [OrderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed', 'completed', 'on-hold'],
      default: 'pending',
      required: true,
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    billingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
    paymentMethod: { type: String },
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    shippingPrice: { type: Number, default: 0 },
    taxPrice: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    trackingNumber: { type: String, trim: true, sparse: true },
    adminNotes: [{
        note: { type: String, required: true },
        date: { type: Date, default: Date.now },
        by: { type: String }
    }],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexing common query fields can improve performance
OrderSchema.index({ customer: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
