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
      customerName, // Full name
      email,
      phoneNumber,
      shippingAddress, // Object: { street, city, postalCode, country, state? }
      orderItems, // Array: [{ productId, name, price, quantity, image? }]
      totalAmount,
      paymentMethod, // string
      status, // string, optional
    } = req.body;

    // --- Basic Validation ---
    if (!customerName || !email || !phoneNumber || !shippingAddress || !orderItems || !totalAmount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order items must be a non-empty array' });
    }
    if (typeof totalAmount !== 'number' || totalAmount <= 0) {
      return res.status(400).json({ message: 'Total amount must be a positive number' });
    }
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
        return res.status(400).json({ message: 'Incomplete shipping address: street, city, postalCode, and country are required.' });
    }
    // Phone number basic validation (e.g., is a string of numbers)
    if (typeof phoneNumber !== 'string' || !/^\+?[\d\s-]{10,15}$/.test(phoneNumber)) { // Basic international phone regex
        return res.status(400).json({ message: 'Invalid phone number format.'});
    }
     // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }


    // --- Customer Handling ---
    let customer: ICustomer | null = await Customer.findOne({ email: email.toLowerCase() });
    let customerId: mongoose.Types.ObjectId;

    if (customer) {
      customerId = customer._id;
      // Optionally, update customer details if they've changed
      // customer.name = customerName; customer.addresses = [shippingAddress]; await customer.save();
    } else {
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || undefined;
      const randomPassword = await generateRandomPassword();

      const newCustomer = new Customer({
        email: email.toLowerCase(),
        password: randomPassword, // Customer model requires a password
        firstName,
        lastName,
        // Storing the provided shippingAddress as the first address for the new customer
        addresses: [{
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state || '', // Ensure state is not undefined
            zipCode: shippingAddress.postalCode,
            country: shippingAddress.country,
            isDefaultShipping: true,
            isDefaultBilling: true,
        }],
        // phoneNumber, // Customer model does not have a direct phone field, might add later or store in address
        isActive: true,
      });
      await newCustomer.save();
      customerId = newCustomer._id;
    }

    // --- Order Item Processing ---
    const processedOrderItems = orderItems.map((item: any) => {
      if (!item.productId || !item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
        throw new Error('Invalid order item structure. Each item must have productId, name, price, and quantity.');
      }
      return {
        product: new mongoose.Types.ObjectId(item.productId),
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || undefined, // Optional image
      };
    });

    // --- Create New Order ---
    const newOrder = new Order({
      customer: customerId,
      orderItems: processedOrderItems,
      totalAmount,
      status: status || 'pending',
      shippingAddress: { // Ensure this matches the Order model's structure
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
      paymentMethod: paymentMethod || 'N/A', // Default if not provided
      // createdBy: new mongoose.Types.ObjectId(session.user.id) // If you add this to Order model
    });

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
