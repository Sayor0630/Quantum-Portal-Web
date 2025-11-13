import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import DynamicPage from '../../../../models/DynamicPage';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid page ID.' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid page ID format.' });
  }

  await dbConnect();

  if (req.method === 'GET') {
    // Get single Dynamic Page
    try {
      const page = await DynamicPage.findById(id)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');
      
      if (!page) {
        return res.status(404).json({ message: 'Dynamic page not found.' });
      }

      return res.status(200).json(page);
    } catch (error: any) {
      console.error('Error fetching dynamic page:', error);
      return res.status(500).json({ message: 'Failed to fetch dynamic page.', error: error.message });
    }
  }

  if (req.method === 'PUT') {
    // Update Dynamic Page
    try {
      const updateData = req.body;
      
      console.log('=== UPDATING DYNAMIC PAGE ===');
      console.log('Page ID:', id);
      console.log('Has gridCells:', !!updateData.gridCells);
      console.log('gridCells count:', updateData.gridCells?.length || 0);
      console.log('Has segments:', !!updateData.segments);
      console.log('segments count:', updateData.segments?.length || 0);
      
      // Set updater
      updateData.updatedBy = (session.user as any).id;
      
      // If slug is being changed, check for duplicates
      if (updateData.slug) {
        const existingPage = await DynamicPage.findOne({ 
          slug: updateData.slug,
          _id: { $ne: id }
        });
        if (existingPage) {
          return res.status(400).json({ message: 'A page with this slug already exists.' });
        }
      }

      const updatedPage = await DynamicPage.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedPage) {
        return res.status(404).json({ message: 'Dynamic page not found.' });
      }

      // Log what was actually saved
      console.log('=== SAVED PAGE DATA ===');
      console.log('Saved gridCells:', updatedPage.gridCells?.length || 0);
      console.log('Saved segments:', updatedPage.segments?.length || 0);

      // Return with debug info
      return res.status(200).json({
        ...updatedPage.toObject(),
        _debug: {
          hasGridCells: !!updatedPage.gridCells && updatedPage.gridCells.length > 0,
          gridCellsCount: updatedPage.gridCells?.length || 0,
          hasSegments: !!updatedPage.segments && updatedPage.segments.length > 0,
          segmentsCount: updatedPage.segments?.length || 0,
        }
      });
    } catch (error: any) {
      console.error('Error updating dynamic page:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'A page with this slug already exists.' });
      }
      return res.status(500).json({ message: 'Failed to update dynamic page.', error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    // Delete Dynamic Page
    try {
      const deletedPage = await DynamicPage.findByIdAndDelete(id);

      if (!deletedPage) {
        return res.status(404).json({ message: 'Dynamic page not found.' });
      }

      return res.status(200).json({ message: 'Dynamic page deleted successfully.', page: deletedPage });
    } catch (error: any) {
      console.error('Error deleting dynamic page:', error);
      return res.status(500).json({ message: 'Failed to delete dynamic page.', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed.' });
}
