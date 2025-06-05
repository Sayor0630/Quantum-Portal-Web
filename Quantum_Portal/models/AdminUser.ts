import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAdminUser extends Document {
  email: string;
  password?: string; // Make optional so it can be deleted
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

// Ensure the model is not recompiled if it already exists
const AdminUserModel: Model<IAdminUser> = mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);

export default AdminUserModel;
export type { IAdminUser as AdminUserType }; // Exporting type with a different alias if needed
