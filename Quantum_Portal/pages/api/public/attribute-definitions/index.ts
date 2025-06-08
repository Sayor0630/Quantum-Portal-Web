import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import AttributeDefinition from '../../../../models/AttributeDefinition';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    await connectToDatabase();
    
    // Fetch all attribute definitions sorted by name
    const definitions = await AttributeDefinition.find({}).sort({ name: 1 }).lean();
    
    return res.status(200).json(definitions);
  } catch (error) {
    console.error('[PUBLIC API] Error fetching attribute definitions:', error);
    return res.status(500).json({ message: 'Unable to retrieve attribute definitions.' });
  }
}
