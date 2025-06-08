import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOrderItem extends Document {
  product: Types.ObjectId; // Reference to Product model
  name: string; // Denormalized product name
  sku?: string; // Denormalized SKU at the time of order (can be variant-specific)
  price: number; // Price at the time of order
  quantity: number;
  image?: string; // Denormalized product image
  selectedAttributes?: Map<string, string>; // Custom attributes selected for this order item (e.g., Color: Red, Size: Large)
  // Brand information (denormalized for order history)
  brand?: {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    logo?: string;
  };
  // Variant product fields
  isVariantProduct?: boolean; // Whether this order item is a variant product
  variantId?: string; // ID of the specific variant if applicable
}

const OrderItemSchema: Schema<IOrderItem> = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  sku: { type: String, trim: true }, // Optional SKU field
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String }, // Optional
  selectedAttributes: { type: Map, of: String }, // Custom attributes for this specific order item
  // Brand information (denormalized for order history) - optional field
  brand: {
    _id: { type: Schema.Types.ObjectId, ref: 'Brand', required: false },
    name: { type: String, trim: true, required: false },
    slug: { type: String, trim: true, required: false },
    logo: { type: String, trim: true, required: false }
  },
  // Variant product fields
  isVariantProduct: { type: Boolean, default: false }, // Whether this order item is a variant product
  variantId: { type: String, trim: true }, // ID of the specific variant if applicable
});


export interface IOrder extends Document {
  customer: Types.ObjectId; // Reference to Customer model
  orderNumber: string; // Unique order number
  orderItems: IOrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'failed' | 'completed' | 'on-hold';
  shippingAddress: {
    fullName: string;
    phone: string;
    email?: string;
    street: string; // For deliveryAddress (street/area)
    city: string;
    district: string;
    state?: string; // Optional, for broader region if needed
    postalCode: string;
    country: string;
  };
  billingAddress?: { // Optional, if different from shipping
    fullName: string;
    phone: string;
    email?: string;
    street: string;
    city: string;
    district: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  paymentMethod?: string;
  paymentStatus: 'unpaid' | 'paid';
  deliveryNote?: string;
  paymentResult?: { // Store some payment gateway response details
    id: string;
    status: string;
    update_time: string;
    email_address: string;
  };
  shippingPrice?: number;
  taxPrice?: number; // If you calculate taxes
  isPaid?: boolean; // Maintained for now, might be deprecated in favor of paymentStatus
  paidAt?: Date;
  isDelivered?: boolean;
  deliveredAt?: Date;
  createdAt: Date; // Provided by timestamps
  updatedAt: Date; // Provided by timestamps
}

const OrderSchema: Schema<IOrder> = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    orderNumber: { 
      type: String, 
      unique: true
    },
    orderItems: [OrderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed', 'completed', 'on-hold'],
      default: 'pending',
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
      required: true,
    },
    deliveryNote: {
      type: String,
      trim: true,
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String },
      street: { type: String, required: true }, // For deliveryAddress (street/area)
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String }, // Optional
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    billingAddress: { // Optional, but if provided, follows the same structure
      fullName: { type: String, required: false }, // Not required if billingAddress itself is optional
      phone: { type: String, required: false },
      email: { type: String },
      street: { type: String, required: false },
      city: { type: String, required: false },
      district: { type: String, required: false },
      state: { type: String },
      postalCode: { type: String, required: false },
      country: { type: String, required: false },
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
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexing common query fields can improve performance
OrderSchema.index({ customer: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

// Pre-save hook to generate order number if not provided
OrderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    // Generate robust but short order number: timestamp + random suffix
    const timestamp = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `${timestamp}${randomSuffix}`;
  }
  next();
});

// Add validation to ensure orderNumber is always present
OrderSchema.pre('validate', function(next) {
  if (!this.orderNumber) {
    // Generate robust but short order number: timestamp + random suffix
    const timestamp = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.orderNumber = `${timestamp}${randomSuffix}`;
  }
  next();
});

export default mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);
