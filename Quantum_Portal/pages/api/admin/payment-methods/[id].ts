import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import PaymentMethod, { IPaymentMethod } from '../../../../models/PaymentMethod';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ message: 'Unauthorized: No session found' });
  }

  const userRole = (session.user as any).role as Role | undefined;
  if (!userRole || !hasPermission(userRole, Permission.MANAGE_PAYMENT_METHODS)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  }

  const { query: { id } } = req;

  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid payment method ID.' });
  }

  let paymentMethod: IPaymentMethod | null;

  switch (req.method) {
    case 'GET':
      try {
        paymentMethod = await PaymentMethod.findById(id).lean();
        if (!paymentMethod) {
          return res.status(404).json({ success: false, message: 'Payment method not found.' });
        }
        return res.status(200).json({ success: true, data: paymentMethod });
      } catch (error: any) {
        console.error(`Error fetching payment method ${id}:`, error);
        return res.status(500).json({ success: false, message: 'Server error fetching payment method.', error: error.message });
      }

    case 'PUT':
      try {
        const { name, isEnabled, details } = req.body;

        // Basic validation: at least one field should be provided for update
        if (name === undefined && isEnabled === undefined && details === undefined) {
          return res.status(400).json({ success: false, message: 'No update data provided. Please provide name, isEnabled, or details to update.' });
        }
        // If name is provided, it must not be empty
        if (name !== undefined && typeof name === 'string' && name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Payment method name cannot be empty.' });
        }


        paymentMethod = await PaymentMethod.findById(id);
        if (!paymentMethod) {
          return res.status(404).json({ success: false, message: 'Payment method not found.' });
        }

        // Update fields if provided
        if (name !== undefined) paymentMethod.name = name;
        if (isEnabled !== undefined) paymentMethod.isEnabled = isEnabled;
        if (details !== undefined) paymentMethod.details = details;

        // This ensures updatedAt is updated
        paymentMethod.markModified('details'); // if details is an Object, otherwise not strictly needed for String/Boolean

        await paymentMethod.save();
        return res.status(200).json({ success: true, data: paymentMethod });
      } catch (error: any) {
        console.error(`Error updating payment method ${id}:`, error);
        if (error.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
        }
        if (error.code === 11000) { // Duplicate key error for 'name'
            return res.status(409).json({ success: false, message: 'A payment method with this name already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Server error updating payment method.', error: error.message });
      }

    case 'DELETE':
      try {
        paymentMethod = await PaymentMethod.findByIdAndDelete(id);
        if (!paymentMethod) {
          return res.status(404).json({ success: false, message: 'Payment method not found.' });
        }
        return res.status(200).json({ success: true, message: 'Payment method deleted successfully.', data: { _id: id } });
      } catch (error: any) {
        console.error(`Error deleting payment method ${id}:`, error);
        return res.status(500).json({ success: false, message: 'Server error deleting payment method.', error: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
}
