import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import DynamicPage from '../../../../models/DynamicPage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  await dbConnect();

  if (req.method === 'GET') {
    // List/Search Dynamic Pages with pagination
    try {
      const { page = '1', limit = '10', search = '', pageType = '' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      let query: any = {};
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
      
      if (pageType && pageType !== 'all') {
        query.pageType = pageType;
      }

      const totalItems = await DynamicPage.countDocuments(query);
      const totalPages = Math.ceil(totalItems / limitNum);

      const pages = await DynamicPage.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('title slug pageType isPublished updatedAt viewCount segments')
        .lean();

      // Add segment count to response
      const pagesWithCount = pages.map(page => ({
        ...page,
        segmentCount: page.segments?.length || 0,
      }));

      return res.status(200).json({
        pages: pagesWithCount,
        currentPage: pageNum,
        totalPages,
        totalItems,
      });
    } catch (error: any) {
      console.error('Error fetching dynamic pages:', error);
      return res.status(500).json({ message: 'Failed to fetch dynamic pages.', error: error.message });
    }
  }

  if (req.method === 'POST') {
    // Create new Dynamic Page
    try {
      const pageData = req.body;
      
      console.log('=== CREATING NEW DYNAMIC PAGE ===');
      console.log('Title:', pageData.title);
      console.log('Slug:', pageData.slug);
      console.log('Has gridCells:', !!pageData.gridCells);
      console.log('gridCells count:', pageData.gridCells?.length || 0);
      console.log('Has segments:', !!pageData.segments);
      console.log('segments count:', pageData.segments?.length || 0);
      
      // Set creator
      pageData.createdBy = (session.user as any).id;
      pageData.updatedBy = (session.user as any).id;
      
      // Validate required fields
      if (!pageData.title) {
        return res.status(400).json({ message: 'Title is required.' });
      }
      
      // Check for duplicate slug
      if (pageData.slug) {
        const existingPage = await DynamicPage.findOne({ slug: pageData.slug });
        if (existingPage) {
          return res.status(400).json({ message: 'A page with this slug already exists.' });
        }
      }

      const newPage = await DynamicPage.create(pageData);
      
      // Log what was actually saved
      console.log('=== SAVED PAGE DATA ===');
      console.log('Saved gridCells:', newPage.gridCells?.length || 0);
      console.log('Saved segments:', newPage.segments?.length || 0);
      
      // Return with debug info
      return res.status(201).json({
        ...newPage.toObject(),
        _debug: {
          hasGridCells: !!newPage.gridCells && newPage.gridCells.length > 0,
          gridCellsCount: newPage.gridCells?.length || 0,
          hasSegments: !!newPage.segments && newPage.segments.length > 0,
          segmentsCount: newPage.segments?.length || 0,
        }
      });
    } catch (error: any) {
      console.error('Error creating dynamic page:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'A page with this slug already exists.' });
      }
      return res.status(500).json({ message: 'Failed to create dynamic page.', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed.' });
}
