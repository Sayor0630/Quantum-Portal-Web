import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order, { IOrderItem } from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
import mongoose from 'mongoose';
import { 
  validateOrderStock, 
  deductStock, 
  generateStockValidationMessage,
  StockValidationItem 
} from '../../../../lib/stockValidation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      return handleGetOrders(req, res);
    case 'POST':
      return handleCreateOrder(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function handleGetOrders(req: NextApiRequest, res: NextApiResponse) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;
    const search = req.query.search as string; // Add search parameter
    const dateFrom = req.query.dateFrom as string; // Expect YYYY-MM-DD
    const dateTo = req.query.dateTo as string;     // Expect YYYY-MM-DD
    const sortField = req.query.sortField as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string === 'asc') ? 1 : -1;

    // Build query with all filters including search
    const sortCriteria: any = {};
    sortCriteria[sortField] = sortOrder;

    // Build query using $and structure (like product search)
    const queryConditions: any[] = [];
    
    // Add existing filters as separate conditions
    if (status) {
      queryConditions.push({ status: status });
    }
    
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      queryConditions.push({ customer: new mongoose.Types.ObjectId(customerId) });
    }
    
    if (dateFrom) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0,0,0,0);
      queryConditions.push({ createdAt: { $gte: startDate } });
    }
    
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23,59,59,999);
      queryConditions.push({ createdAt: { $lte: endDate } });
    }

    // Add search criteria if search term is provided
    if (search && search.trim().length >= 1) {
      const searchTerm = search.trim();
      const searchOr: any[] = [];

      // Search by order ID if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }

      // Search by order number (partial match, case insensitive)
      searchOr.push({ orderNumber: { $regex: searchTerm, $options: 'i' } });

      // Only search by customer details if no customer filter is active
      if (!customerId) {
        // Get customer IDs that match the search term
        const matchingCustomers = await Customer.find({
          $or: [
            { email: { $regex: searchTerm, $options: 'i' } },
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } }
          ]
        }).select('_id').lean();

        const customerIds = matchingCustomers.map(customer => customer._id);
        
        // Add customer search to OR conditions
        if (customerIds.length > 0) {
          searchOr.push({ customer: { $in: customerIds } });
        }
      }

      // Always add search condition when search term is provided
      // If no matches found, add an impossible condition to return empty results
      if (searchOr.length > 0) {
        queryConditions.push({ $or: searchOr });
      } else {
        // No matches found for search term - return empty results
        queryConditions.push({ _id: null }); // This will match nothing
      }
    }

    // Build final query
    const finalQuery = queryConditions.length > 0 ? { $and: queryConditions } : {};

    // Use regular find for all cases (exactly like product search)
    const orders = await Order.find(finalQuery)
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
      .populate({
          path: 'orderItems.product',
          model: Product,
          select: 'name sku price images',
      })
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(finalQuery);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      orders,
      currentPage: page,
      totalPages,
      totalItems: totalOrders,
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Error fetching orders', error: (error as Error).message });
  }
}

