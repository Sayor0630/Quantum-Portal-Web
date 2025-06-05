import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
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
    const { period = 'last30days', granularity = 'daily' } = req.query;

    let startDate: Date;
    const endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999); // Ensure endDate covers the whole current day

    switch (period) {
      case 'last7days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'last90days':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'last12months':
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        startDate.setDate(endDate.getDate()); // Keep the same day of the month
        break;
      default:
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        break;
    }
    startDate.setHours(0, 0, 0, 0); // Start at the beginning of the day

    let groupFormat: string;
    let dateParts: any = { year: { $year: "$createdAt" } };

    switch (granularity) {
      case 'daily':
        groupFormat = '%Y-%m-%d';
        dateParts.month = { $month: "$createdAt" };
        dateParts.day = { $dayOfMonth: "$createdAt" };
        break;
      case 'weekly':
        groupFormat = '%Y-%V'; // Year-WeekNumber (ISO 8601 week date)
        dateParts.isoWeek = { $isoWeek: "$createdAt" };
        dateParts.isoWeekYear = { $isoWeekYear: "$createdAt" }; // Use isoWeekYear for correct year with week
        break;
      case 'monthly':
        groupFormat = '%Y-%m';
        dateParts.month = { $month: "$createdAt" };
        break;
      default:
        groupFormat = '%Y-%m-%d';
        dateParts.month = { $month: "$createdAt" };
        dateParts.day = { $dayOfMonth: "$createdAt" };
        break;
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['delivered', 'completed', 'shipped'] }
        }
      },
      {
        $group: {
          // _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: "UTC" } }, // Using UTC to be consistent
          _id: dateParts, // Group by structured date parts
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.isoWeekYear': 1, '_id.isoWeek': 1 } } // Sort by date parts
    ]);

    const formattedSalesData = salesData.map(item => {
      let periodLabel = "";
      if (granularity === 'daily') {
        periodLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      } else if (granularity === 'weekly') {
        periodLabel = `${item._id.isoWeekYear}-W${String(item._id.isoWeek).padStart(2, '0')}`;
      } else if (granularity === 'monthly') {
        periodLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      }
      return {
        periodLabel,
        totalSales: item.totalSales,
        orderCount: item.orderCount
      };
    });


    return res.status(200).json(formattedSalesData);

  } catch (error) {
    console.error('Error fetching sales over time:', error);
    return res.status(500).json({ message: 'Error fetching sales over time', error: (error as Error).message });
  }
}
