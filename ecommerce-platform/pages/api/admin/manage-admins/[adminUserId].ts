import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import AdminUser from '../../../../models/AdminUser';
import mongoose from 'mongoose';

const ALLOWED_ADMIN_ROLES = ['admin', 'contentManager', 'orderManager', 'superadmin'];
// Note: Changing a user to 'superadmin' or from 'superadmin' should be handled with extreme care.
// Generally, there's only one or very few superadmins. Demoting a superadmin is risky.
// Promoting to superadmin should also be a highly privileged action.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || (session.user as { role?: string })?.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: Only superadmins can manage admin users.' });
  }

  const { adminUserId } = req.query;
  const currentSuperAdminId = (session.user as { id?: string })?.id;


  if (!adminUserId || typeof adminUserId !== 'string' || !mongoose.Types.ObjectId.isValid(adminUserId)) {
     return res.status(400).json({ message: 'Invalid admin user ID format.' });
  }
  const adminUserObjectId = new mongoose.Types.ObjectId(adminUserId as string);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const adminUser = await AdminUser.findById(adminUserObjectId).select('-password').lean();
        if (!adminUser) {
            return res.status(404).json({ message: 'Admin user not found.' });
        }
        return res.status(200).json(adminUser);
      } catch (error) {
        console.error('Error fetching admin user details:', error);
        return res.status(500).json({ message: 'Error fetching admin user details', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const adminToManage = await AdminUser.findById(adminUserObjectId);
        if (!adminToManage) {
            return res.status(404).json({ message: 'Admin user not found for update.' });
        }

        const { role, isActive, email } = req.body;

        if (role === undefined && isActive === undefined && email === undefined) {
          return res.status(400).json({ message: 'No update data provided (role, isActive, or email).' });
        }

        // Prevent a superadmin from modifying their own critical fields via this route
        if (currentSuperAdminId === adminUserId) {
            if (role !== undefined && role !== 'superadmin') {
                return res.status(403).json({ message: 'Superadmins cannot change their own role from superadmin.'});
            }
            if (isActive === false) { // Note: strict false check
                return res.status(403).json({ message: 'Superadmins cannot deactivate their own account.'});
            }
        }


        if (role !== undefined) {
          if (!ALLOWED_ADMIN_ROLES.includes(role)) {
            return res.status(400).json({ message: `Invalid role. Must be one of: ${ALLOWED_ADMIN_ROLES.join(', ')}` });
          }
          // Prevent last superadmin from being demoted or another user becoming superadmin if not intended
          if (adminToManage.role === 'superadmin' && role !== 'superadmin') {
            const superadminCount = await AdminUser.countDocuments({ role: 'superadmin', isActive: true });
            if (superadminCount <= 1) {
                return res.status(400).json({ message: 'Cannot change role of the last active superadmin.' });
            }
          }
          adminToManage.role = role;
        }

        if (isActive !== undefined && typeof isActive === 'boolean') {
          // Prevent last superadmin from being deactivated
          if (adminToManage.role === 'superadmin' && adminToManage.isActive === true && isActive === false) {
             const superadminCount = await AdminUser.countDocuments({ role: 'superadmin', isActive: true });
             if (superadminCount <= 1) {
                return res.status(400).json({ message: 'Cannot deactivate the last active superadmin.' });
            }
          }
          adminToManage.isActive = isActive;
        }

        if (email !== undefined && typeof email === 'string') {
          const trimmedEmail = email.trim().toLowerCase();
          if (trimmedEmail !== adminToManage.email) {
             const existingAdmin = await AdminUser.findOne({ email: trimmedEmail, _id: { $ne: adminUserObjectId } });
             if (existingAdmin) {
                 return res.status(409).json({ message: 'Another admin user with this email already exists.' });
             }
             adminToManage.email = trimmedEmail;
          }
        }

        await adminToManage.save();
        const updatedAdminResponse = adminToManage.toObject();
        delete updatedAdminResponse.password;

        return res.status(200).json(updatedAdminResponse);
      } catch (error) {
         if ((error as any).code === 11000 && (error as any).keyPattern?.email) {
             return res.status(409).json({ message: 'An admin user with this email already exists.' });
         }
        console.error('Error updating admin user:', error);
        return res.status(500).json({ message: 'Error updating admin user', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const adminToDelete = await AdminUser.findById(adminUserObjectId);
        if (!adminToDelete) {
            return res.status(404).json({ message: 'Admin user not found for deletion.' });
        }

        if (currentSuperAdminId === adminUserId) {
          return res.status(403).json({ message: 'Superadmins cannot delete their own account.' });
        }

        // Prevent deletion of the last superadmin
        if (adminToDelete.role === 'superadmin') {
            const superadminCount = await AdminUser.countDocuments({ role: 'superadmin' });
            if (superadminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last superadmin account.' });
            }
        }

        await AdminUser.findByIdAndDelete(adminUserObjectId);
        return res.status(200).json({ message: 'Admin user deleted successfully.' });
      } catch (error) {
        console.error('Error deleting admin user:', error);
        return res.status(500).json({ message: 'Error deleting admin user', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
