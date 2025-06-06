import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjusted path
import dbConnect from '../../../../lib/dbConnect';
import Order, { IOrder, IOrderItem } from '../../../../models/Order';
import Customer, { ICustomer } from '../../../../models/Customer';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt'; // For generating dummy passwords

// Helper to generate a random password
const generateRandomPassword = async () => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(Math.random().toString(36).slice(-8), salt);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ message: 'Unauthorized: No session found' });
    }

    const userRole = (session.user as any).role as Role | undefined;
    if (!userRole || !hasPermission(userRole, Permission.CREATE_ORDER)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    await dbConnect();

    const {
      // customerName is now fullName from form, mapped to customerName for this API
      // email and phoneNumber are top-level from form
      customerName,
      email,
      phoneNumber,
      shippingAddress, // This is the complex object: { street, city, district, country, postalCode, fullName, phone, email (optional inside address too) }
      orderItems,
      totalAmount,
      paymentMethod,
      status, // Optional: overall order status
      paymentStatus, // Optional: payment status for the order
      deliveryNote, // Optional
      customerId: selectedCustomerId, // Optional: ID of a pre-selected customer
    } = req.body;

    // --- Basic Validation ---
    // The form provides customerName (mapped from fullName), email, phoneNumber at top level.
    // shippingAddress comes as an object.
    if (!customerName || !phoneNumber || !shippingAddress || !orderItems || !totalAmount || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields. Customer name, phone, address, items, total, and payment method are essential.' });
    }
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.district || !shippingAddress.country || !shippingAddress.postalCode ) {
        return res.status(400).json({ message: 'Incomplete shipping address object: street, city, district, postalCode, and country are required within shippingAddress.' });
    }
    // Validate fields that are now expected within shippingAddress for the Order model
    if (!shippingAddress.fullName || !shippingAddress.phone) {
        return res.status(400).json({ message: 'Shipping address object must also contain fullName and phone for the recipient.'});
    }

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items must be a non-empty array' });
    }
    if (typeof totalAmount !== 'number' || totalAmount <= 0) {
      return res.status(400).json({ message: 'Total amount must be a positive number' });
    }
    // Phone number validation (from form's top-level phoneNumber)
    if (typeof phoneNumber !== 'string' || !/^01\d{9}$/.test(phoneNumber)) {
        return res.status(400).json({ message: 'Invalid phone number format. Must be 11 digits starting with 01.'});
    }
     // Email validation (top-level, optional in form, but if provided, validate)
    if (email && typeof email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }


    // --- Customer Handling ---
    let finalCustomerId: mongoose.Types.ObjectId;

    if (selectedCustomerId && mongoose.Types.ObjectId.isValid(selectedCustomerId)) {
        // Optionally verify customer exists, but for now, trust valid ObjectId
        const existingCustomer = await Customer.findById(selectedCustomerId);
        if (!existingCustomer) {
            return res.status(400).json({ message: 'Selected customer ID is invalid or customer not found.' });
        }
        finalCustomerId = new mongoose.Types.ObjectId(selectedCustomerId);
        // TODO: Future: Optionally update existing customer's address if different and a flag is set.
    } else {
        // No valid selectedCustomerId, proceed with find by email or create new
        if (email && typeof email === 'string') { // Email is required to find or create customer if no ID provided
            let customer: ICustomer | null = await Customer.findOne({ email: email.toLowerCase() });
            if (customer) {
                finalCustomerId = customer._id as mongoose.Types.ObjectId;
            } else {
                // Create new customer
                const nameParts = customerName.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || undefined;
                const randomPassword = await generateRandomPassword();

                const newCustomer = new Customer({
                    email: email.toLowerCase(),
                    password: randomPassword,
                    firstName,
                    lastName,
                    addresses: [{ // Save the detailed shipping address to the new customer
                        street: shippingAddress.street,
                        city: shippingAddress.city,
                        state: shippingAddress.district, // Map district to Customer's 'state' field
                        postalCode: shippingAddress.postalCode,
                        country: shippingAddress.country,
                        isDefaultShipping: true,
                        isDefaultBilling: true,
                    }],
                    isActive: true,
                });
                await newCustomer.save();
                finalCustomerId = newCustomer._id as mongoose.Types.ObjectId;
            }
        } else {
            // Email is not provided and no customerId was selected - this case implies guest checkout or error
            // For admin panel, we typically want to associate with a customer.
            // If guest orders were allowed, this logic would differ.
            // For now, require email if no customerId is given.
             return res.status(400).json({ message: 'Email is required to find or create a customer if no customer is selected.' });
        }
    }

    // --- Order Item Processing ---
    const processedOrderItems = orderItems.map((item: any) => {
      if (!item.productId || !item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
        throw new Error('Invalid order item structure. Each item must have productId, name, price, and quantity.');
      }
      
      // Process selectedAttributes if present
      const selectedAttributes = new Map();
      if (item.selectedAttributes && typeof item.selectedAttributes === 'object') {
        for (const [key, value] of Object.entries(item.selectedAttributes)) {
          selectedAttributes.set(key, value);
        }
      }
      
      return {
        product: new mongoose.Types.ObjectId(item.productId), // Ensure productId is a valid ObjectId string
        name: item.name,
        sku: item.sku || undefined, // Include SKU if provided
        price: item.price,
        quantity: item.quantity,
        image: item.image || undefined,
        selectedAttributes: selectedAttributes.size > 0 ? selectedAttributes : undefined,
        // Variant product fields
        isVariantProduct: item.isVariantProduct || false,
        variantId: item.variantId || undefined,
      };
    });

    // --- Create New Order ---
    const newOrderData: Partial<IOrder> = {
      customer: finalCustomerId,
      orderItems: processedOrderItems,
      totalAmount,
      shippingAddress: { // Map directly from the validated shippingAddress object in request
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        email: shippingAddress.email, // Optional email for shipping contact
        street: shippingAddress.street,
        city: shippingAddress.city,
        district: shippingAddress.district,
        state: shippingAddress.state, // Optional broader region for shipping
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      paymentMethod: paymentMethod,
      // Optional fields from request, model will apply defaults if not provided
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(deliveryNote && { deliveryNote }),
      // createdBy: new mongoose.Types.ObjectId((session.user as any).id) // If tracking admin who created order
    };

    const newOrder = new Order(newOrderData);
    await newOrder.save();

    // Populate customer and orderItems.product details if needed for the response
    // const populatedOrder = await Order.findById(newOrder._id).populate('customer').populate('orderItems.product');

    return res.status(201).json({ message: 'Order created successfully', order: newOrder });

  } catch (error: any) {
    console.error('Error creating order:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation Error: ' + error.message, details: error.errors });
    }
    if (error.message.startsWith('Invalid order item structure')) {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
