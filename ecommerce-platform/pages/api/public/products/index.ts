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
        isPublished: true, // Filter by isPublished: true for products
    };

    // Fetch published category IDs
    const publishedCategories = await Category.find({ isPublished: true }).select('_id').lean();
    const publishedCategoryIds = publishedCategories.map(cat => cat._id);

    if (ids && typeof ids === 'string') {
      const idArray = ids.split(',').filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      if (idArray.length > 0) query._id = { $in: idArray };
    }

    if (categoryId && typeof categoryId === 'string' && mongoose.Types.ObjectId.isValid(categoryId)) {
      const categoryObjectId = new mongoose.Types.ObjectId(categoryId);
      // Check if the requested categoryId is among the published ones
      if (!publishedCategoryIds.some(id => id.equals(categoryObjectId))) {
        // Category is not published or does not exist, return empty results
        return res.status(200).json({
            products: [],
            currentPage: parseInt(page as string),
            totalPages: 0,
            totalItems: 0,
        });
      }
      query.category = categoryObjectId;
    } else {
      // If no specific categoryId is requested, filter products to include only those
      // that either have no category or belong to a published category.
      query.$or = [
        { category: { $exists: false } },
        { category: null },
        { category: { $in: publishedCategoryIds } }
      ];
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
      .populate('category', 'name slug') // isPublished no longer needed here for filtering
      .select('name description price sku images category tags customAttributes slug seoTitle seoDescription isPublished')
      .sort(sortParams)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    // The post-query filter is no longer needed as filtering is done at DB level.
    // const filteredProducts = categoryId ? products : products.filter(product => {
    //     if (product.category && typeof product.category !== 'string') { // Check if category is populated and is an object
    //         return (product.category as any).isPublished === true;
    //     }
    //     return true; // If no category or category not populated with isPublished, keep product (or adjust logic)
    // });

    const totalProducts = await Product.countDocuments(query); // This count now accurately reflects the filtering

    return res.status(200).json({
        products: products, // Use products directly
        currentPage: pageNum,
        totalPages: Math.ceil(totalProducts / limitNum),
        totalItems: totalProducts,
    });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching products:', error);
    return res.status(500).json({ message: 'Unable to retrieve products.' });
  }
}
