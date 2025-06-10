import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import dbConnect from '../../../../../lib/dbConnect';
import Order, { IOrder } from '../../../../../models/Order'; // IOrder might be useful for status enum if exported
import Customer from '../../../../../models/Customer';
import Product from '../../../../../models/Product';
import { hasPermission, Role, Permission } from '../../../../../lib/permissions';
import mongoose from 'mongoose';
import { 
  restoreStock, 
  deductStock, 
  validateOrderStock,
  StockValidationItem 
} from '../../../../../lib/stockValidation';

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

    const { query: { orderId }, body } = req;

    if (!orderId || typeof orderId !== 'string' || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID.' });
    }

    const { status: newStatus } = body;

    if (!newStatus || typeof newStatus !== 'string' || !VALID_ORDER_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        message: `Invalid order status. Must be one of: ${VALID_ORDER_STATUSES.join(', ')}.`
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const oldStatus = order.status;
    order.status = newStatus as IOrder['status']; // Cast to the specific enum type

    // Handle stock management based on status changes
    const stockItems: StockValidationItem[] = order.orderItems.map(item => ({
      productId: item.product.toString(),
      variantId: item.variantId,
      name: item.name,
      requestedQuantity: item.quantity,
      price: item.price,
      selectedAttributes: item.selectedAttributes ? Object.fromEntries(item.selectedAttributes) : undefined
    }));

    // Handle stock deduction/restoration based on status transitions
    if (newStatus === 'processing' && oldStatus !== 'processing') {
      // Moving to processing - deduct stock if not already deducted
      if (!order.stockValidation?.stockDeducted) {
        console.log('DEBUG: Validating stock availability for order moving to processing:', orderId);
        
        // First validate that ALL items are available before attempting deduction
        const stockValidation = await validateOrderStock(stockItems);
        
        if (stockValidation.validationResult === 'all_available') {
          console.log('DEBUG: All items available - proceeding with stock deduction:', orderId);
          const deductionResult = await deductStock(stockItems);
          
          if (deductionResult.success) {
            // Update order to mark stock as deducted
            if (!order.stockValidation) {
              order.stockValidation = {
                isValidated: true,
                validationDate: new Date(),
                validationResult: 'all_available',
                stockDeducted: false
              };
            }
            order.stockValidation.stockDeducted = true;
            order.stockValidation.stockDeductedAt = new Date();
            order.statusReason = 'Stock deducted. Order processing.';
          } else {
            // If stock deduction fails, change status to on-hold
            order.status = 'on-hold';
            order.statusReason = `Stock deduction failed: ${deductionResult.errors.join(', ')}`;
            console.error('DEBUG: Stock deduction failed for order:', orderId, deductionResult.errors);
          }
        } else {
          // Stock validation failed - cannot proceed with processing status
          console.warn('DEBUG: Skipping stock deduction - not all items available for order:', orderId);
          order.status = 'on-hold';
          order.statusReason = `Cannot process: Insufficient stock for some items. Validation result: ${stockValidation.validationResult}`;
          
          // Update order with validation results
          order.stockValidation = {
            isValidated: true,
            validationDate: new Date(),
            validationResult: stockValidation.validationResult,
            availableItems: stockValidation.availableItems,
            partiallyAvailableItems: stockValidation.partiallyAvailableItems,
            unavailableItems: stockValidation.unavailableItems,
            stockDeducted: false
          };
        }
      }
    } else if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      // Moving to cancelled - restore stock if it was deducted
      if (order.stockValidation?.stockDeducted) {
        console.log('DEBUG: Restoring stock for cancelled order:', orderId);
        const restorationResult = await restoreStock(stockItems);
        
        if (restorationResult.success) {
          // Update order to mark stock as restored
          order.stockValidation.stockDeducted = false;
          order.stockValidation.stockDeductedAt = undefined;
          order.statusReason = 'Order cancelled. Stock restored.';
        } else {
          // Log error but don't prevent cancellation
          console.error('DEBUG: Stock restoration failed for order:', orderId, restorationResult.errors);
          order.statusReason = `Order cancelled. Stock restoration failed: ${restorationResult.errors.join(', ')}`;
        }
      } else {
        order.statusReason = 'Order cancelled.';
      }
    }

    // Handle side effects for specific statuses
    if (newStatus === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
      if (!order.statusReason) {
        order.statusReason = 'Order delivered successfully.';
      }
    } else if (newStatus === 'shipped') {
      if (!order.statusReason) {
        order.statusReason = 'Order shipped.';
      }
    } else if (newStatus === 'failed') {
      if (!order.statusReason) {
        order.statusReason = 'Order failed.';
      }
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
    console.error('Error updating order status:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: 'Validation Error: ' + error.message, errors: error.errors });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
