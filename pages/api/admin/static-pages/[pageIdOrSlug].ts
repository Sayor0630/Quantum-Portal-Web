import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import StaticPage from '../../../../../models/StaticPage';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { pageIdOrSlug } = req.query;

  if (!pageIdOrSlug || typeof pageIdOrSlug !== 'string') {
     return res.status(400).json({ message: 'Page ID or Slug is required' });
  }

  await connectToDatabase();

  let pageQuery: any;
  if (mongoose.Types.ObjectId.isValid(pageIdOrSlug)) {
    pageQuery = { _id: new mongoose.Types.ObjectId(pageIdOrSlug) };
  } else {
    pageQuery = { slug: pageIdOrSlug };
  }

  switch (req.method) {
    case 'GET':
      try {
        const page = await StaticPage.findOne(pageQuery);
        if (!page) {
          return res.status(404).json({ message: 'Static page not found' });
        }
        return res.status(200).json(page);
      } catch (error) {
        console.error(`Error fetching static page ${pageIdOrSlug}:`, error);
        return res.status(500).json({ message: 'Error fetching static page', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const pageToUpdate = await StaticPage.findOne(pageQuery);
        if (!pageToUpdate) {
          return res.status(404).json({ message: 'Static page not found for update' });
        }

        const { title, slug, content, isPublished, seoTitle, seoDescription } = req.body;

        // Update fields if they are provided in the request body
        if (title !== undefined) pageToUpdate.title = String(title).trim();
        if (slug !== undefined) pageToUpdate.slug = String(slug).trim(); // Model hook will clean/generate
        if (content !== undefined) pageToUpdate.content = String(content).trim();
        if (isPublished !== undefined) pageToUpdate.isPublished = !!isPublished;
        if (seoTitle !== undefined) pageToUpdate.seoTitle = String(seoTitle).trim();
        if (seoDescription !== undefined) pageToUpdate.seoDescription = String(seoDescription).trim();

        // If slug is being changed, ensure it's unique among other documents
        if (slug !== undefined && slug !== pageToUpdate.slug && pageToUpdate.isModified('slug')) {
          const cleanedSlug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
          const existingPageWithSlug = await StaticPage.findOne({ slug: cleanedSlug, _id: { $ne: pageToUpdate._id } });
          if (existingPageWithSlug) {
            return res.status(409).json({ message: `Another static page with the slug '${cleanedSlug}' already exists.` });
          }
          pageToUpdate.slug = cleanedSlug; // Assign cleaned slug
        } else if (pageToUpdate.isModified('title') && !pageToUpdate.isModified('slug')) {
          // If title changed and slug didn't, the pre-validate hook might regenerate slug based on new title
          // So, we let the hook handle it by not explicitly setting pageToUpdate.slug here unless slug was in req.body
        }


        const updatedPage = await pageToUpdate.save();
        return res.status(200).json(updatedPage);

      } catch (error) {
        // Check for MongoDB duplicate key error specifically for the slug
        if ((error as any).code === 11000 && (error as any).keyPattern?.slug) {
          // Extract slug value that caused the error if possible (may not be straightforward from error object alone)
          return res.status(409).json({ message: 'A static page with this slug already exists.' });
        }
        console.error(`Error updating static page ${pageIdOrSlug}:`, error);
        return res.status(500).json({ message: 'Error updating static page', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const pageToDelete = await StaticPage.findOneAndDelete(pageQuery); // findOneAndDelete handles finding and deleting
        if (!pageToDelete) {
          return res.status(404).json({ message: 'Static page not found for deletion' });
        }
        return res.status(200).json({ message: 'Static page deleted successfully' });
      } catch (error) {
        console.error(`Error deleting static page ${pageIdOrSlug}:`, error);
        return res.status(500).json({ message: 'Error deleting static page', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
