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

    const { identifier } = req.query;

    if (!identifier || typeof identifier !== 'string') {
        return res.status(400).json({ message: 'Product identifier (ID, slug, or SKU) is required.' });
    }

    try {
        await connectToDatabase();
        let product;

        const publicFieldsToSelect = 'name description price sku images category tags customAttributes slug seoTitle seoDescription isPublished hasVariants attributeDefinitions variants stockQuantity';
        const categoryPopulation = { path: 'category', select: 'name slug isPublished' };


        // Always filter by isPublished: true for public queries
        const baseQueryConditions: any = { isPublished: true };

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            product = await Product.findOne({ ...baseQueryConditions, _id: identifier })
                .populate(categoryPopulation)
                .select(publicFieldsToSelect)
                .lean();
        }

        // If not found by ID (or if identifier wasn't an ID), try by slug
        if (!product) {
            product = await Product.findOne({ ...baseQueryConditions, slug: identifier })
                .populate(categoryPopulation)
                .select(publicFieldsToSelect)
                .lean();
        }

        // If still not found by slug, try by SKU as a final fallback
        if (!product) {
            product = await Product.findOne({ ...baseQueryConditions, sku: identifier })
                .populate(categoryPopulation)
                .select(publicFieldsToSelect)
                .lean();
        }

        if (!product) {
            return res.status(404).json({ message: 'Product not found or not available.' });
        }

        // Further filter: if product has a category, that category must also be published
        if (product.category && typeof product.category === 'object' && !(product.category as any).isPublished) {
            // Product's category is not published, so treat product as not found/available
            return res.status(404).json({ message: 'Product not found or its category is not available.' });
        }

        return res.status(200).json(product);
    } catch (error) {
        console.error('[PUBLIC API] Error fetching product by identifier:', identifier, error);
        return res.status(500).json({ message: 'Error fetching product details' });
    }
}
