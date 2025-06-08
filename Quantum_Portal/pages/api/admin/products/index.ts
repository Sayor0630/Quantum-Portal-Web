import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect'; // Corrected
import Product from '../../../../models/Product';  // Corrected
import Category from '../../../../models/Category';  // Corrected
import Brand from '../../../../models/Brand';  // Added Brand import
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
        const includeSubcategories = req.query.includeSubcategories === 'true';
        const selectedSubcategories = req.query.selectedSubcategories as string; // Comma-separated IDs
        const brandId = req.query.brandId as string;
        const searchQuery = req.query.search as string;
        const fields = req.query.fields as string;

        const query: any = {};
        if (categoryId) {
          if (!mongoose.Types.ObjectId.isValid(categoryId)) {
             return res.status(400).json({ message: 'Invalid category ID format' });
          }
          
          if (selectedSubcategories) {
            // User has selected specific subcategories
            const subcategoryIds = selectedSubcategories.split(',').filter(id => id.trim());
            const validSubcategoryIds = subcategoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            
            if (validSubcategoryIds.length !== subcategoryIds.length) {
              return res.status(400).json({ message: 'Invalid subcategory ID format in selection' });
            }
            
            const allSelectedIds = [
              new mongoose.Types.ObjectId(categoryId),
              ...validSubcategoryIds.map(id => new mongoose.Types.ObjectId(id))
            ];
            query.category = { $in: allSelectedIds };
          } else if (includeSubcategories) {
            // Get all subcategory IDs recursively
            const getAllSubcategoryIds = async (parentId: string): Promise<mongoose.Types.ObjectId[]> => {
              const children = await Category.find({ parent: parentId }).select('_id').lean();
              const childIds: mongoose.Types.ObjectId[] = children.map(child => 
                new mongoose.Types.ObjectId(child._id.toString())
              );
              
              // Recursively get subcategories of children
              for (const childId of childIds) {
                const grandChildren = await getAllSubcategoryIds(childId.toString());
                childIds.push(...grandChildren);
              }
              
              return childIds;
            };
            
            const subcategoryIds = await getAllSubcategoryIds(categoryId);
            const allCategoryIds = [new mongoose.Types.ObjectId(categoryId), ...subcategoryIds];
            query.category = { $in: allCategoryIds };
          } else {
            query.category = new mongoose.Types.ObjectId(categoryId);
          }
        }
        if (brandId) {
          if (!mongoose.Types.ObjectId.isValid(brandId)) {
             return res.status(400).json({ message: 'Invalid brand ID format' });
          }
          query.brand = new mongoose.Types.ObjectId(brandId);
        }
        if (searchQuery) {
            // Get brand IDs that match the search term
            const matchingBrands = await Brand.find({ 
              name: { $regex: searchQuery, $options: 'i' }, 
              isActive: true 
            }).select('_id').lean();
            const brandIds = matchingBrands.map(brand => brand._id);
            
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { sku: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                ...(brandIds.length > 0 ? [{ brand: { $in: brandIds } }] : [])
            ];
        }

        // Handle attribute filtering
        const attributeFilters: { [key: string]: any } = {};
        const hasAttributeFilters: string[] = [];
        
        Object.keys(req.query).forEach(key => {
          if (key.startsWith('attribute.')) {
            const attributeName = key.replace('attribute.', '');
            const values = (req.query[key] as string).split(',').map(v => v.trim()).filter(v => v);
            if (values.length > 0) {
              attributeFilters[attributeName] = values;
            }
          } else if (key.startsWith('hasAttribute.')) {
            const attributeName = key.replace('hasAttribute.', '');
            if (req.query[key] === 'true') {
              hasAttributeFilters.push(attributeName);
            }
          }
        });

        // Apply attribute filters to query
        if (Object.keys(attributeFilters).length > 0 || hasAttributeFilters.length > 0) {
          const attributeConditions: any[] = [];
          
          // Handle specific attribute value filtering
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
          
          // Handle attribute existence filtering
          hasAttributeFilters.forEach(attributeName => {
            // For products with variants, check if any variant has this attribute
            const variantCondition = {
              $and: [
                { hasVariants: true },
                { 
                  variants: { 
                    $elemMatch: { 
                      isActive: true,
                      [`attributeCombination.${attributeName}`]: { $exists: true }
                    } 
                  } 
                }
              ]
            };
            
            // For products without variants, check if custom attribute exists
            const customAttributeCondition = {
              $and: [
                { $or: [{ hasVariants: false }, { hasVariants: { $exists: false } }] },
                { [`customAttributes.${attributeName}`]: { $exists: true } }
              ]
            };
            
            attributeConditions.push({ $or: [variantCondition, customAttributeCondition] });
          });
          
          if (attributeConditions.length > 0) {
            query.$and = query.$and || [];
            query.$and.push(...attributeConditions);
          }
        }

        let productQuery = Product.find(query);
        if (fields) {
            productQuery = productQuery.select(fields.split(',').join(' ')) as any;
        } else {
            productQuery = productQuery
                .populate('category', 'name slug parent')
                .populate('brand', 'name slug')
                .populate({
                    path: 'category',
                    populate: {
                        path: 'parent',
                        select: 'name slug'
                    }
                });
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
          totalItems: totalProducts,
        });
      } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ message: 'Error fetching products', error: (error as Error).message });
      }

    case 'POST':
      try {
        const {
            name, description, price, sku, stockQuantity, category, brand,
            tags, customAttributes, images,
            seoTitle, seoDescription,
            slug, isPublished, // Added slug and isPublished
            hasVariants, attributeDefinitions, variants // New variant fields
        } = req.body;

        if (!name || !description || !brand) {
          return res.status(400).json({ message: 'Missing required fields: name, description, brand' });
        }

        // Validate required fields based on whether product has variants
        if (!hasVariants) {
          if (price === undefined || !sku) {
            return res.status(400).json({ message: 'Missing required fields for non-variant product: price, SKU' });
          }
        } else {
          if (!variants || variants.length === 0) {
            return res.status(400).json({ message: 'Variant products must have at least one variant' });
          }
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

        // Validate brand (required)
        if (!mongoose.Types.ObjectId.isValid(brand)) {
           return res.status(400).json({ message: 'Invalid brand ID format for product brand' });
        }
        const brandExists = await Brand.findById(brand);
        if (!brandExists) {
          return res.status(404).json({ message: 'Brand not found' });
        }

        // Handle price and stock for variant products
        let finalPrice = hasVariants ? 0 : (price || 0);
        let finalStock = stockQuantity || 0;
        let finalSku = sku;
        
        if (hasVariants && variants && variants.length > 0) {
          // Calculate total stock across all variants
          finalStock = variants.reduce((total: number, variant: any) => {
            return total + (variant.stockQuantity || 0);
          }, 0);
          
          // Auto-generate SKU for variant products based on product name
          if (!finalSku) {
            finalSku = name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]+/g, '')
              .replace(/--+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '');
          }
        }

        const newProductData: any = {
          name,
          description,
          price: finalPrice,
          sku: finalSku || '',
          stockQuantity: finalStock,
          category: category ? new mongoose.Types.ObjectId(category) : undefined,
          brand: new mongoose.Types.ObjectId(brand),
          tags: tags || [],
          images: images || [],
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          isPublished: isPublished !== undefined ? isPublished : false,
          hasVariants: hasVariants || false,
          attributeDefinitions: hasVariants ? (attributeDefinitions || {}) : {},
          variants: hasVariants ? (variants || []) : [],
        };

        if (slug) { // If slug is provided, include it; pre-save hook will format/validate
            newProductData.slug = slug;
        }
        // If slug is not provided, the pre-save hook in the model will generate it from 'name'

        const newProduct = await Product.create(newProductData);
        return res.status(201).json(newProduct);
      } catch (error) {
        if ((error as any).code === 11000 && ((error as any).keyPattern?.sku || (error as any).keyPattern?.slug) ) {
          const field = (error as any).keyPattern?.sku ? 'SKU' : 'slug';
          return res.status(409).json({ message: `A product with this ${field} already exists.` });
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
