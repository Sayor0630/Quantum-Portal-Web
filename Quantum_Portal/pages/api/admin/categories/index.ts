import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Category from '../../../../models/Category';
import Product from '../../../../models/Product'; // To handle products on category deletion later if needed
import mongoose from 'mongoose';

// Helper function to generate a slug
const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET': // List all categories
      try {
        const categories = await Category.find({})
          .populate('parent', 'name slug')
          // Not populating children here to avoid overly complex/large responses by default
          // Frontend can make subsequent calls for children if needed for a specific category
          .sort({ name: 1 });
        return res.status(200).json(categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ message: 'Error fetching categories', error: (error as Error).message });
      }

    case 'POST': // Create a new category
      try {
        let { name, slug, parent } = req.body;

        if (!name) {
          return res.status(400).json({ message: 'Category name is required' });
        }
        if (!slug) {
          slug = generateSlug(name);
        } else {
          slug = generateSlug(slug); // Ensure slug is clean
        }

        if (parent === '') parent = null; // Treat empty string as no parent

        let parentCategoryId = null;
        if (parent) {
          if (!mongoose.Types.ObjectId.isValid(parent)) {
            return res.status(400).json({ message: 'Invalid parent category ID' });
          }
          const parentCategoryDoc = await Category.findById(parent);
          if (!parentCategoryDoc) {
            return res.status(404).json({ message: 'Parent category not found' });
          }
          parentCategoryId = parentCategoryDoc._id;
        }

        const newCategory = new Category({ name, slug, parent: parentCategoryId });
        await newCategory.save();

        // If a parent exists, add this new category to its children array
        if (parentCategoryId) {
          await Category.updateOne(
            { _id: parentCategoryId },
            { $addToSet: { children: newCategory._id } } // Use $addToSet to avoid duplicates
          );
        }

        return res.status(201).json(newCategory);
      } catch (error) {
        if ((error as any).code === 11000) { // Duplicate key error for name or slug
          const field = Object.keys((error as any).keyPattern)[0];
          return res.status(409).json({ message: `A category with this ${field} already exists.` });
        }
        console.error('Error creating category:', error);
        return res.status(500).json({ message: 'Error creating category', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
