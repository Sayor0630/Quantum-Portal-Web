import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Product from '../../../../models/Product'; // To populate product names
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
    const limit = parseInt(req.query.limit as string) || 5; // Default to top 5 products

    const popularProductsData = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'completed', 'shipped'] } } }, // Consider sold products
      { $unwind: '$orderItems' }, // Deconstruct orderItems array
      {
        $group: {
          _id: '$orderItems.product', // Group by product ID
          totalSold: { $sum: '$orderItems.quantity' }
        }
      },
      { $sort: { totalSold: -1 } }, // Sort by most sold
      { $limit: limit },
      {
        $lookup: { // Populate product details (name, sku, etc.)
          from: Product.collection.name, // Product collection name
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      {
        $match: { productDetails: { $ne: [] } } // Ensure product still exists
      },
      { $unwind: '$productDetails' }, // Deconstruct productDetails array (should be one item)
      {
        $project: { // Select and format final fields
          productId: '$_id',
          name: '$productDetails.name',
          sku: '$productDetails.sku',
          images: '$productDetails.images', // Pass images array to client
          totalSold: '$totalSold',
          _id: 0 // Exclude the default _id from aggregation
        }
      }
    ]);

    // Post-process to add thumbnail and simplify images if needed
    const result = popularProductsData.map(p => ({
        ...p,
        thumbnail: (p.images && p.images.length > 0) ? p.images[0] : null,
        // Decide if you want to keep the full images array or remove it
        // images: undefined, // Example: if you only want thumbnail on this specific endpoint
    }));


    return res.status(200).json(result);

  } catch (error) {
    console.error('Error fetching popular products:', error);
    return res.status(500).json({ message: 'Error fetching popular products', error: (error as Error).message });
  }
}
