import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import Customer from '../../../../../models/Customer';
// Import Order model if we want to fetch order history summary later
// import Order from '../../../../../models/Order';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Add role check here
  // if ((session.user as { role?: string })?.role !== 'superadmin') {
  //   return res.status(403).json({ message: 'Forbidden' });
  // }

  const { customerId } = req.query;

  if (!customerId || typeof customerId !== 'string' || !mongoose.Types.ObjectId.isValid(customerId)) {
     return res.status(400).json({ message: 'Invalid customer ID' });
  }
  const customerObjectId = new mongoose.Types.ObjectId(customerId as string);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const customer = await Customer.findById(customerObjectId).select('-password').lean();

        if (!customer) {
          return res.status(404).json({ message: 'Customer not found' });
        }
        // Example: Fetch order count or summary if needed
        // const orderCount = await Order.countDocuments({ customer: customerObjectId });
        // const customerData = { ...customer, orderCount }; // Add to response
        return res.status(200).json(customer); // Or customerData
      } catch (error) {
        console.error('Error fetching customer:', error);
        return res.status(500).json({ message: 'Error fetching customer', error: (error as Error).message });
      }

    case 'PUT': // For updating customer status or other admin-editable fields
      try {
        const { isActive, firstName, lastName, email, addresses } = req.body;

        const customerToUpdate = await Customer.findById(customerObjectId);
        if (!customerToUpdate) {
          return res.status(404).json({ message: 'Customer not found for update' });
        }

        let changed = false;

        if (isActive !== undefined && typeof isActive === 'boolean' && customerToUpdate.isActive !== isActive) {
          customerToUpdate.isActive = isActive;
          changed = true;
        }

        if (firstName !== undefined && typeof firstName === 'string' && customerToUpdate.firstName !== firstName) {
            customerToUpdate.firstName = firstName.trim();
            changed = true;
        }
        if (lastName !== undefined && typeof lastName === 'string' && customerToUpdate.lastName !== lastName) {
            customerToUpdate.lastName = lastName.trim();
            changed = true;
        }
        if (email !== undefined && typeof email === 'string' && customerToUpdate.email !== email.trim().toLowerCase()) {
          const trimmedEmail = email.trim().toLowerCase();
          const existingCustomerByEmail = await Customer.findOne({ email: trimmedEmail, _id: { $ne: customerObjectId } });
          if (existingCustomerByEmail) {
              return res.status(409).json({ message: 'Another customer with this email already exists.' });
          }
          customerToUpdate.email = trimmedEmail;
          changed = true;
        }

        // Basic address update example - more robust logic might be needed for managing array of addresses
        if (addresses !== undefined && Array.isArray(addresses)) {
            // This replaces all addresses. Fine-grained control (add/remove/update specific address)
            // would need a more complex handler or dedicated endpoints.
            customerToUpdate.addresses = addresses;
            changed = true;
        }


        // Do NOT allow admin to update password directly here. Password changes should have dedicated secure flows.
        if (!changed && req.body && Object.keys(req.body).length > 0) {
            // If body had data but nothing recognized changed, could be an issue or just no actual change needed.
            // Return current state.
            const currentCustomerData = customerToUpdate.toObject();
            delete currentCustomerData.password;
            return res.status(200).json(currentCustomerData);
        }


        const updatedCustomer = await customerToUpdate.save();
        const responseCustomer = updatedCustomer.toObject();
        delete responseCustomer.password; // Ensure password is not returned

        return res.status(200).json(responseCustomer);
      } catch (error) {
        if ((error as any).code === 11000 && (error as any).keyPattern?.email) {
          return res.status(409).json({ message: 'A customer with this email already exists.' });
        }
        console.error('Error updating customer:', error);
        return res.status(500).json({ message: 'Error updating customer', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
