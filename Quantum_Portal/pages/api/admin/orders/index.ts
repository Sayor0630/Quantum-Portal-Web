import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order, { IOrderItem } from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
import mongoose from 'mongoose';

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

    // Validate required fields
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    if (!shippingAddress || !billingAddress) {
      return res.status(400).json({ message: 'Shipping and billing addresses are required' });
    }

    let customer;

    // Handle customer - either find existing or create new
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(400).json({ message: 'Customer not found' });
      }
    } else if (customerEmail) {
      // Try to find customer by email first
      customer = await Customer.findOne({ email: customerEmail });
      
      if (!customer) {
        // Create new customer
        if (!customerFirstName || !customerLastName) {
          return res.status(400).json({ message: 'Customer first name and last name are required for new customers' });
        }

        customer = new Customer({
          firstName: customerFirstName,
          lastName: customerLastName,
          email: customerEmail,
          phone: customerPhone || '',
        });
        await customer.save();
      }
    } else {
      return res.status(400).json({ message: 'Customer ID or customer email is required' });
    }

    // Validate and process order items
    const processedOrderItems: Partial<IOrderItem>[] = [];
    let totalAmount = 0;

    for (const item of orderItems) {
      if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
        return res.status(400).json({ message: 'Invalid product ID in order items' });
      }

      const product = await Product.findById(item.product).populate('brand', 'name slug logo');
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.product}` });
      }

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
      let price = product.price; // Default to base price
      let sku = product.sku || ''; // Default to base SKU
      let itemImage = product.images && product.images.length > 0 ? product.images[0] : undefined;
      let variant: any = null; // Declare variant variable outside the if block
      
      console.log(`Processing item for product: ${product.name}`);
      console.log(`Product hasVariants: ${product.hasVariants}`);
      console.log(`Selected attributes:`, selectedAttributesObj);
      
      if (product.hasVariants && Object.keys(selectedAttributesObj).length > 0) {
        // Find the matching variant directly
        variant = product.variants.find((v: any) => {
          const variantAttrs = Object.fromEntries(v.attributeCombination);
          return Object.keys(selectedAttributesObj).every(key => variantAttrs[key] === selectedAttributesObj[key]);
        });
        
        console.log(`Found variant:`, variant ? 'Yes' : 'No');
        
        if (!variant || !variant.isActive) {
          console.error(`Variant not found or inactive for attributes:`, selectedAttributesObj);
          return res.status(400).json({ 
            message: `Selected variant combination is not available for product: ${product.name}` 
          });
        }
        
        // Use variant price if available, otherwise fall back to base price
        price = variant.price || product.price;
        sku = variant.sku || product.sku || '';
        
        console.log(`Variant details - Price: ${price}, SKU: ${sku}, Stock: ${variant.stockQuantity}`);
        
        // Use variant-specific image if available
        if (variant.images && variant.images.length > 0) {
          itemImage = variant.images[0].url;
        }
        
        // Check stock availability for the specific variant
        if (quantity > variant.stockQuantity) {
          return res.status(400).json({ 
            message: `Insufficient stock for variant. Available: ${variant.stockQuantity}, Requested: ${quantity}` 
          });
        }
      } else if (!product.hasVariants) {
        // For non-variant products, check regular stock
        if (quantity > product.stockQuantity) {
          return res.status(400).json({ 
            message: `Insufficient stock. Available: ${product.stockQuantity}, Requested: ${quantity}` 
          });
        }
      }

      const itemTotal = price * quantity;
      totalAmount += itemTotal;

      console.log(`Final item details - Name: ${product.name}, SKU: ${sku}, Price: ${price}, Quantity: ${quantity}, Total: ${itemTotal}`);

      // Prepare brand information (use from request if available, otherwise from product)
      let brandInfo: any = null;
      console.log('DEBUG: Processing brand for item:', {
        itemBrand: item.brand,
        productBrand: product.brand,
        productName: product.name
      });
      
      if (item.brand && item.brand._id) {
        // Use brand info from the frontend request
        brandInfo = {
          _id: new mongoose.Types.ObjectId(item.brand._id),
          name: item.brand.name,
          slug: item.brand.slug,
          logo: item.brand.logo
        };
        console.log('DEBUG: Using brand from frontend request:', brandInfo);
      } else if (product.brand) {
        // Fallback to brand from product (need to populate it)
        const populatedBrand = product.brand as any;
        if (populatedBrand && populatedBrand._id) {
          brandInfo = {
            _id: populatedBrand._id,
            name: populatedBrand.name,
            slug: populatedBrand.slug,
            logo: populatedBrand.logo
          };
          console.log('DEBUG: Using brand from populated product:', brandInfo);
        }
      }
      
      console.log('DEBUG: Final brandInfo before adding to order item:', brandInfo);

      processedOrderItems.push({
        product: product._id as mongoose.Types.ObjectId,
        name: product.name,
        sku,
        price,
        quantity,
        image: itemImage,
        selectedAttributes,
        brand: brandInfo,
        // Add variant product fields
        isVariantProduct: item.isVariantProduct || product.hasVariants || false,
        variantId: item.variantId || (variant ? variant._id : undefined)
      });
    }

    // Create the order
    const newOrder = new Order({
      customer: customer._id,
      orderItems: processedOrderItems,
      totalAmount,
      shippingAddress,
      billingAddress,
      paymentMethod: paymentMethod || 'pending',
      status,
      deliveryNote: notes || ''
    });

    console.log('DEBUG: Order before saving:', JSON.stringify(newOrder.toObject(), null, 2));
    await newOrder.save();
    console.log('DEBUG: Order after saving:', JSON.stringify(newOrder.toObject(), null, 2));

    // Populate the order for response
    const populatedOrder = await Order.findById(newOrder._id)
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email phone' })
      .populate({
        path: 'orderItems.product',
        model: Product,
        select: 'name sku price images'
      });

    return res.status(201).json({
      message: 'Order created successfully',
      order: populatedOrder
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ 
      message: 'Error creating order', 
      error: (error as Error).message 
    });
  }
}
