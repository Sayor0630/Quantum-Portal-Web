import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../../lib/dbConnect';
import DynamicPage from '../../../../models/DynamicPage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ message: 'Invalid slug parameter.' });
  }

  await dbConnect();

  try {
    const page = await DynamicPage.findOne({ slug, isPublished: true })
      .populate('segments.blocks.content.categoryIds', 'name slug imageUrl')
      .populate('segments.blocks.content.brandIds', 'name slug logoUrl');

    if (!page) {
      return res.status(404).json({ message: 'Page not found.' });
    }

    // Increment view count
    await DynamicPage.findByIdAndUpdate(page._id, { $inc: { viewCount: 1 } });

    // Filter only visible segments and blocks
    const filteredSegments = page.segments
      .filter((segment) => segment.isVisible)
      .map((segment) => ({
        ...segment,
        blocks: segment.blocks.filter((block) => block.visibility?.showOnDesktop !== false),
      }));

    const response = {
      ...page.toObject(),
      segments: filteredSegments,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching dynamic page:', error);
    return res.status(500).json({ message: 'Failed to fetch page.', error: error.message });
  }
}
