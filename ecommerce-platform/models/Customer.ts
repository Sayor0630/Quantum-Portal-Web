import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';

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
  password_hash: string; // In schema, use 'password' for simplicity, hashing handled separately
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

CustomerSchema.pre<ICustomer>('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10); // 10 rounds is generally recommended
    // Hash the password using the salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    // Pass error to next middleware if hashing fails
    // Ensure 'error' is of type Error for 'next'
    if (error instanceof Error) {
        return next(error);
    }
    // If not an Error instance, wrap it or handle appropriately
    return next(new Error('Password hashing failed'));
  }
});

const CustomerModel: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default CustomerModel;
export type { IAddress, ICustomer }; // Exporting ICustomer for use in API routes too
