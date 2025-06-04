import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IAdminUser extends Document {
  email: string;
  password_hash: string; // In schema, use 'password'. Hashing is an application concern.
  role: string;
  isActive: boolean; // New field
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema: Schema<IAdminUser> = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: { // This will store the hashed password
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
    // Consider an enum if roles are fixed: enum: ['admin', 'superadmin', 'editor'],
    default: 'admin',
  },
  isActive: { // New field added
    type: Boolean,
    default: true,
  },
  // createdAt and updatedAt are handled by timestamps: true
}, { timestamps: true }); // This automatically adds createdAt and updatedAt

// Pre-save hook for updatedAt (already handled by timestamps: true)
// AdminUserSchema.pre<IAdminUser>('save', function (next) {
//   if (this.isModified()) {
//     this.updatedAt = new Date();
//   }
//   next();
// });

AdminUserSchema.pre<IAdminUser>('save', async function(next) {
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
    if (error instanceof Error) {
        return next(error);
    }
    return next(new Error('AdminUser password hashing failed'));
  }
});

// Ensure the model is not recompiled if it already exists
const AdminUserModel: Model<IAdminUser> = mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

export default AdminUserModel;
export type { IAdminUser as AdminUserType }; // Exporting type with a different alias if needed
