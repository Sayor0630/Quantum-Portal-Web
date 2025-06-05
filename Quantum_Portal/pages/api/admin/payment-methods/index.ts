import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import PaymentMethod, { IPaymentMethod } from '../../../../models/PaymentMethod';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';

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

  switch (req.method) {
    case 'GET':
      try {
        const paymentMethods = await PaymentMethod.find({}).sort({ name: 1 }).lean();
        return res.status(200).json({ success: true, data: paymentMethods });
      } catch (error: any) {
        console.error('Error fetching payment methods:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching payment methods', error: error.message });
      }

    case 'POST':
      try {
        const { name, isEnabled, details } = req.body;

        if (!name) {
          return res.status(400).json({ success: false, message: 'Payment method name is required.' });
        }

        const newPaymentMethod = new PaymentMethod({
          name,
          isEnabled: isEnabled !== undefined ? isEnabled : true, // Default to true if not provided
          details,
        });

        await newPaymentMethod.save();
        return res.status(201).json({ success: true, data: newPaymentMethod });
      } catch (error: any) {
        console.error('Error creating payment method:', error);
        if (error.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
        }
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ success: false, message: 'A payment method with this name already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Server error creating payment method', error: error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
}
