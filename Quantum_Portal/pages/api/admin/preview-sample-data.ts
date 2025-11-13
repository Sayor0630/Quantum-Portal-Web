import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/dbConnect';
import Product from '../../../models/Product';
import Category from '../../../models/Category';
import Customer from '../../../models/Customer';
import { DataSourceType } from '../../../components/blocks/types';

/**
 * API endpoint to fetch sample data for preview
 * Returns one example record of the requested type
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const { type } = req.query;

    if (!type || typeof type !== 'string') {
      return res.status(400).json({ message: 'Type parameter is required' });
    }

    let sampleData = null;

    switch (type.toLowerCase()) {
      case DataSourceType.PRODUCT:
        // Fetch one published product with populated brand and category
        sampleData = await Product.findOne({ isPublished: true })
          .populate('brand', 'name')
          .populate('category', 'name')
          .lean()
          .exec();
        
        if (sampleData) {
          // Format the product data for preview
          sampleData = {
            ...sampleData,
            // Ensure brand and category are objects with name property
            brand: sampleData.brand || { name: 'Unknown Brand' },
            category: sampleData.category || { name: 'Uncategorized' },
            // Convert _id to string
            _id: sampleData._id?.toString(),
          };
        }
        break;

      case DataSourceType.CATEGORY:
        // Fetch one published category
        sampleData = await Category.findOne({ isPublished: true })
          .populate('parent', 'name')
          .lean()
          .exec();
        
        if (sampleData) {
          sampleData = {
            ...sampleData,
            _id: sampleData._id?.toString(),
            parent: sampleData.parent || null,
          };
        }
        break;

      case DataSourceType.CUSTOMER:
        // Fetch one customer (without sensitive data)
        sampleData = await Customer.findOne()
          .select('-password -resetPasswordToken -resetPasswordExpires')
          .lean()
          .exec();
        
        if (sampleData) {
          sampleData = {
            ...sampleData,
            _id: sampleData._id?.toString(),
          };
        }
        break;

      default:
        return res.status(400).json({ message: `Unsupported type: ${type}` });
    }

    if (!sampleData) {
      return res.status(404).json({ 
        message: `No sample ${type} data found. Please create at least one published ${type}.` 
      });
    }

    return res.status(200).json(sampleData);

  } catch (error: any) {
    console.error('Error fetching preview sample data:', error);
    return res.status(500).json({ 
      message: 'Error fetching sample data', 
      error: error.message 
    });
  }
}
