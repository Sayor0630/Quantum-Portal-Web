import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Product, { IProduct } from '../../../../models/Product';
import Category from '../../../../models/Category';
import Brand from '../../../../models/Brand';
import AttributeDefinition, { IAttributeDefinition } from '../../../../models/AttributeDefinition';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user || !(session.user as any).role) {
      return res.status(401).json({ message: 'Unauthorized: No valid session found' });
    }

    await connectToDatabase();
    
    // Ensure Category model is registered
    if (!require('mongoose').models.Category) {
      require('../../../../models/Category');
    }

    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ message: 'Bad Request: Query must be at least 2 characters long.' });
    }

    const searchTerm = q.trim();
    const searchLimit = Math.min(parseInt(limit as string) || 10, 20); // Max 20 results

    // Build search criteria for multiple fields
    const searchCriteria: any = {
      $and: [
        { isPublished: true }, // Only search published products
        {
          $or: [
            // Search by name (partial match, case insensitive)
            { name: { $regex: searchTerm, $options: 'i' } },
            // Search by SKU (partial match, case insensitive)
            { sku: { $regex: searchTerm, $options: 'i' } },
            // Search by description (partial match, case insensitive)
            { description: { $regex: searchTerm, $options: 'i' } },
          ]
        }
      ]
    };

    // Get brand IDs that match the search term for brand name searching
    const matchingBrands = await Brand.find({ 
      name: { $regex: searchTerm, $options: 'i' }, 
      isActive: true 
    }).select('_id').lean();
    
    if (matchingBrands.length > 0) {
      const brandIds = matchingBrands.map(brand => brand._id);
      searchCriteria.$and[1].$or.push({ brand: { $in: brandIds } });
    }

    const products = await Product.find(searchCriteria)
      .select('_id name sku price stockQuantity images customAttributes category brand hasVariants attributeDefinitions variants')
      .populate('category', 'name slug')
      .populate('brand', 'name slug logo')
      .sort({ name: 1 }) // Sort by name
      .limit(searchLimit)
      .lean();

    // Get all attribute definitions for custom attributes
    const attributeDefinitions = await AttributeDefinition.find({})
      .select('name values')
      .lean();

    // Create a map for easy lookup
    const attributeMap = new Map<string, string[]>();
    attributeDefinitions.forEach(attr => {
      attributeMap.set(attr.name, attr.values);
    });

    // Format results for autocomplete display and include available attribute options
    const formattedResults = products.map((product: any) => {
      let productAttributes: { [key: string]: string[] } = {};
      let hasAttributes = false;
      let priceRange = { min: product.price, max: product.price };
      let totalStock = product.stockQuantity;
      
      // Handle new variant system
      if (product.hasVariants && product.attributeDefinitions && product.variants) {
        // Use attributeDefinitions from the product
        productAttributes = product.attributeDefinitions;
        hasAttributes = Object.keys(productAttributes).length > 0;
        
        // Calculate price range and total stock from variants
        if (product.variants.length > 0) {
          const variantPrices = product.variants
            .filter((v: any) => v.isActive)
            .map((v: any) => v.price || product.price);
          const variantStocks = product.variants
            .filter((v: any) => v.isActive)
            .map((v: any) => v.stockQuantity || 0);
            
          if (variantPrices.length > 0) {
            priceRange = {
              min: Math.min(...variantPrices),
              max: Math.max(...variantPrices)
            };
          }
          
          totalStock = variantStocks.reduce((sum, stock) => sum + stock, 0);
        }
      } 
      // Handle legacy custom attributes system
      else if (product.customAttributes) {
        Object.keys(product.customAttributes).forEach(attrName => {
          if (attributeMap.has(attrName)) {
            productAttributes[attrName] = attributeMap.get(attrName) || [];
          }
        });
        hasAttributes = Object.keys(productAttributes).length > 0;
      }

      return {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        stockQuantity: totalStock,
        images: product.images || [],
        category: product.category,
        brand: product.brand,
        displayText: product.hasVariants ? 
          `${product.name} (${product.sku}) - $${priceRange.min.toFixed(2)}-$${priceRange.max.toFixed(2)} [${product.variants?.length || 0} variants]${product.brand ? ` - ${(product.brand as any).name}` : ''}` :
          `${product.name} (${product.sku}) - $${product.price}${product.brand ? ` - ${(product.brand as any).name}` : ''}`,
        customAttributes: product.customAttributes || {},
        availableAttributes: productAttributes, // Available attribute options
        hasAttributes,
        // New variant-specific fields
        hasVariants: product.hasVariants || false,
        priceRange,
        variants: product.variants || []
      };
    });

    return res.status(200).json({ 
      success: true, 
      data: formattedResults,
      count: formattedResults.length 
    });

  } catch (error: any) {
    console.error('Error during product search:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
