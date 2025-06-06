import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/dbConnect';
import Customer, { ICustomer } from '../../../../models/Customer'; // Assuming ICustomer is exported
import { Role } from '../../../../lib/permissions'; // Basic role check, not granular permission for lookup

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user || !(session.user as any).role) { // Basic check for authenticated admin
      return res.status(401).json({ message: 'Unauthorized: No valid session found' });
    }

    // Any authenticated admin can perform a lookup, no specific permission like MANAGE_CUSTOMERS needed for just lookup.
    // If more granular control is needed, add hasPermission check here.

    await dbConnect();

    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({ message: 'Bad Request: Email or phone number must be provided for lookup.' });
    }

    let customerQuery: any = {};

    if (email && typeof email === 'string') {
      // Primary lookup by email as it's unique on Customer model
      customerQuery.email = email.toLowerCase();
    } else if (phone && typeof phone === 'string') {
      // Placeholder for phone lookup if Customer model is updated or a different strategy is used.
      // For now, this will likely not find anyone unless 'phone' is added to Customer schema.
      // Or if we decide to search in a more complex way (e.g. if phone is in an array of contact details)
      // customerQuery.phoneNumber = phone; // Example if a direct 'phoneNumber' field existed
      return res.status(400).json({ message: 'Bad Request: Phone lookup is not currently supported by primary field. Please use email.' });
    } else {
        return res.status(400).json({ message: 'Bad Request: Invalid email or phone parameter.'});
    }

    // Only proceed if email was set in query
    if (!customerQuery.email) {
        return res.status(400).json({ message: 'Bad Request: Email is required for lookup at this time.' });
    }

    const customer: ICustomer | null = await Customer.findOne(customerQuery)
      .select('_id firstName lastName email addresses') // Select only relevant fields
      .lean();

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    // Return relevant customer data
    // The 'addresses' field is an array. The client might want the default or first one.
    // For now, returning all addresses. Client can pick.
    return res.status(200).json({ success: true, data: customer });

  } catch (error: any) {
    console.error('Error during customer lookup:', error);
    // Handle specific errors if necessary, e.g., mongoose CastError for bad ID format if querying by ID elsewhere
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
