import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import AdminUser from '../../../../models/AdminUser';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

// Define roles that an admin can have, superadmin can assign these
const ALLOWED_ADMIN_ROLES = ['admin', 'contentManager', 'orderManager', 'superadmin'];
// Superadmin role should ideally not be assignable/changeable to prevent escalation issues by non-initial superadmins.
// For now, including it, but a real system might have a separate process for initial superadmin or more granular permissions.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || (session.user as { role?: string })?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: Only superadmins can manage admin users.' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET': // List all admin users
      try {
        const admins = await AdminUser.find({}).select('-password').lean(); // Exclude passwords
        return res.status(200).json(admins);
      } catch (error) {
        console.error('Error fetching admin users:', error);
        return res.status(500).json({ message: 'Error fetching admin users', error: (error as Error).message });
      }

    case 'POST': // Create a new admin user by a superadmin
      try {
        const { email, password, role, isActive } = req.body;

        if (!email || !password || !role) {
          return res.status(400).json({ message: 'Email, password, and role are required.' });
        }
        if (!ALLOWED_ADMIN_ROLES.includes(role)) {
          return res.status(400).json({ message: `Invalid role. Must be one of: ${ALLOWED_ADMIN_ROLES.join(', ')}` });
        }
        if (password.length < 8) {
             return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }
        // Add more password complexity validation if needed (e.g., regex for uppercase, number, symbol)


        const existingAdmin = await AdminUser.findOne({ email: String(email).trim().toLowerCase() });
        if (existingAdmin) {
          return res.status(409).json({ message: 'An admin user with this email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newAdmin = await AdminUser.create({
          email: String(email).trim().toLowerCase(),
          password: hashedPassword,
          role,
          isActive: isActive !== undefined ? !!isActive : true,
        });

        const adminResponse = newAdmin.toObject();
        delete adminResponse.password;

        return res.status(201).json(adminResponse);
      } catch (error) {
        console.error('Error creating admin user:', error);
        // Check for specific mongoose validation errors if needed, e.g. from unique index
        if ((error as mongoose.Error.ValidationError)?.errors) {
            return res.status(400).json({ message: 'Validation error', errors: (error as mongoose.Error.ValidationError).errors });
        }
        return res.status(500).json({ message: 'Error creating admin user', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
