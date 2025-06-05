import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../../lib/dbConnect';
import NavigationMenu from '../../../../../models/NavigationMenu';
import mongoose from 'mongoose';

// Recursive function to select only public fields from menu items
const sanitizeMenuItems = (items: any[]): any[] => {
    return items.map(item => {
        const sanitizedItem: any = {
            // _id: item._id, // Client might not need _id for rendering, but could be useful for keys if no clientId
            title: item.title,
            url: item.url,
            order: item.order,
            // No clientId or parentId exposed publicly
        };
        if (item.children && item.children.length > 0) {
            sanitizedItem.children = sanitizeMenuItems(item.children);
        } else {
            sanitizedItem.children = []; // Ensure children is always an array
        }
        return sanitizedItem;
    });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  const { menuIdentifier } = req.query;
  if (!menuIdentifier || typeof menuIdentifier !== 'string') {
    return res.status(400).json({ message: 'Menu identifier (name or ID) is required.' });
  }
  try {
    await connectToDatabase();

    const query = mongoose.Types.ObjectId.isValid(menuIdentifier)
        ? { _id: menuIdentifier }
        : { name: menuIdentifier };

    // Select only 'name' and 'items'. Items will be further processed.
    const menu = await NavigationMenu.findOne(query).select('name items').lean();

    if (!menu) {
        return res.status(404).json({ message: 'Navigation menu not found.' });
    }

    // Sanitize items to only include public fields and structure
    const publicItems = menu.items ? sanitizeMenuItems(menu.items) : [];

    return res.status(200).json({
        _id: menu._id, // Expose menu _id
        name: menu.name,
        items: publicItems,
    });
  } catch (error) {
    console.error(`[PUBLIC API] Error fetching navigation menu "${menuIdentifier}":`, error);
    return res.status(500).json({ message: 'Unable to retrieve navigation menu.' });
  }
}
