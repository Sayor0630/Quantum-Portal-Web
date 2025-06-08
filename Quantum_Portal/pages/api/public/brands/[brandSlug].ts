import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import Brand from '../../../../models/Brand';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { brandSlug } = req.query;

    if (!brandSlug || typeof brandSlug !== 'string') {
        return res.status(400).json({ message: 'Brand slug is required.' });
    }

    try {
        await connectToDatabase();

        // Find brand by slug and ensure it's active
        const brand = await Brand.findOne({ 
            slug: brandSlug, 
            isActive: true 
        })
        .select('name slug description logoUrl website isActive')
        .lean();

        if (!brand) {
            return res.status(404).json({ message: 'Brand not found or not available.' });
        }

        return res.status(200).json(brand);
    } catch (error) {
        console.error('[PUBLIC API] Error fetching brand by slug:', brandSlug, error);
        return res.status(500).json({ message: 'Error fetching brand details' });
    }
}
