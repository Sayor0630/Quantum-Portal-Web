import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
import mongoose from 'mongoose';

// Define allowed order statuses for validation
const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'on-hold', 'failed', 'completed'];


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { orderId } = req.query;

  if (!orderId || typeof orderId !== 'string' || !mongoose.Types.ObjectId.isValid(orderId)) {
     return res.status(400).json({ message: 'Invalid order ID' });
  }
  const orderObjectId = new mongoose.Types.ObjectId(orderId as string);

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const order = await Order.findById(orderObjectId)
          .populate({ path: 'customer', model: Customer, select: 'firstName lastName email addresses' })
          .populate({
             path: 'orderItems.product',
             model: Product,
             select: 'name sku price images category tags', // Select more details for single order view
             populate: { path: 'category', select: 'name slug' } // Populate category of product
          });

        if (!order) {
          return res.status(404).json({ message: 'Order not found' });
        }
        return res.status(200).json(order);
      } catch (error) {
        console.error('Error fetching order:', error);
        return res.status(500).json({ message: 'Error fetching order', error: (error as Error).message });
      }

    case 'PUT': // For updating order status or adding admin notes
      try {
        const { status, adminNotes, trackingNumber } = req.body; // Added trackingNumber

        if (!status && !adminNotes && !trackingNumber) {
          return res.status(400).json({ message: 'No update data provided (status, adminNotes, or trackingNumber).' });
        }

        const orderToUpdate = await Order.findById(orderObjectId);
        if (!orderToUpdate) {
          return res.status(404).json({ message: 'Order not found for update' });
        }

        const updateLog: { field: string, oldValue?: any, newValue: any, user: string, date: Date }[] = [];
        const adminUserId = (session.user as {id?: string})?.id || 'system'; // Get admin user ID from session

        if (status) {
          if (typeof status !== 'string' || !ALLOWED_ORDER_STATUSES.includes(status.toLowerCase())) {
             return res.status(400).json({ message: `Invalid status. Must be one of: ${ALLOWED_ORDER_STATUSES.join(', ')}` });
          }
          if (orderToUpdate.status !== status.toLowerCase()) {
            updateLog.push({ field: 'status', oldValue: orderToUpdate.status, newValue: status.toLowerCase(), user: adminUserId, date: new Date() });
            orderToUpdate.status = status.toLowerCase();
          }
        }

        if (trackingNumber !== undefined) { // Allow setting trackingNumber to empty string to clear it
            if (orderToUpdate.trackingNumber !== trackingNumber) {
               updateLog.push({ field: 'trackingNumber', oldValue: orderToUpdate.trackingNumber, newValue: trackingNumber, user: adminUserId, date: new Date() });
               orderToUpdate.trackingNumber = trackingNumber;
            }
        }

        if (adminNotes && typeof adminNotes === 'string' && adminNotes.trim() !== '') {
          orderToUpdate.adminNotes = orderToUpdate.adminNotes || [];
          const newNote = { note: adminNotes.trim(), date: new Date(), by: adminUserId };
          orderToUpdate.adminNotes.push(newNote);
          updateLog.push({ field: 'adminNotes', newValue: `Added note: "${adminNotes.trim()}"`, user: adminUserId, date: new Date() });
        }

        // Log changes if any were made
        if (updateLog.length > 0) {
            console.log("Order Update Log:", updateLog);
            // Here you might save these logs to an OrderHistory collection
        }

        const updatedOrder = await orderToUpdate.save();

        // Repopulate for consistent response
        const populatedOrder = await Order.findById(updatedOrder._id)
          .populate({ path: 'customer', model: Customer, select: 'firstName lastName email addresses' })
          .populate({
             path: 'orderItems.product',
             model: Product,
             select: 'name sku price images category tags',
             populate: { path: 'category', select: 'name slug' }
          });

        return res.status(200).json(populatedOrder);
      } catch (error) {
        console.error('Error updating order:', error);
        return res.status(500).json({ message: 'Error updating order', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
