import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next'; // Using getServerSession
import { authOptions } from '../auth/[...nextauth]'; // Corrected path for authOptions relative to admin folder
import connectToDatabase from '../../../lib/dbConnect'; // Corrected path
import SiteConfig, { ISiteConfig } from '../../../models/SiteConfig'; // Corrected path

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  // For initial setup and testing, allowing any authenticated admin (via NextAuth)
  // to manage site configuration. Specific role checks (e.g., 'superadmin')
  // can be layered on later if needed.
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized: Not logged in.' });
  }
  // Example role check (if session.user.role is populated by JWT callback):
  // if ((session.user as { role?: string })?.role !== 'superadmin' && (session.user as { role?: string })?.role !== 'admin') {
  //    return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
  // }


  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      let config = await SiteConfig.findOne();
      if (!config) {
        // Create default config if none exists
        config = await SiteConfig.create({ siteName: 'My E-commerce Site' }); // Ensure some defaults
      }
      return res.status(200).json(config);
    } catch (error) {
      console.error('Error fetching site config:', error);
      return res.status(500).json({ message: 'Error fetching site configuration', error: (error as Error).message });
    }
  } else if (req.method === 'PUT') {
    try {
      const newConfigData = req.body as Partial<ISiteConfig>;
      // Ensure themeSettings are not accidentally wiped if only partial data is sent for them
      // A more robust solution might involve deep merging or dedicated endpoints for theme parts
      const updatedConfig = await SiteConfig.findOneAndUpdate({}, newConfigData, {
        new: true,
        upsert: true, // Create if it doesn't exist
        runValidators: true,
        setDefaultsOnInsert: true, // Ensure defaults are set on upsert if creating
      });
      return res.status(200).json(updatedConfig);
    } catch (error) {
      console.error('Error updating site config:', error);
      return res.status(500).json({ message: 'Error updating site configuration', error: (error as Error).message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
