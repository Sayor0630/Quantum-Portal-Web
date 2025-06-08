import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import Product from '../../../../models/Product';
import mongoose from 'mongoose';

interface StockUpdateItem {
  productId: string;
  variantId?: string;
  stockQuantity: number;
  price?: number;
  sku?: string;
}

interface BulkStockUpdateRequest {
  updates: StockUpdateItem[];
}

interface UpdateResult {
  productId: string;
  variantId?: string;
  success: boolean;
}

interface UpdateError {
  productId: string;
  variantId?: string;
  error: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    await connectToDatabase();

    const { updates }: BulkStockUpdateRequest = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Updates array is required and must not be empty' });
    }

    const results: UpdateResult[] = [];
    const errors: UpdateError[] = [];

    // Process each update
    for (const update of updates) {
      try {
        const { productId, variantId, stockQuantity, price, sku } = update;

        // Validate input data
        if (stockQuantity !== undefined && (typeof stockQuantity !== 'number' || stockQuantity < 0)) {
          errors.push({ productId, variantId, error: 'Stock quantity must be a non-negative number' });
          continue;
        }

        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
          errors.push({ productId, variantId, error: 'Price must be a non-negative number' });
          continue;
        }

        // Validate productId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          errors.push({ productId, error: 'Invalid product ID' });
          continue;
        }

        const product = await Product.findById(productId);
        if (!product) {
          errors.push({ productId, error: 'Product not found' });
          continue;
        }

        if (variantId) {
          // Update specific variant
          const variantIndex = product.variants.findIndex(
            (v: any) => v._id?.toString() === variantId
          );

          if (variantIndex === -1) {
            errors.push({ productId, variantId, error: 'Variant not found' });
            continue;
          }

          // Update variant fields
          if (stockQuantity !== undefined) {
            product.variants[variantIndex].stockQuantity = stockQuantity;
          }
          if (price !== undefined) {
            product.variants[variantIndex].price = price;
          }
          if (sku !== undefined) {
            product.variants[variantIndex].sku = sku;
          }

          // Recalculate total stock for variant products
          product.stockQuantity = product.variants
            .filter((v: any) => v.isActive)
            .reduce((total: number, v: any) => total + v.stockQuantity, 0);

        } else {
          // Update base product (for simple products)
          if (stockQuantity !== undefined) {
            product.stockQuantity = stockQuantity;
          }
          if (price !== undefined) {
            product.price = price;
          }
          if (sku !== undefined) {
            product.sku = sku;
          }
        }

        await product.save();
        results.push({ productId, variantId, success: true });

      } catch (error: any) {
        errors.push({ 
          productId: update.productId, 
          variantId: update.variantId,
          error: error.message || 'Unknown error occurred during update'
        });
      }
    }

    return res.status(200).json({
      message: 'Bulk update completed',
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('[BULK STOCK UPDATE] Error:', error);
    return res.status(500).json({ 
      message: 'Internal server error during bulk update' 
    });
  }
}
