import mongoose, { Document, Schema, Model } from 'mongoose';

// Order status enum
export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'on-hold', 'failed'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

// Address interface for orders
export interface IOrderAddress {
  fullName?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

// Order item interface
export interface IOrderItem {
  product: mongoose.Schema.Types.ObjectId | null;
  quantity: number;
  price: number; // Price at time of order
}

// Payment details interface
export interface IPaymentDetails {
  method?: string;
  status?: string;
  transactionId?: string;
  amount?: number;
}

// Main order interface
export interface IOrder extends Document {
  customer?: mongoose.Schema.Types.ObjectId;
  orderItems: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress?: IOrderAddress;
  billingAddress?: IOrderAddress;
  paymentDetails?: IPaymentDetails;
  adminNotes?: string;
  trackingNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order item schema
const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 }
});

// Address schema for orders
const OrderAddressSchema = new Schema<IOrderAddress>({
  fullName: { type: String, trim: true },
  street1: { type: String, required: true, trim: true },
  street2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  postalCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  phone: { type: String, trim: true }
}, { _id: false });

// Payment details schema
const PaymentDetailsSchema = new Schema<IPaymentDetails>({
  method: { type: String, trim: true },
  status: { type: String, trim: true },
  transactionId: { type: String, trim: true },
  amount: { type: Number, min: 0 }
}, { _id: false });

// Main order schema
const OrderSchema = new Schema<IOrder>({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  orderItems: { type: [OrderItemSchema], required: true, validate: [arrayMinLength, 'Order must have at least one item'] },
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
  shippingAddress: { type: OrderAddressSchema },
  billingAddress: { type: OrderAddressSchema },
  paymentDetails: { type: PaymentDetailsSchema },
  adminNotes: { type: String, trim: true },
  trackingNumber: { type: String, trim: true }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Validation function for array minimum length
function arrayMinLength(val: any[]) {
  return val && val.length >= 1;
}

// Indexes for better query performance
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });

const OrderModel: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default OrderModel;