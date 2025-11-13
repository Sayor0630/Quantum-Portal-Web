import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../../lib/dbConnect';
import Product from '../../../../../models/Product';
import Category from '../../../../../models/Category';
import Brand from '../../../../../models/Brand';
import SiteConfig from '../../../../../models/SiteConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  
  // Ensure models are registered
  Category;
  Brand;

  const { slug } = req.query;

  if (req.method === 'GET') {
    try {
      const product = await Product.findOne({ slug, isPublished: true })
        .populate('category', 'name slug')
        .populate('brand', 'name')
        .lean();

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      // Fetch default product page ID from site config
      const siteConfig = await SiteConfig.findOne().lean();
      const defaultProductPageId = siteConfig?.defaultProductPageId || null;
      const defaultProductPageType = siteConfig?.defaultProductPageType || null;

      res.status(200).json({
        success: true,
        ...product,
        defaultProductPageId, // Include default page ID for fallback
        defaultProductPageType, // Include default page type for fallback
      });
    } catch (error: any) {
      console.error('Error fetching product by slug:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch product',
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
