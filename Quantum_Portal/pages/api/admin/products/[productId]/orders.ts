import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import mongoose from 'mongoose';

// Import models to ensure they are registered
import Order from '../../../../../models/Order';
import Customer from '../../../../../models/Customer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if user has admin role (basic permission check)
    const userRole = (session.user as any)?.role;
    if (!['admin', 'superadmin', 'orderManager'].includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    await connectToDatabase();

    // Ensure models are registered
    if (!mongoose.models.Customer) {
      require('../../../../../models/Customer');
    }
    if (!mongoose.models.Order) {
      require('../../../../../models/Order');
    }

    const { productId } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Find orders that contain this product
    const orders = await Order.find({
      'orderItems.product': productId
    })
    .populate('customer', 'firstName lastName email')
    .select('customer orderItems totalAmount createdAt status orderNumber')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    // Transform the orders to include product-specific information, grouped by order
    const recentOrders: any[] = [];

    orders.forEach(order => {
      // Find ALL order items for this specific product (could be multiple variants)
      const productOrderItems = order.orderItems.filter(
        (item: any) => item.product.toString() === productId
      );

      if (productOrderItems.length === 0) return;

      const customer = order.customer as any;
      
      const orderData = {
        _id: order._id,
        orderNumber: order.orderNumber || order._id,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest Customer',
        customerEmail: customer?.email || 'N/A',
        customerId: customer?._id || null,
        status: order.status,
        createdAt: order.createdAt,
        variants: productOrderItems.map((productOrderItem: any) => ({
          variantId: productOrderItem?.variantId || null,
          isVariantProduct: productOrderItem?.isVariantProduct || false,
          selectedAttributes: productOrderItem?.selectedAttributes || null,
          variantSku: productOrderItem?.sku || null,
          quantity: productOrderItem?.quantity || 0,
          totalAmount: productOrderItem ? (productOrderItem.quantity * productOrderItem.price) : 0
        }))
      };
      
      recentOrders.push(orderData);
    });

    return res.status(200).json({
      orders: recentOrders,
      total: recentOrders.length
    });

  } catch (error) {
    console.error('Error fetching product orders:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch product orders',
      error: (error as Error).message 
    });
  }
}
