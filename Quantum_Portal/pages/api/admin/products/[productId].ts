import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Product from '../../../../models/Product';
import Category from '../../../../models/Category';
import Brand from '../../../../models/Brand';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { productId } = req.query;

  if (!productId || typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
     return res.status(400).json({ message: 'Invalid product ID' });
  }
  const productObjectId = new mongoose.Types.ObjectId(productId as string);

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const product = await Product.findById(productObjectId)
            .populate('category', 'name slug')
            .populate('brand', 'name slug')
            .lean();
        if (!product) {
          return res.status(404).json({ message: 'Product not found' });
        }
        return res.status(200).json(product);
      } catch (error) {
        console.error('Error fetching product:', error);
        return res.status(500).json({ message: 'Error fetching product', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const {
            name, description, price, sku, stockQuantity, category, brand,
            tags, customAttributes, images,
            seoTitle, seoDescription,
            slug, isPublished, // Added slug and isPublished
            hasVariants, attributeDefinitions, variants // New variant fields
        } = req.body;

        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        
        // Handle price and stock for variant products
        if (hasVariants !== undefined && hasVariants) {
          // For variant products, always use 0 for price
          updateData.price = 0;
          
          // Auto-generate SKU for variant products based on product name
          if (name !== undefined) {
            updateData.sku = name
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]+/g, '')
              .replace(/--+/g, '-')
              .replace(/^-+/, '')
              .replace(/-+$/, '');
          } else {
            updateData.sku = ''; // Clear SKU if name not provided
          }
          
          // Calculate total stock across all variants
          if (variants && variants.length > 0) {
            updateData.stockQuantity = variants.reduce((total: number, variant: any) => {
              return total + (variant.stockQuantity || 0);
            }, 0);
          } else {
            updateData.stockQuantity = 0;
          }
        } else if (hasVariants === false) {
          // For non-variant products, use provided values
          if (price !== undefined) updateData.price = price;
          if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
        } else {
          // If hasVariants is not specified, handle price and stock normally
          if (price !== undefined) updateData.price = price;
          if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
        }
        
        if (tags !== undefined) updateData.tags = tags || [];
        if (images !== undefined) updateData.images = images || [];
        if (seoTitle !== undefined) updateData.seoTitle = seoTitle || '';
        if (seoDescription !== undefined) updateData.seoDescription = seoDescription || '';
        if (isPublished !== undefined) updateData.isPublished = isPublished; // Add isPublished
        
        // Handle variant system fields
        if (hasVariants !== undefined) updateData.hasVariants = hasVariants;
        if (attributeDefinitions !== undefined) updateData.attributeDefinitions = attributeDefinitions || {};
        if (variants !== undefined) updateData.variants = variants || [];
        
        if (slug !== undefined) { // If slug is explicitly sent, use it (model hook will format)
            updateData.slug = slug;
        } else if (name !== undefined) {
            // If name is changing, and slug is not explicitly provided,
            // the model's pre-save hook should ideally regenerate the slug.
            // To ensure this, we can make slug dependent on name changing if not provided.
            // However, if 'slug' is not in updateData, the hook only runs if 'name' changed AND slug wasn't modified.
            // To be safe, if name is in updateData, we can explicitly set slug to be undefined
            // so the hook re-evaluates based on new name, unless a slug was also part of req.body.
            // For now, rely on model hook: if name changes and slug is not in req.body, hook should handle it.
            // If slug IS in req.body (even empty string), it's handled by `updateData.slug = slug` above.
        }


        if (category) {
          if (!mongoose.Types.ObjectId.isValid(category)) {
             return res.status(400).json({ message: 'Invalid category ID format for product category' });
          }
          const categoryExists = await Category.findById(category);
          if (!categoryExists) {
            return res.status(404).json({ message: 'Category not found' });
          }
          updateData.category = new mongoose.Types.ObjectId(category);
        } else if (category === null || category === '') {
            updateData.category = null;
        }

        if (brand) {
          if (!mongoose.Types.ObjectId.isValid(brand)) {
             return res.status(400).json({ message: 'Invalid brand ID format for product brand' });
          }
          const brandExists = await Brand.findById(brand);
          if (!brandExists) {
            return res.status(404).json({ message: 'Brand not found' });
          }
          updateData.brand = new mongoose.Types.ObjectId(brand);
        }

        if (sku && !hasVariants) {
            const existingProductBySku = await Product.findOne({ sku: sku, _id: { $ne: productObjectId } });
            if (existingProductBySku) {
                return res.status(409).json({ message: 'Another product with this SKU already exists.' });
            }
            updateData.sku = sku;
        }

        // If slug is being explicitly changed to something, check for uniqueness
        if (updateData.slug) {
            const existingProductBySlug = await Product.findOne({ slug: updateData.slug, _id: { $ne: productObjectId } });
            if (existingProductBySlug) {
                return res.status(409).json({ message: 'Another product with this slug already exists.' });
            }
        }


        const updatedProduct = await Product.findByIdAndUpdate(
          productObjectId,
          { $set: updateData },
          { new: true, runValidators: true }
        ).populate('category', 'name slug').populate('brand', 'name slug');

        if (!updatedProduct) {
          return res.status(404).json({ message: 'Product not found for update' });
        }
        return res.status(200).json(updatedProduct);
      } catch (error) {
        if ((error as any).code === 11000 && ((error as any).keyPattern?.sku || (error as any).keyPattern?.slug)) {
          const field = (error as any).keyPattern?.sku ? 'SKU' : 'slug';
          return res.status(409).json({ message: `A product with this ${field} already exists.` });
        }
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        console.error('Error updating product:', error);
        return res.status(500).json({ message: 'Error updating product', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const deletedProduct = await Product.findByIdAndDelete(productObjectId);
        if (!deletedProduct) {
          return res.status(404).json({ message: 'Product not found for deletion' });
        }
        return res.status(200).json({ message: 'Product deleted successfully' });
      } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ message: 'Error deleting product', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
