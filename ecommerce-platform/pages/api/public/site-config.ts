import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../lib/dbConnect';
import SiteConfig from '../../../models/SiteConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    await connectToDatabase();
    // Ensure this select matches the actual fields in your SiteConfig model for public display
    let config = await SiteConfig.findOne().select('siteName logoUrl faviconUrl themeSettings createdAt updatedAt').lean();

    if (!config) {
        // This default should align with what getDefaultProductPageLayout might imply for theme,
        // or what the SiteConfig model defaults to if created empty via API.
        // For a public API, providing a sensible default is good if no config is explicitly saved yet.
        config = {
            siteName: 'My E-commerce Store', // Default site name
            logoUrl: '/default_logo.png', // Path to a default logo in your /public folder
            faviconUrl: '/favicon.ico', // Path to a default favicon in your /public folder
            themeSettings: {
                lightMode: { primaryColor: '#228be6', accentColor: '#fa5252' }, // Example Mantine default blue and a red accent
                darkMode: { primaryColor: '#1A1B1E', accentColor: '#fa5252' }, // Example Mantine dark and red accent
            },
            // No _id, createdAt, updatedAt for this default plain object
        };
    }
    return res.status(200).json(config);
  } catch (error) {
    console.error('[PUBLIC API] Error fetching site config:', error);
    // Generic error for public to avoid leaking details
    return res.status(500).json({ message: 'Unable to retrieve site configuration at this time.' });
  }
}
