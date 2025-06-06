import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import Customer, { ICustomer } from '../../../../models/Customer';
import { Role } from '../../../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user || !(session.user as any).role) {
      return res.status(401).json({ message: 'Unauthorized: No valid session found' });
    }

    await dbConnect();

    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 3) {
      return res.status(400).json({ message: 'Bad Request: Query must be at least 3 characters long.' });
    }

    const searchTerm = q.trim();
    const searchLimit = Math.min(parseInt(limit as string) || 10, 20); // Max 20 results

    // Build search criteria for multiple fields
    const searchCriteria = {
      $or: [
        // Search by email (partial match, case insensitive)
        { email: { $regex: searchTerm, $options: 'i' } },
        // Search by first name (partial match, case insensitive)
        { firstName: { $regex: searchTerm, $options: 'i' } },
        // Search by last name (partial match, case insensitive)
        { lastName: { $regex: searchTerm, $options: 'i' } },
        // Search by phone number (exact match for now, since phone format is specific)
        { phoneNumber: { $regex: `^${searchTerm}` } },
      ]
    };

    const customers = await Customer.find(searchCriteria)
      .select('_id firstName lastName email phoneNumber addresses isActive')
      .sort({ firstName: 1, lastName: 1 }) // Sort by name
      .limit(searchLimit)
      .lean();

    // Format results for autocomplete display
    const formattedResults = customers.map((customer: any) => ({
      _id: customer._id,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phoneNumber: customer.phoneNumber || '',
      fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      displayText: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() + 
                   (customer.email ? ` (${customer.email})` : '') +
                   (customer.phoneNumber ? ` - ${customer.phoneNumber}` : ''),
      addresses: customer.addresses || [],
      isActive: customer.isActive,
    }));

    return res.status(200).json({ 
      success: true, 
      data: formattedResults,
      count: formattedResults.length 
    });

  } catch (error: any) {
    console.error('Error during customer search:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