async function handleCreateOrder(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('======= ORDER CREATION STARTED =======');
    console.log('DEBUG: Incoming order creation request body:', JSON.stringify(req.body, null, 2));
    
    const {
      customerId,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      shippingAddress,
      billingAddress,
      paymentMethod,
      orderItems,
      shippingMethod,
      notes,
      status = 'pending'
    } = req.body;

    console.log(`DEBUG: Order items count: ${orderItems?.length || 0}`);
    console.log(`DEBUG: Initial status from request: ${status}`);
    console.log(`DEBUG: Customer info - ID: ${customerId}, Email: ${customerEmail}`);

    // Validate required fields
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    if (!shippingAddress || !billingAddress) {
      return res.status(400).json({ message: 'Shipping and billing addresses are required' });
    }

    let customer;

    console.log('======= CUSTOMER HANDLING =======');
    // Handle customer - either find existing or create new
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      console.log(`DEBUG: Looking for existing customer with ID: ${customerId}`);
      customer = await Customer.findById(customerId);
      if (!customer) {
        console.log('DEBUG: ❌ Customer not found with provided ID');
        return res.status(400).json({ message: 'Customer not found' });
      }
      console.log(`DEBUG: ✅ Found existing customer: ${customer.email}`);
    } else if (customerEmail) {
      console.log(`DEBUG: Looking for customer by email: ${customerEmail}`);
      // Try to find customer by email first
      customer = await Customer.findOne({ email: customerEmail });
      
      if (!customer) {
        console.log('DEBUG: Customer not found, creating new customer');
        // Create new customer
        if (!customerFirstName || !customerLastName) {
          console.log('DEBUG: ❌ Missing required fields for new customer');
          return res.status(400).json({ message: 'Customer first name and last name are required for new customers' });
        }

        customer = new Customer({
          firstName: customerFirstName,
          lastName: customerLastName,
          email: customerEmail,
          phone: customerPhone || '',
        });
        await customer.save();
        console.log(`DEBUG: ✅ Created new customer with ID: ${customer._id}`);
      } else {
        console.log(`DEBUG: ✅ Found existing customer by email: ${customer._id}`);
      }
    } else {
      console.log('DEBUG: ❌ No customer ID or email provided');
      return res.status(400).json({ message: 'Customer ID or customer email is required' });
    }

    // Prepare items for stock validation
    console.log('======= PRODUCT PROCESSING =======');
    const stockValidationItems: StockValidationItem[] = [];
    const processedOrderItems: Partial<IOrderItem>[] = [];
    let totalAmount = 0;

    console.log(`DEBUG: Processing ${orderItems.length} order items`);

    // First pass: validate products and prepare for stock validation
    for (const item of orderItems) {
      console.log(`DEBUG: Processing order item:`, {
        productId: item.product,
        quantity: item.quantity,
        selectedAttributes: item.selectedAttributes
      });
      if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
        return res.status(400).json({ message: 'Invalid product ID in order items' });
      }

      const product = await Product.findById(item.product).populate('brand', 'name slug logo');
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.product}` });
      }

      // Type assertion for proper TypeScript handling
      const typedProduct = product as any;

      const quantity = parseInt(item.quantity) || 1;
      if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be greater than 0' });
      }

      // Process selected attributes if any
      const selectedAttributes = new Map();
      const selectedAttributesObj: Record<string, string> = {};
      if (item.selectedAttributes && typeof item.selectedAttributes === 'object') {
        for (const [key, value] of Object.entries(item.selectedAttributes)) {
          selectedAttributes.set(key, value);
          selectedAttributesObj[key] = value as string;
        }
      }

      // Calculate price and SKU using variant-specific values if applicable
      let price = typedProduct.price; // Default to base price
      let sku = typedProduct.sku || ''; // Default to base SKU
      let itemImage = typedProduct.images && typedProduct.images.length > 0 ? typedProduct.images[0] : undefined;
      let variant: any = null;
      let variantId: string | undefined;
      
      console.log(`Processing item for product: ${typedProduct.name}`);
      console.log(`Product hasVariants: ${typedProduct.hasVariants}`);
      console.log(`Selected attributes:`, selectedAttributesObj);
      
      if (typedProduct.hasVariants && Object.keys(selectedAttributesObj).length > 0) {
        // Find the matching variant directly
        variant = typedProduct.variants.find((v: any) => {
          const variantAttrs = Object.fromEntries(v.attributeCombination);
          return Object.keys(selectedAttributesObj).every(key => variantAttrs[key] === selectedAttributesObj[key]);
        });
        
        console.log(`Found variant:`, variant ? 'Yes' : 'No');
        
        if (!variant || !variant.isActive) {
          console.error(`Variant not found or inactive for attributes:`, selectedAttributesObj);
          return res.status(400).json({ 
            message: `Selected variant combination is not available for product: ${typedProduct.name}` 
          });
        }
        
        // Use variant price if available, otherwise fall back to base price
        price = variant.price || typedProduct.price;
        sku = variant.sku || typedProduct.sku || '';
        variantId = variant._id.toString();
        
        console.log(`Variant details - Price: ${price}, SKU: ${sku}, Stock: ${variant.stockQuantity}`);
        
        // Use variant-specific image if available
        if (variant.images && variant.images.length > 0) {
          itemImage = variant.images[0].url;
        }
      }

      const itemTotal = price * quantity;
      totalAmount += itemTotal;

      // Prepare brand information
      let brandInfo: any = null;
      if (item.brand && item.brand._id) {
        brandInfo = {
          _id: new mongoose.Types.ObjectId(item.brand._id),
          name: item.brand.name,
          slug: item.brand.slug,
          logo: item.brand.logo
        };
      } else if (typedProduct.brand) {
        const populatedBrand = typedProduct.brand as any;
        if (populatedBrand && populatedBrand._id) {
          brandInfo = {
            _id: populatedBrand._id,
            name: populatedBrand.name,
            slug: populatedBrand.slug,
            logo: populatedBrand.logo
          };
        }
      }

      // Add to stock validation items
      stockValidationItems.push({
        productId: typedProduct._id.toString(),
        variantId,
        name: typedProduct.name,
        requestedQuantity: quantity,
        price,
        selectedAttributes: Object.keys(selectedAttributesObj).length > 0 ? selectedAttributesObj : undefined
      });

      // Add to processed order items
      processedOrderItems.push({
        product: typedProduct._id as mongoose.Types.ObjectId,
        name: typedProduct.name,
        sku,
        price,
        quantity,
        image: itemImage,
        selectedAttributes,
        brand: brandInfo,
        isVariantProduct: item.isVariantProduct || typedProduct.hasVariants || false,
        variantId: item.variantId || variantId
      });
    }

    // Create the order with pending status - stock validation will happen server-side
    console.log('======= ORDER CREATION =======');
    console.log(`DEBUG: Creating order with pending status`);
    console.log(`DEBUG: Customer ID: ${customer._id}`);
    console.log(`DEBUG: Total amount: $${totalAmount}`);
    console.log(`DEBUG: Order items count: ${processedOrderItems.length}`);
    
    const newOrder = new Order({
      customer: customer._id,
      orderItems: processedOrderItems,
      totalAmount,
      shippingAddress,
      billingAddress,
      paymentMethod: paymentMethod || 'pending',
      status: 'pending',
      statusReason: 'Order created, awaiting stock validation.',
      deliveryNote: notes || '',
      stockValidation: {
        isValidated: false,
        validationDate: undefined,
        validationResult: undefined,
        availableItems: [],
        unavailableItems: [],
        stockDeducted: false,
        stockDeductedAt: undefined
      }
    });

    console.log('DEBUG: Order object created with status:', newOrder.status);
    await newOrder.save();
    console.log(`DEBUG: ✅ Order saved to database with ID: ${newOrder._id}`);

    // Trigger server-side stock validation asynchronously
    console.log('======= TRIGGERING SERVER-SIDE STOCK VALIDATION =======');
    setImmediate(async () => {
      try {
        console.log(`DEBUG: Starting async stock validation for order: ${newOrder._id}`);
        
        // Add 1-minute delay for testing purposes - allows time to modify stock during order creation
        console.log('DEBUG: Adding 1-minute delay for testing purposes...');
        console.log('DEBUG: This allows time to modify stock levels during order creation');
        await new Promise(resolve => setTimeout(resolve, 60000));
        console.log('DEBUG: Delay completed - proceeding with stock validation');
        
        const stockValidation = await validateOrderStock(stockValidationItems);
        console.log('DEBUG: Stock validation result:', JSON.stringify(stockValidation, null, 2));
        
        let orderStatus = 'pending';
        let statusReason = '';
        let shouldDeductStock = false;

        if (stockValidation.validationResult === 'all_available') {
          orderStatus = 'processing';
          shouldDeductStock = true;
          statusReason = 'All items available in stock. Order processing.';
          console.log(`DEBUG: ✅ All items available - Status will change to: ${orderStatus}`);
        } else if (stockValidation.validationResult === 'partial_available') {
          orderStatus = 'on-hold';
          statusReason = generateStockValidationMessage(stockValidation);
          console.log(`DEBUG: ⚠️ Partial stock available - Status will change to: ${orderStatus}`);
        } else {
          orderStatus = 'failed';
          statusReason = 'Stock finished - no items available in requested quantities.';
          console.log(`DEBUG: ❌ No items available - Status will change to: ${orderStatus}`);
        }

        // Update order with validation results
        const orderUpdate: any = {
          status: orderStatus,
          statusReason,
          'stockValidation.isValidated': true,
          'stockValidation.validationDate': new Date(),
          'stockValidation.validationResult': stockValidation.validationResult,
          'stockValidation.availableItems': stockValidation.availableItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            availableQuantity: item.availableQuantity,
            requestedQuantity: item.requestedQuantity
          })),
          'stockValidation.partiallyAvailableItems': stockValidation.partiallyAvailableItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            availableQuantity: item.availableQuantity,
            requestedQuantity: item.requestedQuantity,
            shortfall: item.shortfall
          })),
          'stockValidation.unavailableItems': stockValidation.unavailableItems.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            availableQuantity: item.availableQuantity,
            requestedQuantity: item.requestedQuantity
          }))
        };

        await Order.findByIdAndUpdate(newOrder._id, orderUpdate);
        console.log(`DEBUG: ✅ Order updated with validation results - Status: ${orderStatus}`);

        // Deduct stock if all items are available
        if (shouldDeductStock) {
          console.log('DEBUG: Attempting to deduct stock...');
          const deductionResult = await deductStock(stockValidationItems);
          
          if (deductionResult.success) {
            console.log('DEBUG: ✅ Stock deduction successful');
            await Order.findByIdAndUpdate(newOrder._id, {
              'stockValidation.stockDeducted': true,
              'stockValidation.stockDeductedAt': new Date()
            });
            console.log('DEBUG: ✅ Order updated - stock marked as deducted');
          } else {
            console.error('DEBUG: ❌ Stock deduction failed:', deductionResult.errors);
            await Order.findByIdAndUpdate(newOrder._id, {
              status: 'on-hold',
              statusReason: `Stock deduction failed: ${deductionResult.errors.join(', ')}`
            });
          }
        }
        
        console.log(`DEBUG: ✅ Async stock validation completed for order: ${newOrder._id}`);
      } catch (error) {
        console.error(`DEBUG: ❌ Error in async stock validation for order ${newOrder._id}:`, error);
        await Order.findByIdAndUpdate(newOrder._id, {
          status: 'failed',
          statusReason: 'Stock validation failed due to system error.'
        });
      }
    });

    // Populate the order for response
    console.log('======= FINAL ORDER PREPARATION =======');
    console.log(`DEBUG: Preparing final response for order: ${newOrder._id}`);
    console.log(`DEBUG: Order status: ${newOrder.status} (pending - stock validation will happen server-side)`);
    
    const populatedOrder = await Order.findById(newOrder._id)
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email phone' })
      .populate({
        path: 'orderItems.product',
        model: Product,
        select: 'name sku price images'
      });

    console.log('DEBUG: ✅ Order creation completed successfully');
    console.log('======= ORDER CREATION SUMMARY =======');
    console.log(`Order ID: ${newOrder._id}`);
    console.log(`Order Number: ${newOrder.orderNumber}`);
    console.log(`Status: ${newOrder.status}`);
    console.log(`Status Reason: ${newOrder.statusReason}`);
    console.log(`Stock Validation: Will happen server-side asynchronously`);
    console.log('=====================================');

    return res.status(201).json({
      message: 'Order created successfully - stock validation will happen server-side',
      order: populatedOrder,
      note: 'Order created with pending status. Stock validation and status updates will happen automatically server-side.'
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ 
      message: 'Error creating order', 
      error: (error as Error).message 
    });
  }
}
