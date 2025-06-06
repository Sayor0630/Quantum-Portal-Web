import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '../../../../../lib/dbConnect';
import Order, { IOrder } from '../../../../../models/Order'; // IOrder might be useful for status enum if exported
import { hasPermission, Role, Permission } from '../../../../../lib/permissions';
import mongoose from 'mongoose';

// Valid order statuses from the Order model
const VALID_ORDER_STATUSES = [
  'pending', 'processing', 'shipped', 'delivered', 'cancelled',
  'refunded', 'failed', 'completed', 'on-hold'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ message: 'Unauthorized: No session found' });
    }

    const userRole = (session.user as any).role as Role | undefined;
    // Using CREATE_ORDER permission to imply order management capabilities
    if (!userRole || !hasPermission(userRole, Permission.CREATE_ORDER)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to manage orders' });
    }

    await dbConnect();

    const { query: { id }, body } = req;

    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const { status: newStatus } = body;

    if (!newStatus || typeof newStatus !== 'string' || !VALID_ORDER_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid order status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}.`
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.status = newStatus as IOrder['status']; // Cast to the specific enum type

    // Handle side effects for specific statuses
    if (newStatus === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    } else if (newStatus === 'shipped') {
      // If there was a shippedAt field, it would be set here.
      // For now, only 'delivered' has a specific date field tied to it besides paidAt.
      // If order is moved out of 'delivered', we might want to clear isDelivered/deliveredAt
      // For simplicity, this example only sets them when moving *to* delivered.
    }
    // Consider if moving *away* from 'delivered' should nullify deliveredAt/isDelivered
    // For example: if (order.status !== 'delivered' && newStatus !== 'delivered') { order.isDelivered = false; order.deliveredAt = undefined; }
    // This depends on business logic, for now, only setting on 'delivered'.

    const updatedOrder = await order.save();

    return res.status(200).json({ success: true, data: updatedOrder });

  } catch (error: any) {
    console.error('Error updating order status:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
