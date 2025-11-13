import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import StaticPage from '../../../../models/StaticPage';
import DynamicPage from '../../../../models/DynamicPage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      // Fetch both static and dynamic pages
      const [staticPages, dynamicPages] = await Promise.all([
        StaticPage.find().sort({ createdAt: -1 }).lean(),
        DynamicPage.find().sort({ createdAt: -1 }).lean()
      ]);
      
      // Format static pages with type indicator
      const formattedStaticPages = staticPages.map((page: any) => ({
        _id: page._id,
        title: page.title,
        slug: page.slug,
        pageType: 'static',
        displayLabel: `${page.title} (Static)`
      }));
      
      // Format dynamic pages with type indicator
      const formattedDynamicPages = dynamicPages.map((page: any) => ({
        _id: page._id,
        title: page.title,
        slug: page.slug,
        pageType: 'dynamic',
        displayLabel: `${page.title} (Dynamic)`
      }));
      
      // Combine both types
      const allPages = [...formattedStaticPages, ...formattedDynamicPages];
      
      res.status(200).json({
        success: true,
        pages: allPages,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
