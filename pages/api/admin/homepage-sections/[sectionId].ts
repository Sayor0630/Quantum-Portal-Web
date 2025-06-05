import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import HomepageSection from '../../../../../models/HomepageSection';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Role check for admin/editor roles
  // if (!['admin', 'superadmin', 'editor'].includes((session.user as any)?.role)) {
  //   return res.status(403).json({ message: 'Forbidden' });
  // }

  const { sectionId } = req.query;

  if (!sectionId || typeof sectionId !== 'string' || !mongoose.Types.ObjectId.isValid(sectionId)) {
     return res.status(400).json({ message: 'Invalid section ID' });
  }
  const sectionObjectId = new mongoose.Types.ObjectId(sectionId as string);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const section = await HomepageSection.findById(sectionObjectId);
        if (!section) {
          return res.status(404).json({ message: 'Homepage section not found' });
        }
        return res.status(200).json(section);
      } catch (error) {
        console.error(`Error fetching homepage section ${sectionId}:`, error);
        return res.status(500).json({ message: 'Error fetching homepage section', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const sectionToUpdate = await HomepageSection.findById(sectionObjectId);
        if (!sectionToUpdate) {
            return res.status(404).json({ message: 'Homepage section not found for update' });
        }

        const { name, type, order, isVisible, content } = req.body;

        let changed = false;

        if (name !== undefined && sectionToUpdate.name !== String(name).trim()) {
            sectionToUpdate.name = String(name).trim();
            changed = true;
        }
        if (type !== undefined) {
          const allowedTypes = ['hero', 'banner', 'productCarousel', 'categoryList', 'promotionalBlock', 'customHtml', 'featuredProducts'];
          if (!allowedTypes.includes(type)) {
            return res.status(400).json({ message: `Invalid section type. Allowed types: ${allowedTypes.join(', ')}` });
          }
          if (sectionToUpdate.type !== type) {
            sectionToUpdate.type = type;
            changed = true;
          }
        }
        if (order !== undefined && typeof order === 'number' && sectionToUpdate.order !== order) {
            sectionToUpdate.order = order;
            changed = true;
        }
        if (isVisible !== undefined && typeof isVisible === 'boolean' && sectionToUpdate.isVisible !== isVisible) {
            sectionToUpdate.isVisible = isVisible;
            changed = true;
        }
        if (content !== undefined) { // For content, even if same object, consider it a change for simplicity unless deep compare
            sectionToUpdate.content = content; // Full content object replace
            changed = true;
        }

        if (!changed && req.body && Object.keys(req.body).length > 0) {
            return res.status(200).json(sectionToUpdate); // No actual change, return current
        }


        const updatedSection = await sectionToUpdate.save();
        return res.status(200).json(updatedSection);
      } catch (error) {
        console.error(`Error updating homepage section ${sectionId}:`, error);
        return res.status(500).json({ message: 'Error updating homepage section', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const deletedSection = await HomepageSection.findByIdAndDelete(sectionObjectId);
        if (!deletedSection) {
          return res.status(404).json({ message: 'Homepage section not found for deletion' });
        }
        return res.status(200).json({ message: 'Homepage section deleted successfully' });
      } catch (error) {
        console.error(`Error deleting homepage section ${sectionId}:`, error);
        return res.status(500).json({ message: 'Error deleting homepage section', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
