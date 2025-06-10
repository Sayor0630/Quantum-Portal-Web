import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
import mongoose from 'mongoose';

import { hasPermission, Role, Permission } from '../../../../lib/permissions'; // Import for permission check
import { 
  validateOrderStock, 
  restoreStock,
  deductStock, 
  generateStockValidationMessage,
  StockValidationItem 
} from '../../../../lib/stockValidation';

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
             select: 'name sku price images category tags variants'
          }).lean(); // Use lean for GET requests for performance

        if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Cast to any to handle lean document type issues
        const orderData = order as any;

        // Enhance historical stock validation data with variant SKUs
        if (orderData.stockValidation && Array.isArray(orderData.stockValidation)) {
          // Collect all unique variant IDs that need SKU enhancement
          const variantIdsToEnhance = new Set<string>();
          
          orderData.stockValidation.forEach((validation: any) => {
            if (validation.items && Array.isArray(validation.items)) {
              validation.items.forEach((item: any) => {
                if (item.variantId && !item.variantSku) {
                  variantIdsToEnhance.add(item.variantId);
                }
              });
            }
          });

          // If there are variant IDs to enhance, fetch all products with those variants in one query
          if (variantIdsToEnhance.size > 0) {
            const variantIdArray = Array.from(variantIdsToEnhance);
            const variantObjectIds = variantIdArray.map(id => new mongoose.Types.ObjectId(id));
            
            const productsWithVariants = await Product.find({
              'variants._id': { $in: variantObjectIds }
            }).select('variants').lean();

            // Create a lookup map for variant ID to SKU
            const variantSkuMap = new Map<string, string>();
            productsWithVariants.forEach((product: any) => {
              if (product.variants) {
                product.variants.forEach((variant: any) => {
                  if (variant._id && variant.sku) {
                    variantSkuMap.set(variant._id.toString(), variant.sku);
                  }
                });
              }
            });

            // Enhance all validation items with SKUs
            orderData.stockValidation = orderData.stockValidation.map((validation: any) => {
              if (validation.items && Array.isArray(validation.items)) {
                const enhancedItems = validation.items.map((item: any) => {
                  if (item.variantId && !item.variantSku && variantSkuMap.has(item.variantId)) {
                    return { ...item, variantSku: variantSkuMap.get(item.variantId) };
                  }
                  return item;
                });
                return { ...validation, items: enhancedItems };
              }
              return validation;
            });
          }
        }

        // Handle single stockValidation object (legacy format)
        if (orderData.stockValidation && !Array.isArray(orderData.stockValidation)) {
          const validation = orderData.stockValidation;
          const allItems = [
            ...(validation.availableItems || []),
            ...(validation.partiallyAvailableItems || []),
            ...(validation.unavailableItems || [])
          ];

          // Collect variant IDs that need enhancement
          const variantIdsToEnhance = new Set<string>();
          allItems.forEach((item: any) => {
            if (item.variantId && !item.variantSku) {
              variantIdsToEnhance.add(item.variantId);
            }
          });

          if (variantIdsToEnhance.size > 0) {
            const variantIdArray = Array.from(variantIdsToEnhance);
            const variantObjectIds = variantIdArray.map(id => new mongoose.Types.ObjectId(id));
            
            const productsWithVariants = await Product.find({
              'variants._id': { $in: variantObjectIds }
            }).select('variants').lean();

            // Create a lookup map for variant ID to SKU
            const variantSkuMap = new Map<string, string>();
            productsWithVariants.forEach((product: any) => {
              if (product.variants) {
                product.variants.forEach((variant: any) => {
                  if (variant._id && variant.sku) {
                    variantSkuMap.set(variant._id.toString(), variant.sku);
                  }
                });
              }
            });

            // Enhance items with SKUs
            const enhanceItems = (items: any[]) => {
              return items.map((item: any) => {
                if (item.variantId && !item.variantSku && variantSkuMap.has(item.variantId)) {
                  return { ...item, variantSku: variantSkuMap.get(item.variantId) };
                }
                return item;
              });
            };

            orderData.stockValidation = {
              ...validation,
              availableItems: enhanceItems(validation.availableItems || []),
              partiallyAvailableItems: enhanceItems(validation.partiallyAvailableItems || []),
              unavailableItems: enhanceItems(validation.unavailableItems || [])
            };
          }
        }

        // The API now returns enhanced stock validation data
        return res.status(200).json({ success: true, data: orderData });
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
          paymentStatus, // Optional: defaults to 'unpaid' if not provided
          status, // Optional: defaults to 'pending' if not provided, then updated based on stock validation
          orderItems,
          // customerId should not be changed here.
          // totalAmount should be recalculated.
        } = req.body;

        // --- Basic Validation for existence of key parts ---
        if (!shippingAddress || !paymentMethod || !orderItems) {
          return res.status(400).json({ success: false, message: 'Missing required fields for update. Ensure shippingAddress, paymentMethod, and orderItems are provided.' });
        }

        // Set default values for paymentStatus and status if not provided
        const finalPaymentStatus = paymentStatus || 'unpaid';
        const initialStatus = status || 'pending';

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
        if (!VALID_PAYMENT_STATUSES.includes(finalPaymentStatus)) {
            return res.status(400).json({ success: false, message: `Invalid paymentStatus. Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}` });
        }
        if (!VALID_ORDER_STATUSES.includes(initialStatus)) {
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

        // Store original order items and status for stock restoration if needed
        const originalOrderItems = [...orderToUpdate.orderItems];
        const originalStatus = orderToUpdate.status;

        // --- Restore stock from original order items if order was in processing/completed/delivered status ---
        if (['processing', 'completed', 'delivered'].includes(originalStatus)) {
          try {
            const originalStockItems: StockValidationItem[] = originalOrderItems.map(item => ({
              productId: item.product.toString(),
              quantity: item.quantity,
              name: item.name,
              requestedQuantity: item.quantity,
              price: item.price,
              isVariantProduct: item.isVariantProduct || false,
              variantId: item.variantId,
              selectedAttributes: item.selectedAttributes
            }));
            await restoreStock(originalStockItems);
          } catch (error) {
            console.error('Error restoring stock from original order:', error);
            return res.status(500).json({ 
              success: false, 
              message: 'Failed to restore stock from original order items',
              error: (error as Error).message 
            });
          }
        }

        // --- Prepare new order items for stock validation ---
        const stockValidationItems: StockValidationItem[] = orderItems.map(item => ({
          productId: item.productId,
          name: item.name,
          requestedQuantity: item.quantity,
          price: item.price,
          selectedAttributes: item.selectedAttributes,
          variantId: item.variantId
        }));

        // --- Perform comprehensive stock validation ---
        const stockValidation = await validateOrderStock(stockValidationItems);
        
        // --- Determine order status based on stock validation ---
        let finalStatus = initialStatus;
        let statusReason = '';
        
        if (initialStatus === 'pending' || initialStatus === 'processing') {
          if (stockValidation.validationResult === 'all_available') {
            finalStatus = 'processing';
            statusReason = 'All items are in stock';
          } else if (stockValidation.validationResult === 'partial_available') {
            finalStatus = 'on-hold';
            statusReason = generateStockValidationMessage(stockValidation);
          } else {
            finalStatus = 'failed';
            statusReason = 'All items are out of stock';
          }
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
        if (orderToUpdate.paymentStatus !== finalPaymentStatus) {
            orderToUpdate.paymentStatus = finalPaymentStatus;
            if (finalPaymentStatus === 'paid') {
                orderToUpdate.isPaid = true;
                orderToUpdate.paidAt = new Date();
            } else {
                orderToUpdate.isPaid = false;
                orderToUpdate.paidAt = undefined;
            }
        }

        // Set the final status and stock validation results
        orderToUpdate.status = finalStatus;
        orderToUpdate.statusReason = statusReason;
        
        // Update stock validation using dot notation to match schema structure
        orderToUpdate.set('stockValidation.isValidated', true);
        orderToUpdate.set('stockValidation.validationDate', new Date());
        orderToUpdate.set('stockValidation.validationResult', stockValidation.validationResult);
        orderToUpdate.set('stockValidation.availableItems', stockValidation.availableItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          availableQuantity: item.availableQuantity,
          requestedQuantity: item.requestedQuantity
        })));
        orderToUpdate.set('stockValidation.partiallyAvailableItems', stockValidation.partiallyAvailableItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          availableQuantity: item.availableQuantity,
          requestedQuantity: item.requestedQuantity,
          shortfall: item.shortfall
        })));
        orderToUpdate.set('stockValidation.unavailableItems', stockValidation.unavailableItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          availableQuantity: item.availableQuantity,
          requestedQuantity: item.requestedQuantity
        })));

        // Handle order status side-effects (e.g., for 'delivered')
        if (finalStatus === 'delivered') {
            orderToUpdate.isDelivered = true;
            orderToUpdate.deliveredAt = new Date();
        } else if (orderToUpdate.isDelivered && finalStatus !== 'delivered') {
            // Optional: If status changes from 'delivered' to something else, clear delivery markers
            // orderToUpdate.isDelivered = false;
            // orderToUpdate.deliveredAt = undefined;
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

        // --- Deduct stock for processing orders ---
        // Only attempt stock deduction if ALL items are available at once
        if (finalStatus === 'processing') {
          if (stockValidation.validationResult === 'all_available') {
            try {
              await deductStock(stockValidationItems);
            } catch (error) {
              console.error('Error deducting stock for updated order:', error);
              // Restore original order items stock if deduction fails
              if (['processing', 'completed', 'delivered'].includes(originalStatus)) {
                try {
                  const originalStockItems: StockValidationItem[] = originalOrderItems.map(item => ({
                    productId: item.product.toString(),
                    name: item.name,
                    requestedQuantity: item.quantity,
                    price: item.price,
                    variantId: item.variantId,
                    selectedAttributes: item.selectedAttributes
                  }));
                  await deductStock(originalStockItems);
                } catch (restoreError) {
                  console.error('Error restoring original stock after failed deduction:', restoreError);
                }
              }
              return res.status(500).json({ 
                success: false, 
                message: 'Failed to deduct stock for updated order',
                error: (error as Error).message 
              });
            }
          } else {
            // Stock validation failed - cannot proceed with processing status
            console.warn('Skipping stock deduction: Not all items are available in sufficient quantities');
            return res.status(400).json({
              success: false,
              message: 'Cannot process order: Insufficient stock for some items',
              stockValidation: stockValidation
            });
          }
        }

        const savedOrder = await orderToUpdate.save();

        // Repopulate for consistent response, similar to GET
        const populatedOrder = await Order.findById(savedOrder._id)
          .populate({ path: 'customer', model: Customer, select: 'firstName lastName email addresses' })
          .populate({
             path: 'orderItems.product',
             model: Product,
             select: 'name sku price images category tags'
          });

        return res.status(200).json({ 
          success: true, 
          data: populatedOrder,
          stockValidation: stockValidation,
          message: statusReason || 'Order updated successfully'
        });
      } catch (error) {
        console.error('Error updating order:', error);
        return res.status(500).json({ message: 'Error updating order', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
