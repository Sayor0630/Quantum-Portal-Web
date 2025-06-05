import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import Product from '../../../../models/Product';
import Category from '../../../../models/Category';
import mongoose from 'mongoose';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    await connectToDatabase();
    const {
        ids,
        categoryId,
        limit = '12',
        page = '1',
        slug,
        tag,
        tags,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        minPrice,
        maxPrice,
        ...otherFilters
    } = req.query;

    const query: any = {
        isPublished: true, // Filter by isPublished: true
    };

    if (ids && typeof ids === 'string') {
      const idArray = ids.split(',').filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      if (idArray.length > 0) query._id = { $in: idArray };
    }
    if (categoryId && typeof categoryId === 'string' && mongoose.Types.ObjectId.isValid(categoryId)) {
      query.category = new mongoose.Types.ObjectId(categoryId);
    }
    if (slug && typeof slug === 'string') {
        query.slug = slug; // Query by actual slug field now
    }
    if (tag && typeof tag === 'string') {
        query.tags = tag;
    }
    if (tags && typeof tags === 'string') {
        query.tags = { $in: tags.split(',').map(t => t.trim()).filter(t => t) }; // Trim and filter empty tags
    }
    if (minPrice && !isNaN(parseFloat(minPrice as string))) {
        query.price = { ...query.price, $gte: parseFloat(minPrice as string) };
    }
    if (maxPrice && !isNaN(parseFloat(maxPrice as string))) {
        query.price = { ...query.price, $lte: parseFloat(maxPrice as string) };
    }

    for (const key in otherFilters) {
        if (key.startsWith('customAttributes.')) {
            query[key] = otherFilters[key];
        }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const sortParams: any = {};
    if (typeof sortBy === 'string' && typeof sortOrder === 'string') {
        sortParams[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
        sortParams['createdAt'] = -1;
    }

    const products = await Product.find(query)
      .populate('category', 'name slug isPublished') // Also select isPublished for category
      .select('name description price sku images category tags customAttributes slug seoTitle seoDescription isPublished')
      .sort(sortParams)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    // Filter products further if their populated category is not published (unless categoryId filter is already applied)
    const filteredProducts = categoryId ? products : products.filter(product => {
        if (product.category && typeof product.category !== 'string') { // Check if category is populated and is an object
            return (product.category as any).isPublished === true;
        }
        return true; // If no category or category not populated with isPublished, keep product (or adjust logic)
    });

    // Note: Count should ideally reflect the post-filter count if categories are filtered this way.
    // This is complex. For now, totalProducts might be higher than returned if categories are filtered out.
    // A more accurate count would require a more complex aggregation or multiple queries.
    const totalProducts = await Product.countDocuments(query);

    return res.status(200).json({
        products: filteredProducts,
        currentPage: pageNum,
        totalPages: Math.ceil(totalProducts / limitNum), // This might be slightly off if products are filtered by category's isPublished status post-query
        totalItems: totalProducts,
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching products:', error);
    return res.status(500).json({ message: 'Unable to retrieve products.' });
  }
}
