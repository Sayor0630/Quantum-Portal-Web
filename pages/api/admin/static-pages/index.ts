import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import StaticPage from '../../../../models/StaticPage';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const pageQuery = parseInt(req.query.page as string) || 1; // Renamed to avoid conflict with 'pages' variable
        const limit = parseInt(req.query.limit as string) || 10;

        const staticPages = await StaticPage.find({})
          .sort({ createdAt: -1 })
          .skip((pageQuery - 1) * limit)
          .limit(limit);

        const totalItems = await StaticPage.countDocuments({}); // Renamed for clarity
        const totalPages = Math.ceil(totalItems / limit);

        return res.status(200).json({
             pages: staticPages, // Keep 'pages' for the array of documents
             currentPage: pageQuery,
             totalPages,
             totalItems
         });
      } catch (error) {
        console.error('Error fetching static pages:', error);
        return res.status(500).json({ message: 'Error fetching static pages', error: (error as Error).message });
      }

    case 'POST':
      try {
        const { title, slug, content, isPublished, seoTitle, seoDescription } = req.body;
        if (!title) {
          return res.status(400).json({ message: 'Title is required.' });
        }
        // Slug will be auto-generated or cleaned by pre-validate hook in the model

        const newPage = await StaticPage.create({
            title: String(title).trim(),
            slug: slug ? String(slug).trim() : undefined, // Let hook handle if slug is empty/undefined
            content: content ? String(content).trim() : undefined,
            isPublished: !!isPublished, // Ensure boolean
            seoTitle: seoTitle ? String(seoTitle).trim() : undefined,
            seoDescription: seoDescription ? String(seoDescription).trim() : undefined
        });
        return res.status(201).json(newPage);
      } catch (error) {
        if ((error as any).code === 11000 && (error as any).keyPattern?.slug) {
          return res.status(409).json({ message: 'A static page with this slug already exists.' });
        }
        console.error('Error creating static page:', error);
        return res.status(500).json({ message: 'Error creating static page', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
