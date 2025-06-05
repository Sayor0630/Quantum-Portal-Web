import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populating customer details
import Product from '../../../../models/Product'; // For populating product details in order items
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

  await connectToDatabase();

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;
    const dateFrom = req.query.dateFrom as string; // Expect YYYY-MM-DD
    const dateTo = req.query.dateTo as string;     // Expect YYYY-MM-DD
    const sortField = req.query.sortField as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string === 'asc') ? 1 : -1;


    const query: any = {};
    if (status) query.status = status;
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customer = new mongoose.Types.ObjectId(customerId);
    }
    if (dateFrom) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0,0,0,0); // Start of the day
      query.createdAt = { ...query.createdAt, $gte: startDate };
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23,59,59,999); // End of the day
      query.createdAt = { ...query.createdAt, $lte: endDate };
    }

    const sortCriteria: any = {};
    sortCriteria[sortField] = sortOrder;


    const orders = await Order.find(query)
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
      .populate({
          path: 'orderItems.product',
          model: Product,
          select: 'name sku price images',
          // Not populating product.category here to keep list view lighter
      })
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // Use .lean() for faster queries if not modifying docs before sending

    const totalOrders = await Order.countDocuments(query);
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
