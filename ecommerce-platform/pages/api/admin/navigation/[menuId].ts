import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]'; // Path: ../../../auth/[...nextauth].ts
import connectToDatabase from '../../../../../lib/dbConnect'; // Path: ../../../../../lib/dbConnect
import NavigationMenu, { INavigationMenu } from '../../../../../models/NavigationMenu'; // Path: ../../../../../models/NavigationMenu
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { menuId } = req.query;

  if (!menuId || typeof menuId !== 'string' || !mongoose.Types.ObjectId.isValid(menuId)) {
     return res.status(400).json({ message: 'Invalid menu ID' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET': // Get a specific menu by ID
      try {
        const menu = await NavigationMenu.findById(menuId);
        if (!menu) {
          return res.status(404).json({ message: 'Navigation menu not found' });
        }
        return res.status(200).json(menu);
      } catch (error) {
        console.error(`Error fetching navigation menu ${menuId}:`, error);
        return res.status(500).json({ message: 'Error fetching navigation menu', error: (error as Error).message });
      }
    case 'PUT': // Update a specific menu (name and/or items)
      try {
        const { name, items } = req.body as Partial<INavigationMenu>;

        // Basic validation: if items are provided, they should be an array.
        if (items && !Array.isArray(items)) {
             return res.status(400).json({ message: 'Items must be an array.'});
        }
        // Ensure name is a string if provided
        if (name && typeof name !== 'string') {
            return res.status(400).json({ message: 'Name must be a string.' });
        }

        const updateData: Partial<INavigationMenu> = {};
        if (name !== undefined) updateData.name = name;
        if (items !== undefined) updateData.items = items;


        const updatedMenu = await NavigationMenu.findByIdAndUpdate(
          menuId,
          updateData,
          { new: true, runValidators: true }
        );
        if (!updatedMenu) {
          return res.status(404).json({ message: 'Navigation menu not found' });
        }
        return res.status(200).json(updatedMenu);
      } catch (error) {
         if ((error as any).code === 11000) { // Duplicate key error for 'name'
              return res.status(409).json({ message: 'A menu with this name already exists.' });
         }
         console.error(`Error updating navigation menu ${menuId}:`, error);
         return res.status(500).json({ message: 'Error updating navigation menu', error: (error as Error).message });
      }
    case 'DELETE': // Delete a menu
      try {
        const deletedMenu = await NavigationMenu.findByIdAndDelete(menuId);
        if (!deletedMenu) {
          return res.status(404).json({ message: 'Navigation menu not found' });
        }
        return res.status(200).json({ message: 'Navigation menu deleted successfully' });
      } catch (error) {
        console.error(`Error deleting navigation menu ${menuId}:`, error);
        return res.status(500).json({ message: 'Error deleting navigation menu', error: (error as Error).message });
      }
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
