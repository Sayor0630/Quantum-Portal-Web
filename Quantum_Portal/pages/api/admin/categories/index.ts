import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Category from '../../../../models/Category';
import Product from '../../../../models/Product';
import mongoose from 'mongoose';

// Helper function to generate a slug (ensure this matches model's version if shared)
const generateSlugFromName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const categories = await Category.find({})
          .populate('parent', 'name slug')
          .sort({ name: 1 });
        return res.status(200).json(categories);
      } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ message: 'Error fetching categories', error: (error as Error).message });
      }

    case 'POST':
      try {
        let { name, slug, parent, isPublished } = req.body; // Added isPublished

        if (!name) {
          return res.status(400).json({ message: 'Category name is required' });
        }

        // Slug generation/cleaning logic (model pre-save hook will also run)
        if (!slug) {
          slug = generateSlugFromName(name);
        } else {
          slug = generateSlugFromName(slug);
        }
        if (!slug) { // If name was empty and generated an empty slug
            return res.status(400).json({ message: 'Slug could not be generated. Name is likely empty.' });
        }


        if (parent === '') parent = null;

        let parentCategoryId: mongoose.Types.ObjectId | null = null;
        if (parent) {
          if (!mongoose.Types.ObjectId.isValid(parent)) {
            return res.status(400).json({ message: 'Invalid parent category ID' });
          }
          const parentCategoryDoc = await Category.findById(parent);
          if (!parentCategoryDoc) {
            return res.status(404).json({ message: 'Parent category not found' });
          }
          parentCategoryId = parentCategoryDoc._id as mongoose.Types.ObjectId;
        }

        const newCategory = new Category({
            name,
            slug,
            parent: parentCategoryId,
            isPublished: isPublished !== undefined ? isPublished : false, // Default to false
        });
        await newCategory.save();

        if (parentCategoryId) {
          await Category.updateOne(
            { _id: parentCategoryId },
            { $addToSet: { children: newCategory._id } }
          );
        }

        return res.status(201).json(newCategory);
      } catch (error) {
        if ((error as any).code === 11000) {
          const field = Object.keys((error as any).keyPattern)[0];
          return res.status(409).json({ message: `A category with this ${field} already exists.` });
        }
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        console.error('Error creating category:', error);
        return res.status(500).json({ message: 'Error creating category', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
