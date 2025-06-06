import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import Customer, { ICustomer, IAddress } from '../../../../models/Customer'; // Import IAddress if needed for type hints
import bcrypt from 'bcryptjs';
import { authOptions } from '../../auth/[...nextauth]';
import { getServerSession } from 'next-auth/next';
import { hasPermission, Permission, Role } from '../../../../lib/permissions';
import mongoose from 'mongoose';

// Helper function to exclude password from customer object
const sanitizeCustomer = (customer: ICustomer) => {
    const { password, ...sanitized } = customer.toObject ? customer.toObject() : customer;
    return sanitized;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query: { id }, method } = req;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
  }
  const customerId = new mongoose.Types.ObjectId(id as string);

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !(session.user as any).role) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No valid session found' });
  }
  const userRole = (session.user as any).role as Role;
  // MANAGE_CUSTOMERS permission required for all actions on a specific customer
  if (!hasPermission(userRole, Permission.MANAGE_CUSTOMERS)) {
    return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
  }

  switch (method) {
    case 'GET':
      try {
        const customer = await Customer.findById(customerId).select('-password').lean(); // Exclude password
        if (!customer) {
          return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        // Note: If phoneNumber was stored in a non-standard way and needs to be returned, adjust here.
        // For now, it's not part of the core Customer model.
        return res.status(200).json({ success: true, customer });
      } catch (error: any) {
        console.error('Error fetching customer:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
      }

    case 'PUT':
      try {
        const {
          firstName,
          lastName,
          email,
          password, // Optional: only if changing
          phoneNumber, // Received, but still not directly on Customer model's root
          isActive,
          addresses, // Array of IAddress compatible objects
        } = req.body;

        // --- Basic Validation ---
        if (!firstName || !lastName || !email) {
          return res.status(400).json({ success: false, message: 'Missing required fields: firstName, lastName, and email are required.' });
        }
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }
        if (password && (typeof password !== 'string' || password.length < 8)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long, or leave blank to keep current.' });
        }
        if (phoneNumber && (typeof phoneNumber !== 'string' || !/^01\d{9}$/.test(phoneNumber))) {
            return res.status(400).json({ success: false, message: 'Invalid phone number format. Must be 11 digits starting with "01" or empty.' });
        }

        const customerToUpdate = await Customer.findById(customerId);
        if (!customerToUpdate) {
          return res.status(404).json({ success: false, message: 'Customer not found for update.' });
        }

        // --- Email Uniqueness Check (if changed) ---
        if (email.toLowerCase() !== customerToUpdate.email.toLowerCase()) {
          const existingCustomerWithNewEmail = await Customer.findOne({ email: email.toLowerCase() });
          if (existingCustomerWithNewEmail) {
            return res.status(409).json({ success: false, message: 'New email address is already in use.' });
          }
          customerToUpdate.email = email.toLowerCase();
        }

        // --- Update Fields ---
        customerToUpdate.firstName = firstName;
        customerToUpdate.lastName = lastName;
        customerToUpdate.isActive = isActive !== undefined ? isActive : true;

        // --- Password Update (if provided) ---
        if (password) {
          customerToUpdate.password = await bcrypt.hash(password, 12);
        }

        // --- Addresses Update ---
        const validAddresses: IAddress[] = [];
        if (addresses && Array.isArray(addresses)) {
            for (const addr of addresses) {
                if (addr.street && addr.city && addr.state && addr.zipCode && addr.country) {
                    validAddresses.push({
                        street: addr.street,
                        city: addr.city,
                        state: addr.state, // Client maps 'district' to 'state'
                        zipCode: addr.zipCode,
                        country: addr.country,
                        isDefaultShipping: addr.isDefaultShipping || false,
                        isDefaultBilling: addr.isDefaultBilling || false,
                    } as IAddress); // Cast to IAddress, assuming subdocument doesn't need .save()
                } else {
                     console.warn("Skipping incomplete address object during update:", addr);
                }
            }
        }
        customerToUpdate.addresses = validAddresses;
        // Note: if addresses array is empty and customer previously had addresses, they will be wiped.
        // This is typical for "replace" style updates of sub-arrays.

        await customerToUpdate.save();

        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            customer: sanitizeCustomer(customerToUpdate)
        });

      } catch (error: any) {
        console.error('Error updating customer:', error);
        if (error.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
        }
        if (error.code === 11000) { // Should be caught by pre-check, but as a fallback
            return res.status(409).json({ success: false, message: 'Duplicate key error (e.g. email).', field: error.keyValue ? Object.keys(error.keyValue)[0] : undefined });
        }
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).json({ success: false, message: `Method ${method} Not Allowed` });
  }
}
