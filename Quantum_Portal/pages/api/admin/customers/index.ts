import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Customer from '../../../../models/Customer';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Add role check here if only certain admin roles can access customers
  // if ((session.user as { role?: string })?.role !== 'superadmin') {
  //   return res.status(403).json({ message: 'Forbidden' });
  // }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await connectToDatabase();

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const searchQuery = req.query.search as string; // Search by name or email
    const status = req.query.status as string; // 'active' or 'inactive'
    const sortField = req.query.sortField as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string === 'asc') ? 1 : -1;

    const query: any = {};
    if (searchQuery) {
      query.$or = [
        { email: { $regex: searchQuery, $options: 'i' } },
        { firstName: { $regex: searchQuery, $options: 'i' } },
        { lastName: { $regex: searchQuery, $options: 'i' } },
        { phoneNumber: { $regex: searchQuery, $options: 'i' } }, // Added phone number search
      ];
    }
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false; // Matches false or non-existent if default is true
    }

    const sortCriteria: any = {};
    sortCriteria[sortField] = sortOrder;


    const customers = await Customer.find(query)
      .select('-password') // Exclude password
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalCustomers = await Customer.countDocuments(query);
    const totalPages = Math.ceil(totalCustomers / limit);

    return res.status(200).json({
      customers,
      currentPage: page,
      totalPages,
      totalItems: totalCustomers,
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ message: 'Error fetching customers', error: (error as Error).message });
  }
}
