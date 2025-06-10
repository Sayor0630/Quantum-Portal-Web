import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import Order from '../../../../../models/Order';
import { validateOrderStock, StockValidationItem } from '../../../../../lib/stockValidation';
import { hasPermission, Role, Permission } from '../../../../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check authentication
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

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    await connectToDatabase();

    // Fetch the order
    const order = await Order.findById(orderId).populate('orderItems.product');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Convert order items to stock validation items
    const stockItems: StockValidationItem[] = order.orderItems.map((item: any) => ({
      productId: item.product?._id?.toString() || '',
      variantId: item.variantId,
      name: item.name || item.product?.name || 'Unknown Product',
      requestedQuantity: item.quantity,
      price: item.price || 0,
      selectedAttributes: item.selectedAttributes && typeof item.selectedAttributes === 'object' 
        ? (item.selectedAttributes instanceof Map 
            ? Object.fromEntries(item.selectedAttributes) 
            : item.selectedAttributes)
        : undefined
    }));

    // Validate stock
    const stockValidationResult = await validateOrderStock(stockItems);

    res.status(200).json({
      success: true,
      data: stockValidationResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Live stock validation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch live stock data',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    });
  }
}
