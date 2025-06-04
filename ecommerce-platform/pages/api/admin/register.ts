import { NextApiRequest, NextApiResponse } from 'next';
import AdminUser from '../../../models/AdminUser'; // Corrected path
import bcrypt from 'bcrypt';
import connectToDatabase from '../../../lib/dbConnect'; // Corrected path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await connectToDatabase();

    // Check if any admin users already exist
    const adminCount = await AdminUser.countDocuments();
    if (adminCount > 0) {
      return res.status(403).json({ message: 'Forbidden: Admin registration is only allowed during initial setup.' });
    }

    const { email, password } = req.body; // Role from req.body will be ignored for initial superadmin

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (password.length < 8) { // Changed from 6 to 8
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const existingAdmin = await AdminUser.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = new AdminUser({
      email,
      password: hashedPassword,
      role: 'superadmin', // Ensure first admin is superadmin
      isActive: true // Ensure first admin is active
    });

    await newAdmin.save();

    return res.status(201).json({
      message: 'Admin user created successfully.',
      user: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    // Check for duplicate key error (though findOne should catch it)
    if (error.code === 11000) {
        return res.status(409).json({ message: 'Admin with this email already exists (duplicate key).' });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
