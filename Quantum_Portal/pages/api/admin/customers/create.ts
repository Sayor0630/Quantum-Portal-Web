import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import Customer from '../../../../models/Customer';
import bcrypt from 'bcryptjs'; // Corrected import
import { authOptions } from '../../auth/[...nextauth]';
import { getServerSession } from 'next-auth/next';
import { hasPermission, Permission, Role } from '../../../../lib/permissions';
import mongoose from 'mongoose';

// Optional: Define a Zod schema for request body validation (good practice)
// import { z } from 'zod';
// const customerCreationSchema = z.object({ ... });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user || !(session.user as any).role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No valid session found' });
    }

    const userRole = (session.user as any).role as Role;
    if (!hasPermission(userRole, Permission.MANAGE_CUSTOMERS)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }

    await dbConnect();
    console.log('Database connected successfully'); // Add debug log

    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber, // Received, but not directly saved to Customer model's root due to schema
      isActive,
      addresses, // Expected to be an array of IAddress compatible objects
    } = req.body;

    console.log('Received customer data:', { firstName, lastName, email, phoneNumber, isActive, addresses: addresses?.length || 0 }); // Add debug log

    // --- Basic Validation ---
    if (!firstName || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields: firstName and password are required.' });
    }
    if (!phoneNumber || typeof phoneNumber !== 'string' || !/^01\d{9}$/.test(phoneNumber)) {
        return res.status(400).json({ success: false, message: 'Phone number is required and must be 11 digits starting with "01".' });
    }
    if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    // --- Email Uniqueness Check (only if email is provided) ---
    if (email) {
        const existingCustomerByEmail = await Customer.findOne({ email: email.toLowerCase() });
        if (existingCustomerByEmail) {
          return res.status(409).json({ success: false, message: 'Email already in use.' });
        }
    }

    // --- Password Hashing ---
    const hashedPassword = await bcrypt.hash(password, 12);

    // --- Customer Creation ---
    // Note: `phoneNumber` from req.body is not directly added to the Customer model here
    // as the Customer schema does not have a root-level `phoneNumber` field.
    // If addresses are provided and the IAddress interface supports phone, it would be in there.
    // The current IAddress in Customer.ts does not have 'phone'.

    // Validate and structure addresses
    const validAddresses: Array<{
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
        isDefaultShipping?: boolean;
        isDefaultBilling?: boolean;
    }> = [];
    if (addresses && Array.isArray(addresses)) {
        for (const addr of addresses) {
            // Basic check for core address fields
            if (addr.street && addr.city && addr.state && addr.zipCode && addr.country) {
                validAddresses.push({
                    street: addr.street,
                    city: addr.city,
                    state: addr.state, // Frontend maps 'district' to 'state'
                    zipCode: addr.zipCode,
                    country: addr.country,
                    isDefaultShipping: addr.isDefaultShipping || false,
                    isDefaultBilling: addr.isDefaultBilling || false,
                    // If IAddress in Customer model is updated to include phone:
                    // phone: addr.phone || undefined
                });
            } else {
                // Optionally, be strict and return 400 if an address object is incomplete
                // For now, just skipping incomplete address objects from client.
                console.warn("Skipping incomplete address object:", addr);
            }
        }
    }


    const newCustomer = new Customer({
      firstName,
      lastName,
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      phoneNumber, // Add phoneNumber field
      isActive: isActive !== undefined ? isActive : true, // Default to true if not provided
      addresses: validAddresses, // Use the validated and structured addresses
    });

    console.log('About to save customer:', newCustomer.toObject()); // Add debug log
    await newCustomer.save();
    console.log('Customer saved successfully:', newCustomer._id); // Add debug log

    // --- Response: Do NOT return the hashedPassword ---
    const customerResponse = {
      _id: newCustomer._id,
      firstName: newCustomer.firstName,
      lastName: newCustomer.lastName,
      email: newCustomer.email,
      phoneNumber: newCustomer.phoneNumber, // Include phoneNumber in response
      isActive: newCustomer.isActive,
      addresses: newCustomer.addresses,
      createdAt: newCustomer.createdAt,
      updatedAt: newCustomer.updatedAt,
    };

    return res.status(201).json({ success: true, message: 'Customer created successfully', customer: customerResponse });

  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.name === 'ValidationError') { // Mongoose validation error
      return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
    }
    // Handle other errors (e.g., duplicate key error if unique index is violated, though email is checked above)
    if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'Duplicate key error. This email might already be taken.', field: error.keyValue ? Object.keys(error.keyValue)[0] : undefined });
    }
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
}
