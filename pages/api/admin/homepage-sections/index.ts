import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import HomepageSection from '../../../../models/HomepageSection';
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

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const sections = await HomepageSection.find({}).sort({ order: 'asc' }); // Default sort by order
        return res.status(200).json(sections);
      } catch (error) {
        console.error('Error fetching homepage sections:', error);
        return res.status(500).json({ message: 'Error fetching homepage sections', error: (error as Error).message });
      }

    case 'POST': // Create a new homepage section
      try {
        const { name, type, order, isVisible, content } = req.body;
        if (!name || !type) {
          return res.status(400).json({ message: 'Section name and type are required.' });
        }
        const allowedTypes = ['hero', 'banner', 'productCarousel', 'categoryList', 'promotionalBlock', 'customHtml', 'featuredProducts'];
        if (!allowedTypes.includes(type)) {
          return res.status(400).json({ message: `Invalid section type. Allowed types: ${allowedTypes.join(', ')}` });
        }

        // Basic validation for content based on type (can be expanded)
        if (type === 'productCarousel' || type === 'categoryList' || type === 'featuredProducts') {
            if (content?.items && !Array.isArray(content.items)) {
                return res.status(400).json({ message: 'Items must be an array for this section type.'});
            }
        }
        if (type === 'hero' || type === 'banner' || type === 'promotionalBlock') {
            if (!content?.imageUrl && !content?.title && !content?.text && !content?.htmlContent) {
                // return res.status(400).json({ message: 'Content for this section type seems insufficient.' });
                // Loosening this for flexibility, frontend can manage content requirements
            }
        }


        const newSection = await HomepageSection.create({
            name: String(name).trim(),
            type,
            order: Number(order) || 0,
            isVisible: isVisible === undefined ? true : !!isVisible,
            content: content || {}
        });
        return res.status(201).json(newSection);
      } catch (error) {
        console.error('Error creating homepage section:', error);
        return res.status(500).json({ message: 'Error creating homepage section', error: (error as Error).message });
      }

    case 'PUT': // For reordering all sections
      try {
         const sectionsUpdate = req.body as Array<{ _id: string, order: number }>;
         if (!Array.isArray(sectionsUpdate)) {
             return res.status(400).json({ message: 'Invalid data format for reordering. Expected an array of sections with _id and order.' });
         }

         const bulkOps = sectionsUpdate.map(section => {
            if (!section._id || !mongoose.Types.ObjectId.isValid(section._id) || typeof section.order !== 'number') {
                // Basic validation for each item in the array
                // Consider throwing an error or filtering out invalid items
                console.warn('Invalid item in sections reorder payload:', section);
                return null;
            }
            return {
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(section._id) },
                    update: { $set: { order: section.order } }
                }
            };
         }).filter(op => op !== null); // Remove any null operations from invalid items

         if (bulkOps.length > 0) {
             await HomepageSection.bulkWrite(bulkOps as any); // Cast if filter(op => op !== null) is not enough for TS
         }
         return res.status(200).json({ message: 'Homepage sections order updated successfully.' });

      } catch (error) {
         console.error('Error reordering homepage sections:', error);
         return res.status(500).json({ message: 'Error reordering homepage sections', error: (error as Error).message });
      }


    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
