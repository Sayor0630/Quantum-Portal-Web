import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import connectToDatabase from '../../../../../lib/dbConnect';
import Review from '../../../../../models/Review';
import Product from '../../../../../models/Product'; // For populating
import Customer from '../../../../../models/Customer'; // For populating
import mongoose from 'mongoose';

const ALLOWED_REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Add role check here
  // if ((session.user as { role?: string })?.role !== 'superadmin' && (session.user as { role?: string })?.role !== 'moderator') {
  //   return res.status(403).json({ message: 'Forbidden' });
  // }

  const { reviewId } = req.query;

  if (!reviewId || typeof reviewId !== 'string' || !mongoose.Types.ObjectId.isValid(reviewId)) {
     return res.status(400).json({ message: 'Invalid review ID' });
  }
  const reviewObjectId = new mongoose.Types.ObjectId(reviewId as string);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const review = await Review.findById(reviewObjectId)
          .populate({ path: 'product', model: Product, select: 'name sku images' })
          .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
          .lean();

        if (!review) {
          return res.status(404).json({ message: 'Review not found' });
        }
        return res.status(200).json(review);
      } catch (error) {
        console.error('Error fetching review:', error);
        return res.status(500).json({ message: 'Error fetching review details', error: (error as Error).message });
      }

    case 'PUT': // For updating review status or content
      try {
        const reviewToManage = await Review.findById(reviewObjectId);
        if (!reviewToManage) {
            return res.status(404).json({ message: 'Review not found for update' });
        }

        const { status, comment } = req.body;

        let changed = false;

        if (status !== undefined) {
          if (typeof status !== 'string' || !ALLOWED_REVIEW_STATUSES.includes(status.toLowerCase())) {
             return res.status(400).json({ message: `Invalid status. Must be one of: ${ALLOWED_REVIEW_STATUSES.join(', ')}` });
          }
          if (reviewToManage.status !== status.toLowerCase()) {
            reviewToManage.status = status.toLowerCase() as 'pending' | 'approved' | 'rejected';
            changed = true;
          }
        }

        if (comment !== undefined && typeof comment === 'string' && reviewToManage.comment !== comment.trim()) {
          reviewToManage.comment = comment.trim();
          changed = true;
        }

        if (!changed && req.body && Object.keys(req.body).length > 0) {
             // If body had data but nothing recognized changed, could be an issue or just no actual change needed.
             // Return current state after populating.
            const currentReview = await Review.findById(reviewObjectId)
                .populate({ path: 'product', model: Product, select: 'name sku images' })
                .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
                .lean();
            return res.status(200).json(currentReview);
        }


        const updatedReview = await reviewToManage.save();
        // Repopulate for consistent response
        const populatedReview = await Review.findById(updatedReview._id)
             .populate({ path: 'product', model: Product, select: 'name sku images' })
             .populate({ path: 'customer', model: Customer, select: 'firstName lastName email' })
             .lean();

        return res.status(200).json(populatedReview);
      } catch (error) {
        console.error('Error updating review:', error);
        return res.status(500).json({ message: 'Error updating review', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const deletedReview = await Review.findByIdAndDelete(reviewObjectId);
        if (!deletedReview) {
          return res.status(404).json({ message: 'Review not found for deletion' });
        }
        // Future: Consider if deleting a review should impact average product rating.
        // This would typically be handled by recalculating on product model or via a hook.
        return res.status(200).json({ message: 'Review deleted successfully' });
      } catch (error) {
        console.error('Error deleting review:', error);
        return res.status(500).json({ message: 'Error deleting review', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
