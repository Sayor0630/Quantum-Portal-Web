import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import Category, { ICategory } from '../../../../models/Category'; // Import ICategory
import mongoose from 'mongoose';

// Recursive helper to filter unpublished children
const filterUnpublishedChildren = (categories: ICategory[]): ICategory[] => {
    return categories
        .filter(category => category.isPublished) // Filter current level
        .map(category => {
            if (category.children && category.children.length > 0) {
                // Assuming children are populated objects, not just IDs
                const publishedChildren = category.children.filter(child => (child as ICategory).isPublished);
                return { ...category, children: filterUnpublishedChildren(publishedChildren as ICategory[]) };
            }
            return category;
        });
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    await connectToDatabase();
    const { slug } = req.query;

    const query: any = {
        isPublished: true, // Filter by isPublished: true
    };

    if (slug && typeof slug === 'string') {
        query.slug = slug;
    }

    let result: ICategory | ICategory[] | null; // Define type for result

    if (slug) {
        const category = await Category.findOne(query)
            .populate<{ parent: ICategory | null }>('parent', 'name slug isPublished')
            .populate<{ children: ICategory[] }>({
                path: 'children',
                select: 'name slug description image parent isPublished', // Added isPublished
                match: { isPublished: true }, // Directly filter populated children
                populate: { // Example for 2nd level children, also filtered
                    path: 'children',
                    select: 'name slug description image parent isPublished',
                    match: { isPublished: true },
                }
            })
            .select('name slug description image parent children isPublished') // Added isPublished to main select
            .lean();

        if (!category) {
            return res.status(404).json({ message: 'Category not found or not available.' });
        }
        // If parent was fetched but is not published, we might want to nullify it or handle it
        if (category.parent && !(category.parent as ICategory).isPublished) {
            category.parent = null;
        }
        // The `match` in populate should handle filtering children, but double check if manual filter needed for deeper levels or specific cases
        // For instance, if children were populated without match and then filtered:
        // if (category.children) {
        //    category.children = filterUnpublishedChildren(category.children as ICategory[]);
        // }
        result = category;

    } else {
        // Fetch only root categories that are published, then expect client to fetch children if needed
        // or implement more complex aggregation for full tree of published items.
        // For a simpler public API, often only top-level or explicitly requested sub-trees are returned.
        query.parent = null; // Fetch only root categories for the main list

        const categories = await Category.find(query)
          // For root categories, populate their direct children that are also published
          .populate<{ children: ICategory[] }>({
             path: 'children',
             select: 'name slug image isPublished', // Select fields for children
             match: { isPublished: true } // Filter direct children
          })
          .sort({ name: 1 })
          .select('name slug description image children isPublished') // parent will be null for root categories
          .lean();

        // For each root category, ensure its children (if any) are filtered (populate match should do this)
        // result = categories.map(category => {
        //     if (category.children) {
        //         return { ...category, children: filterUnpublishedChildren(category.children as ICategory[]) };
        //     }
        //     return category;
        // });
        result = categories; // Populate with match is preferred
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[PUBLIC API] Error fetching categories:', error);
    return res.status(500).json({ message: 'Unable to retrieve categories.' });
  }
}
