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
            .lean(); // Use lean for faster reads if not modifying before sending
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
        // Destructure all possible fields, including new SEO fields
        const { name, description, price, sku, stockQuantity, category, tags, customAttributes, images, seoTitle, seoDescription } = req.body;

        // Start with an empty updateData object
        const updateData: any = {};

        // Conditionally add fields to updateData if they are present in the request body
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = price;
        if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
        if (tags !== undefined) updateData.tags = tags || [];
        if (customAttributes !== undefined) updateData.customAttributes = customAttributes || {};
        if (images !== undefined) updateData.images = images || [];
        if (seoTitle !== undefined) updateData.seoTitle = seoTitle || ''; // Allow empty string to clear
        if (seoDescription !== undefined) updateData.seoDescription = seoDescription || ''; // Allow empty string to clear


        if (category) { // If category is explicitly provided in body
          if (!mongoose.Types.ObjectId.isValid(category)) {
             return res.status(400).json({ message: 'Invalid category ID format for product category' });
          }
          const categoryExists = await Category.findById(category);
          if (!categoryExists) {
            return res.status(404).json({ message: 'Category not found' });
          }
          updateData.category = new mongoose.Types.ObjectId(category);
        } else if (category === null || category === '') { // Allow unsetting the category by sending null or empty string
            updateData.category = null;
        }

        if (sku) {
            const existingProductBySku = await Product.findOne({ sku: sku, _id: { $ne: productObjectId } });
            if (existingProductBySku) {
                return res.status(409).json({ message: 'Another product with this SKU already exists.' });
            }
            updateData.sku = sku;
        }

        // Prevent empty object from being sent if no valid fields were in req.body (though schema validation on client should prevent this)
        if (Object.keys(updateData).length === 0 && !category && !sku) { // Check if only category/sku were potentially sent but were invalid/empty
             // This check might be too strict if only category or sku is being updated.
             // Let's assume client sends at least one valid field or form has validation.
             // If req.body itself is empty, findByIdAndUpdate with empty updateData does nothing.
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          productObjectId,
          { $set: updateData }, // Use $set to ensure only provided fields are updated
          { new: true, runValidators: true }
        ).populate('category', 'name slug');

        if (!updatedProduct) {
          return res.status(404).json({ message: 'Product not found for update' });
        }
        return res.status(200).json(updatedProduct);
      } catch (error) {
        if ((error as any).code === 11000 && (error as any).keyPattern?.sku) {
          return res.status(409).json({ message: 'A product with this SKU already exists.' });
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
