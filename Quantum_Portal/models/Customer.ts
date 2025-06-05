import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface for address subdocument (can be expanded)
export interface IAddress extends Document {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

const AddressSchema: Schema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
  isDefaultShipping: { type: Boolean, default: false },
  isDefaultBilling: { type: Boolean, default: false },
}, {_id: false}); // No separate _id for subdocuments unless needed for direct referencing

export interface ICustomer extends Document {
  email: string;
  password?: string; // Make optional so it can be deleted
  firstName?: string;
  lastName?: string;
  addresses?: IAddress[];
  wishlist?: mongoose.Schema.Types.ObjectId[];
  isActive: boolean; // New field
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema<ICustomer> = new Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // Will store hashed password
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  addresses: [AddressSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isActive: { type: Boolean, default: true }, // New field added here
  // createdAt and updatedAt are handled by timestamps: true
}, { timestamps: true }); // This automatically adds createdAt and updatedAt

// Pre-save hook for updatedAt (already handled by timestamps: true, but explicit for clarity if needed elsewhere)
// CustomerSchema.pre('save', function(next) {
//   if (this.isModified()) {
//     this.updatedAt = new Date();
//   }
//   next();
// });

const CustomerModel: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default CustomerModel;
