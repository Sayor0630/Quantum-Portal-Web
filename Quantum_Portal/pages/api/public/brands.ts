import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../lib/dbConnect';
import Brand from '../../../models/Brand';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        await connectToDatabase();

        const {
            limit = '50',
            page = '1',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const sortParams: any = {};
        if (typeof sortBy === 'string' && typeof sortOrder === 'string') {
            sortParams[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            sortParams['name'] = 1; // Default sort by name ascending
        }

        // Only return active brands
        const query = { isActive: true };

        const brands = await Brand.find(query)
            .select('name slug description logoUrl website isActive')
            .sort(sortParams)
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .lean();

        const totalBrands = await Brand.countDocuments(query);

        return res.status(200).json({
            brands,
            currentPage: pageNum,
            totalPages: Math.ceil(totalBrands / limitNum),
            totalItems: totalBrands,
        });
    } catch (error) {
        console.error('[PUBLIC API] Error fetching brands:', error);
        return res.status(500).json({ message: 'Unable to retrieve brands.' });
    }
}
