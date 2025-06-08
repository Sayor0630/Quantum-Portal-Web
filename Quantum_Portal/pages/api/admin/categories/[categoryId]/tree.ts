import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import Category from '../../../../../models/Category';
import mongoose from 'mongoose';

interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  level: number;
  path: string[];
  children: CategoryTreeNode[];
  productCount?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { categoryId } = req.query;
    const includeProductCounts = req.query.includeProductCounts === 'true';

    if (!mongoose.Types.ObjectId.isValid(categoryId as string)) {
      return res.status(400).json({ message: 'Invalid category ID format' });
    }

    // Check if the category exists
    const rootCategory = await Category.findById(categoryId).lean();
    if (!rootCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Build the complete tree starting from this category
    const buildCategoryTree = async (
      parentId: string, 
      level: number = 0, 
      path: string[] = []
    ): Promise<CategoryTreeNode[]> => {
      const children = await Category.find({ parent: parentId }).lean();
      const tree: CategoryTreeNode[] = [];

      for (const child of children) {
        const childPath = [...path, child.name];
        const childNode: CategoryTreeNode = {
          _id: child._id.toString(),
          name: child.name,
          slug: child.slug,
          level,
          path: childPath,
          children: await buildCategoryTree(child._id.toString(), level + 1, childPath)
        };

        if (includeProductCounts) {
          // Get product count for this specific category (not including subcategories)
          const Product = (await import('../../../../../models/Product')).default;
          childNode.productCount = await Product.countDocuments({ category: child._id });
        }

        tree.push(childNode);
      }

      return tree;
    };

    // Build tree starting from the root category
    const categoryTree: CategoryTreeNode = {
      _id: rootCategory._id.toString(),
      name: rootCategory.name,
      slug: rootCategory.slug,
      level: 0,
      path: [rootCategory.name],
      children: await buildCategoryTree(categoryId as string, 1, [rootCategory.name])
    };

    if (includeProductCounts) {
      const Product = (await import('../../../../../models/Product')).default;
      categoryTree.productCount = await Product.countDocuments({ category: rootCategory._id });
    }

    // Also return a flattened list for easier UI rendering
    const flattenTree = (node: CategoryTreeNode, result: CategoryTreeNode[] = []): CategoryTreeNode[] => {
      result.push({
        ...node,
        children: [] // Don't include children in flattened version
      });
      
      node.children.forEach(child => flattenTree(child, result));
      return result;
    };

    const flattenedTree = flattenTree(categoryTree);

    return res.status(200).json({
      tree: categoryTree,
      flattened: flattenedTree,
      totalCategories: flattenedTree.length
    });

  } catch (error) {
    console.error('Error fetching category tree:', error);
    return res.status(500).json({ 
      message: 'Error fetching category tree', 
      error: (error as Error).message 
    });
  }
}
