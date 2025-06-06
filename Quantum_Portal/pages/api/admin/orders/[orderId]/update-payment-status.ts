import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '../../../../../lib/dbConnect';
import Order, { IOrder } from '../../../../../models/Order';
import Customer from '../../../../../models/Customer';
import Product from '../../../../../models/Product';
import { hasPermission, Role, Permission } from '../../../../../lib/permissions';
import mongoose from 'mongoose';

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
    // Using CREATE_ORDER permission to imply order management capabilities for now
    if (!userRole || !hasPermission(userRole, Permission.CREATE_ORDER)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions to manage orders' });
    }

    await dbConnect();

    const { query: { orderId }, body } = req;

    if (!orderId || typeof orderId !== 'string' || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const { paymentStatus } = body;

    if (!paymentStatus || (paymentStatus !== 'paid' && paymentStatus !== 'unpaid')) {
      return res.status(400).json({ message: 'Invalid paymentStatus. Must be "paid" or "unpaid".' });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid') {
      order.isPaid = true;
      order.paidAt = new Date();
    } else { // unpaid
      order.isPaid = false;
      order.paidAt = undefined; // Remove paidAt date
    }

    const updatedOrder = await order.save();

    // Populate the order with product and customer data for consistent response
    const populatedOrder = await Order.findById(updatedOrder._id)
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email addresses' })
      .populate({
        path: 'orderItems.product',
        model: Product,
        select: 'name sku price images category tags'
      });

    return res.status(200).json({ success: true, data: populatedOrder });

  } catch (error: any) {
    console.error('Error updating order payment status:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
