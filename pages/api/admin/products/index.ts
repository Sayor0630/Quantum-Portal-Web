import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Product from '../../../../models/Product';
import Category from '../../../../models/Category';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const categoryId = req.query.categoryId as string;
        const searchQuery = req.query.search as string;
        const fields = req.query.fields as string; // For selecting specific fields e.g. name,_id

        const query: any = {};
        if (categoryId) {
          if (!mongoose.Types.ObjectId.isValid(categoryId)) {
             return res.status(400).json({ message: 'Invalid category ID format' });
          }
          query.category = new mongoose.Types.ObjectId(categoryId);
        }
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { sku: { $regex: searchQuery, $options: 'i' } },
                // { description: { $regex: searchQuery, $options: 'i' } } // Description search can be heavy
            ];
        }

        let productQuery = Product.find(query);
        if (fields) {
            productQuery = productQuery.select(fields.split(',').join(' '));
        } else {
            // Default population if not specific fields requested for lightweight list
            productQuery = productQuery.populate('category', 'name slug');
        }

        const products = await productQuery
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 })
          .lean();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        return res.status(200).json({
          products,
          currentPage: page,
          totalPages,
          totalItems: totalProducts, // Changed from totalProducts for consistency
        });
      } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Error fetching products', error: (error as Error).message });
      }

    case 'POST':
      try {
        // Destructure new SEO fields
        const { name, description, price, sku, stockQuantity, category, tags, customAttributes, images, seoTitle, seoDescription } = req.body;

        if (!name || !description || price === undefined || !sku) {
          return res.status(400).json({ message: 'Missing required fields: name, description, price, SKU' });
        }

        if (category) {
          if (!mongoose.Types.ObjectId.isValid(category)) {
             return res.status(400).json({ message: 'Invalid category ID format for product category' });
          }
          const categoryExists = await Category.findById(category);
          if (!categoryExists) {
            return res.status(404).json({ message: 'Category not found' });
          }
        }

        const newProduct = await Product.create({
          name,
          description,
          price,
          sku,
          stockQuantity: stockQuantity || 0,
          category: category ? new mongoose.Types.ObjectId(category) : undefined,
          tags: tags || [],
          customAttributes: customAttributes || {},
          images: images || [],
          seoTitle: seoTitle || undefined, // Add seoTitle
          seoDescription: seoDescription || undefined, // Add seoDescription
        });
        return res.status(201).json(newProduct);
      } catch (error) {
        if ((error as any).code === 11000 && (error as any).keyPattern?.sku) {
          return res.status(409).json({ message: 'A product with this SKU already exists.' });
        }
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        console.error('Error creating product:', error);
        return res.status(500).json({ message: 'Error creating product', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
