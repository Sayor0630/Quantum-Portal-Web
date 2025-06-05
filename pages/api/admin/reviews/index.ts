import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Review from '../../../../models/Review';
import Product from '../../../../models/Product'; // For populating product details
import Customer from '../../../../models/Customer'; // For populating customer details
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Add role check here if needed
  // if ((session.user as { role?: string })?.role !== 'superadmin' && (session.user as { role?: string })?.role !== 'moderator') {
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
    const status = req.query.status as string; // 'pending', 'approved', 'rejected'
    const productId = req.query.productId as string;
    const customerId = req.query.customerId as string;
    const ratingQuery = req.query.rating as string; // Keep as string for parsing
    const sortField = req.query.sortField as string || 'createdAt';
    const sortOrder = (req.query.sortOrder as string === 'asc') ? 1 : -1;


    const query: any = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.product = new mongoose.Types.ObjectId(productId);
    }
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      query.customer = new mongoose.Types.ObjectId(customerId);
    }
    if (ratingQuery) {
      const rating = parseInt(ratingQuery);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        query.rating = rating;
      } else {
        return res.status(400).json({ message: 'Invalid rating value. Must be between 1 and 5.' });
      }
    }

    const sortCriteria: any = {};
    sortCriteria[sortField] = sortOrder;


    const reviews = await Review.find(query)
      .populate({ path: 'product', model: Product, select: 'name sku images' })
      .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalReviews = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalReviews / limit);

    return res.status(200).json({
      reviews,
      currentPage: page,
      totalPages,
      totalItems: totalReviews,
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({ message: 'Error fetching reviews', error: (error as Error).message });
  }
}
