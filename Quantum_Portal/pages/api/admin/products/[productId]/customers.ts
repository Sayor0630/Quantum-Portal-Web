import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import Order from '../../../../../models/Order';
import Customer from '../../../../../models/Customer';
import Product from '../../../../../models/Product';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { productId } = req.query;

  if (!productId || typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  await connectToDatabase();

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // First, verify the product exists
    const product = await Product.findById(productId).select('name slug');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find all orders that contain this product
    const orders = await Order.find({
      'orderItems.product': new mongoose.Types.ObjectId(productId)
    })
    .populate('customer', 'firstName lastName email createdAt isActive')
    .select('customer orderItems totalAmount createdAt status orderNumber')
    .lean();

    // Create an array to store order-variant combinations grouped by order
    const orderVariants: any[] = [];

    orders.forEach(order => {
      if (!order.customer || typeof order.customer === 'string') return;

      const customer = order.customer as any;

      // Find order items for this specific product in this order
      const productItems = order.orderItems.filter(
        item => item.product.toString() === productId
      );

      if (productItems.length > 0) {
        // Calculate total amount for all variants of this product in this order
        const orderTotalAmount = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Use stored order number with order ID fallback
        const orderNumber = (order as any).orderNumber || order._id;
        
        orderVariants.push({
          _id: order._id,
          orderNumber: orderNumber,
          customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
          customerEmail: customer.email,
          customerId: customer._id,
          status: order.status,
          createdAt: order.createdAt,
          orderTotalAmount: orderTotalAmount,
          variants: productItems.map(item => ({
            variantId: item.variantId,
            isVariantProduct: item.isVariantProduct || false,
            selectedAttributes: item.selectedAttributes || null,
            variantSku: item.sku,
            quantity: item.quantity,
            individualAmount: item.price * item.quantity
          }))
        });
      }
    });

    // Sort by order date (most recent first)
    const customers = orderVariants.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Paginate results
    const totalCustomers = customers.length;
    const totalPages = Math.ceil(totalCustomers / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCustomers = customers.slice(startIndex, endIndex);

    return res.status(200).json({
      customers: paginatedCustomers,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug
      },
      currentPage: page,
      totalPages,
      totalItems: totalCustomers,
    });

  } catch (error) {
    console.error('Error fetching customers for product:', error);
    return res.status(500).json({ 
      message: 'Error fetching customers', 
      error: (error as Error).message 
    });
  }
}
