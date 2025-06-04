import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjust path as needed
import connectToDatabase from '../../../../lib/dbConnect'; // Adjust path as needed
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer';
import Product from '../../../../models/Product';
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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);


    // Total lifetime sales revenue
    const totalSalesData = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'completed', 'shipped'] } } }, // Define what constitutes a sale
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = totalSalesData.length > 0 ? totalSalesData[0].totalRevenue : 0;

    // Revenue in the last 30 days
    const monthlySalesData = await Order.aggregate([
        { $match: {
            status: { $in: ['delivered', 'completed', 'shipped'] },
            createdAt: { $gte: thirtyDaysAgo }
        }},
        { $group: { _id: null, monthlyRevenue: { $sum: '$totalAmount' } } }
    ]);
    const monthlyRevenue = monthlySalesData.length > 0 ? monthlySalesData[0].monthlyRevenue : 0;


    // New orders in the last 7 days
    const newOrdersCountLast7Days = await Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // New customer registrations in the last 7 days
    const newCustomersCountLast7Days = await Customer.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Total number of products
    const totalProductsCount = await Product.countDocuments({});

    // Number of pending orders
    const pendingOrdersCount = await Order.countDocuments({ status: 'pending' });


    return res.status(200).json({
      totalRevenue,
      monthlyRevenue,
      newOrdersCountLast7Days,
      newCustomersCountLast7Days,
      totalProductsCount,
      pendingOrdersCount,
    });

  } catch (error) {
    console.error('Error fetching summary metrics:', error);
    return res.status(500).json({ message: 'Error fetching summary metrics', error: (error as Error).message });
  }
}
