import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // This path is correct: pages/api/admin/navigation -> pages/api/auth/
import connectToDatabase from '../../../../lib/dbConnect';
import NavigationMenu, { INavigationMenu } from '../../../../models/NavigationMenu';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET': // List all navigation menus
      try {
        const menus = await NavigationMenu.find({});
        return res.status(200).json(menus);
      } catch (error) {
        console.error('Error fetching navigation menus:', error);
        return res.status(500).json({ message: 'Error fetching navigation menus', error: (error as Error).message });
      }
    case 'POST': // Create a new navigation menu
      try {
        const { name, items } = req.body as Partial<INavigationMenu>;
        if (!name) {
          return res.status(400).json({ message: 'Menu name is required' });
        }
        // Ensure items is an array if provided, otherwise default to empty array
        const menuItems = Array.isArray(items) ? items : [];

        const newMenu = await NavigationMenu.create({ name, items: menuItems });
        return res.status(201).json(newMenu);
      } catch (error) {
         if ((error as any).code === 11000) { // Duplicate key error for 'name'
              return res.status(409).json({ message: 'A menu with this name already exists.' });
         }
         console.error('Error creating navigation menu:', error);
         return res.status(500).json({ message: 'Error creating navigation menu', error: (error as Error).message });
      }
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
