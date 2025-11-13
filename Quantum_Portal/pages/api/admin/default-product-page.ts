import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/dbConnect';
import SiteConfig from '../../../models/SiteConfig';
import StaticPage from '../../../models/StaticPage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const config = await SiteConfig.findOne().populate('defaultProductPageId');
      
      res.status(200).json({
        success: true,
        defaultProductPageId: config?.defaultProductPageId || null,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { defaultProductPageId, defaultProductPageType } = req.body;

      // Validate that the page exists if provided
      if (defaultProductPageId) {
        let pageExists = false;
        
        if (defaultProductPageType === 'static') {
          pageExists = !!(await StaticPage.findById(defaultProductPageId));
        } else if (defaultProductPageType === 'dynamic') {
          const DynamicPage = require('../../../models/DynamicPage').default;
          pageExists = !!(await DynamicPage.findById(defaultProductPageId));
        }
        
        if (!pageExists) {
          return res.status(404).json({
            success: false,
            error: 'Selected page does not exist',
          });
        }
      }

      // Update or create site config with default product page
      const config = await SiteConfig.findOneAndUpdate(
        {},
        { 
          defaultProductPageId: defaultProductPageId || null,
          defaultProductPageType: defaultProductPageType || null
        },
        { new: true, upsert: true }
      );

      res.status(200).json({
        success: true,
        config,
        message: 'Default product page updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
