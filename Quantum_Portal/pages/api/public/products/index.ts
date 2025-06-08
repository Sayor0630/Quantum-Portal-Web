import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import Product from '../../../../models/Product';
import Category from '../../../../models/Category';
import Brand from '../../../../models/Brand';
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
        brandId,
        brandSlug,
        search,
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
    if (brandId && typeof brandId === 'string' && mongoose.Types.ObjectId.isValid(brandId)) {
      query.brand = new mongoose.Types.ObjectId(brandId);
    }
    if (brandSlug && typeof brandSlug === 'string') {
      // Find brand by slug and get its ID
      const brand = await Brand.findOne({ slug: brandSlug, isActive: true }).select('_id').lean();
      if (brand) {
        query.brand = brand._id;
      } else {
        // Brand not found or inactive, return empty results
        return res.status(200).json({
          products: [],
          currentPage: parseInt(page as string),
          totalPages: 0,
          totalItems: 0,
        });
      }
    }
    if (search && typeof search === 'string') {
      // Search across product name, description, SKU, and brand name
      const searchRegex = { $regex: search, $options: 'i' };
      
      // Get brand IDs that match the search term
      const matchingBrands = await Brand.find({ 
        name: searchRegex, 
        isActive: true 
      }).select('_id').lean();
      const brandIds = matchingBrands.map(brand => brand._id);
      
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { sku: searchRegex },
        { tags: searchRegex },
        ...(brandIds.length > 0 ? [{ brand: { $in: brandIds } }] : [])
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

    // Handle attribute filtering (similar to admin API)
    const attributeFilters: { [key: string]: any } = {};
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('attribute.')) {
        const attributeName = key.replace('attribute.', '');
        const values = (req.query[key] as string).split(',').map(v => v.trim()).filter(v => v);
        if (values.length > 0) {
          attributeFilters[attributeName] = values;
        }
      }
    });

    // Apply attribute filters to query
    if (Object.keys(attributeFilters).length > 0) {
      const attributeConditions: any[] = [];
      
      Object.entries(attributeFilters).forEach(([attributeName, values]) => {
        // For products with variants, check if any variant has the required attribute values
        const variantCondition = {
          $and: [
            { hasVariants: true },
            { 
              variants: { 
                $elemMatch: { 
                  isActive: true,
                  [`attributeCombination.${attributeName}`]: { $in: values }
                } 
              } 
            }
          ]
        };
        
        // For products without variants, check custom attributes
        const customAttributeCondition = {
          $and: [
            { $or: [{ hasVariants: false }, { hasVariants: { $exists: false } }] },
            { [`customAttributes.${attributeName}`]: { $in: values } }
          ]
        };
        
        attributeConditions.push({ $or: [variantCondition, customAttributeCondition] });
      });
      
      if (attributeConditions.length > 0) {
        query.$and = query.$and || [];
        query.$and.push(...attributeConditions);
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
      .populate('brand', 'name slug')
      .select('name description price sku images category brand tags customAttributes slug seoTitle seoDescription isPublished hasVariants attributeDefinitions variants stockQuantity')
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
