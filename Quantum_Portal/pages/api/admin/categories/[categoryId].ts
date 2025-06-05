import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Category from '../../../../models/Category';
import Product from '../../../../models/Product';
import mongoose from 'mongoose';

const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { categoryId } = req.query;
  const categoryObjectId = new mongoose.Types.ObjectId(categoryId as string);


  if (!categoryId || typeof categoryId !== 'string' || !mongoose.Types.ObjectId.isValid(categoryId as string)) {
     return res.status(400).json({ message: 'Invalid category ID' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET': // Get a single category by ID
      try {
        const category = await Category.findById(categoryObjectId)
          .populate('parent', 'name slug')
          .populate('children', 'name slug'); // Populate direct children
        if (!category) {
          return res.status(404).json({ message: 'Category not found' });
        }
        return res.status(200).json(category);
      } catch (error) {
        console.error('Error fetching category:', error);
        return res.status(500).json({ message: 'Error fetching category', error: (error as Error).message });
      }

    case 'PUT': // Update a category
      try {
        let { name, slug, parent } = req.body; // parent is the ID of the new parent
        const currentCategory = await Category.findById(categoryObjectId);

        if (!currentCategory) {
          return res.status(404).json({ message: 'Category not found for update.' });
        }

        const updatePayload: Partial<typeof currentCategory> = {};

        if (name) updatePayload.name = name;
        if (name && !slug) {
          updatePayload.slug = generateSlug(name);
        } else if (slug) {
          updatePayload.slug = generateSlug(slug);
        }

        const oldParentId = currentCategory.parent ? currentCategory.parent.toString() : null;
        let newParentId = parent; // parent from req.body

        if (newParentId === '') newParentId = null; // Treat empty string as no parent

        if (newParentId !== undefined) { // If parent is part of the request body
            if (newParentId === categoryObjectId.toString()) {
                return res.status(400).json({ message: 'Category cannot be its own parent.' });
            }
            if (newParentId && !mongoose.Types.ObjectId.isValid(newParentId)) {
                return res.status(400).json({ message: 'Invalid new parent category ID format.' });
            }

            if (newParentId) {
                 const newParentCategoryDoc = await Category.findById(newParentId);
                 if (!newParentCategoryDoc) {
                    return res.status(404).json({ message: 'New parent category not found.' });
                 }
                 // Check for cyclical parenting: new parent cannot be a child of current category
                 const childrenIds = currentCategory.children.map((c: any) => c.toString());
                 if (childrenIds.includes(newParentId)) {
                     return res.status(400).json({ message: 'Cyclical parenting: New parent cannot be a child of this category.' });
                 }
                 updatePayload.parent = newParentCategoryDoc._id;
            } else { // newParentId is null (explicitly setting to no parent)
                 updatePayload.parent = null;
            }
        }


        // Update current category document
        Object.assign(currentCategory, updatePayload);
        const updatedCategoryDoc = await currentCategory.save();


        // Manage parent relationships
        const finalParentId = updatedCategoryDoc.parent ? updatedCategoryDoc.parent.toString() : null;

        if (oldParentId !== finalParentId) {
            // Remove from old parent's children array
            if (oldParentId) {
                await Category.updateOne({ _id: new mongoose.Types.ObjectId(oldParentId) }, { $pull: { children: categoryObjectId } });
            }
            // Add to new parent's children array
            if (finalParentId) {
                await Category.updateOne({ _id: new mongoose.Types.ObjectId(finalParentId) }, { $addToSet: { children: categoryObjectId } });
            }
        }

        return res.status(200).json(updatedCategoryDoc);
      } catch (error) {
        if ((error as any).code === 11000) {
          const field = Object.keys((error as any).keyPattern)[0];
          return res.status(409).json({ message: `A category with this ${field} already exists.` });
        }
        console.error('Error updating category:', error);
        return res.status(500).json({ message: 'Error updating category', error: (error as Error).message });
      }

    case 'DELETE': // Delete a category
      try {
        const categoryToDelete = await Category.findById(categoryObjectId);
        if (!categoryToDelete) {
          return res.status(404).json({ message: 'Category not found for deletion' });
        }

        if (categoryToDelete.children && categoryToDelete.children.length > 0) {
          return res.status(400).json({ message: 'Cannot delete category with child categories. Re-assign or delete children first.' });
        }

        // Update products that reference this category
        await Product.updateMany({ category: categoryObjectId }, { $unset: { category: "" } }); // Or set to a default/uncategorized

        // Remove from parent's children array
        if (categoryToDelete.parent) {
          await Category.updateOne({ _id: categoryToDelete.parent }, { $pull: { children: categoryObjectId } });
        }

        await Category.findByIdAndDelete(categoryObjectId);
        return res.status(200).json({ message: 'Category deleted successfully.' });
      } catch (error) {
        console.error('Error deleting category:', error);
        return res.status(500).json({ message: 'Error deleting category', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
