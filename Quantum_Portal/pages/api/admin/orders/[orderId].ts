import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
import mongoose from 'mongoose';

import { hasPermission, Role, Permission } from '../../../../lib/permissions'; // Import for permission check

// Define allowed order statuses for validation (align with Order model)
const VALID_ORDER_STATUSES = [
    'pending', 'processing', 'shipped', 'delivered', 'completed',
    'cancelled', 'refunded', 'on-hold', 'failed'
];
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid'];


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) { // Ensure session.user exists
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userRole = (session.user as any).role as Role | undefined;
  // Using CREATE_ORDER as a proxy for manage order permissions
  if (!userRole || !hasPermission(userRole, Permission.CREATE_ORDER)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
  }

  const { orderId } = req.query;

  if (!orderId || typeof orderId !== 'string' || !mongoose.Types.ObjectId.isValid(orderId)) {
     return res.status(400).json({ success: false, message: 'Invalid order ID' });
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
             select: 'name sku price images category tags'
          }).lean(); // Use lean for GET requests for performance

        if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }
        // The API now implicitly returns all fields, including new ones, due to .lean() and no select()
        return res.status(200).json({ success: true, data: order });
      } catch (error) {
        console.error('Error fetching order:', error);
        return res.status(500).json({ success: false, message: 'Error fetching order', error: (error as Error).message });
      }

    case 'PUT': // Handles comprehensive order updates
      try {
        const {
          shippingAddress,
          deliveryNote,
          paymentMethod,
          paymentStatus,
          status, // Overall order status
          orderItems,
          // customerId should not be changed here.
          // totalAmount should be recalculated.
        } = req.body;

        // --- Basic Validation for existence of key parts ---
        if (!shippingAddress || !paymentMethod || !paymentStatus || !status || !orderItems) {
          return res.status(400).json({ success: false, message: 'Missing required fields for update. Ensure shippingAddress, paymentMethod, paymentStatus, status, and orderItems are provided.' });
        }

        // --- Detailed Validation for shippingAddress ---
        if (!shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.street || !shippingAddress.city || !shippingAddress.district || !shippingAddress.postalCode || !shippingAddress.country) {
            return res.status(400).json({ success: false, message: 'Incomplete shippingAddress object. Required: fullName, phone, street, city, district, postalCode, country.' });
        }
        // Basic phone validation for shipping address phone
        if (typeof shippingAddress.phone !== 'string' || !/^01\d{9}$/.test(shippingAddress.phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number in shipping address. Must be 11 digits starting with 01.'});
        }
        // Basic email validation for shipping address email (if provided)
        if (shippingAddress.email && (typeof shippingAddress.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingAddress.email))) {
            return res.status(400).json({ success: false, message: 'Invalid email format in shipping address.' });
        }


        // --- Validate paymentStatus and status enums ---
        if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
            return res.status(400).json({ success: false, message: `Invalid paymentStatus. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}` });
        }
        if (!VALID_ORDER_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid order status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}` });
        }

        // --- Validate orderItems ---
        if (!Array.isArray(orderItems)) { // Removed orderItems.length === 0 check, as an order could be updated to have no items if business logic allows (e.g. all items refunded and removed).
            return res.status(400).json({ success: false, message: 'orderItems must be an array.' });
        }
        for (const item of orderItems) {
            if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId) || !item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid order item structure. Each item must have valid productId, name, price, and quantity > 0.' });
            }
            // Validate variant product fields if present
            if (item.isVariantProduct && !item.variantId) {
                return res.status(400).json({ success: false, message: 'Variant products must have a variantId.' });
            }
        }

        const orderToUpdate = await Order.findById(orderObjectId);
        if (!orderToUpdate) {
          return res.status(404).json({ success: false, message: 'Order not found for update' });
        }

        // --- Update Order Fields ---
        orderToUpdate.shippingAddress = {
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            email: shippingAddress.email,
            street: shippingAddress.street,
            city: shippingAddress.city,
            district: shippingAddress.district,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country,
            state: shippingAddress.state || undefined, // Optional state
        };
        orderToUpdate.deliveryNote = deliveryNote || undefined;
        orderToUpdate.paymentMethod = paymentMethod;

        // Handle paymentStatus side-effects
        if (orderToUpdate.paymentStatus !== paymentStatus) {
            orderToUpdate.paymentStatus = paymentStatus;
            if (paymentStatus === 'paid') {
                orderToUpdate.isPaid = true;
                orderToUpdate.paidAt = new Date();
            } else {
                orderToUpdate.isPaid = false;
                orderToUpdate.paidAt = undefined;
            }
        }

        // Handle order status side-effects (e.g., for 'delivered')
        if (orderToUpdate.status !== status) {
            orderToUpdate.status = status;
            if (status === 'delivered') {
                orderToUpdate.isDelivered = true;
                orderToUpdate.deliveredAt = new Date();
            } else if (orderToUpdate.isDelivered && status !== 'delivered') {
                // Optional: If status changes from 'delivered' to something else, clear delivery markers
                // orderToUpdate.isDelivered = false;
                // orderToUpdate.deliveredAt = undefined;
            }
        }

        // Update orderItems - replace the whole array
        // Ensure product IDs are ObjectIds if your schema expects that.
        // The form sends productId as string, so convert.
        orderToUpdate.orderItems = orderItems.map(item => ({
            ...item,
            product: new mongoose.Types.ObjectId(item.productId),
            // Ensure variant product fields are properly preserved
            isVariantProduct: item.isVariantProduct || false,
            variantId: item.variantId || undefined,
        })) as any; // Cast if IOrderItem structure mismatch due to product not being populated

        // Recalculate totalAmount based on the new/updated orderItems
        orderToUpdate.totalAmount = orderToUpdate.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        // Consider if shippingPrice or taxPrice should be recalculated or are fixed.

        const savedOrder = await orderToUpdate.save();

        // Repopulate for consistent response, similar to GET
        const populatedOrder = await Order.findById(savedOrder._id)
          .populate({ path: 'customer', model: Customer, select: 'firstName lastName email addresses' })
          .populate({
             path: 'orderItems.product',
             model: Product,
             select: 'name sku price images category tags'
          });

        return res.status(200).json({ success: true, data: populatedOrder });
      } catch (error) {
        console.error('Error updating order:', error);
        return res.status(500).json({ message: 'Error updating order', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
