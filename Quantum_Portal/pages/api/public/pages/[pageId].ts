import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import StaticPage from '../../../../models/StaticPage';
import DynamicPage from '../../../../models/DynamicPage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const { pageId } = req.query;

  if (req.method === 'GET') {
    try {
      // Try to find in StaticPage first
      let page = await StaticPage.findById(pageId).lean();
      let pageType = 'static';
      
      // If not found, try DynamicPage
      if (!page) {
        page = await DynamicPage.findById(pageId).lean();
        pageType = 'dynamic';
      }

      if (!page) {
        return res.status(404).json({
          success: false,
          error: 'Page not found',
        });
      }

      res.status(200).json({
        success: true,
        pageType,
        ...page,
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
