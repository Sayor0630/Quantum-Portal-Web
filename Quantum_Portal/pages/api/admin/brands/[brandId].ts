import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Brand from '../../../../models/Brand';
import { hasPermission, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';

// Helper function to generate a slug
const generateSlugFromName = (name: string) => {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectToDatabase();

    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = (session.user as any).role;
    if (!hasPermission(userRole, Permission.MANAGE_BRANDS)) {
      return res.status(403).json({ message: 'Insufficient permissions to manage brands' });
    }

    const { brandId } = req.query;

    if (!brandId || !mongoose.Types.ObjectId.isValid(brandId as string)) {
      return res.status(400).json({ message: 'Invalid brand ID' });
    }

    const brandObjectId = new mongoose.Types.ObjectId(brandId as string);

    if (req.method === 'GET') {
      const brand = await Brand.findById(brandObjectId);
      if (!brand) {
        return res.status(404).json({ message: 'Brand not found' });
      }
      return res.status(200).json(brand);
    }

    if (req.method === 'PUT') {
      const { name, slug, description, logo, website, isActive } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Brand name is required' });
      }

      const currentBrand = await Brand.findById(brandObjectId);
      if (!currentBrand) {
        return res.status(404).json({ message: 'Brand not found' });
      }

      // Check if another brand with same name already exists (excluding current brand)
      const existingBrand = await Brand.findOne({ 
        name: name.trim(), 
        _id: { $ne: brandObjectId } 
      });
      if (existingBrand) {
        return res.status(409).json({ message: 'A brand with this name already exists' });
      }

      // Update fields
      const updateFields: any = {
        name: name.trim(),
        description: description?.trim() || '',
        logo: logo?.trim() || '',
        website: website?.trim() || '',
        isActive: isActive !== undefined ? isActive : currentBrand.isActive,
      };

      // Handle slug - use provided slug or regenerate from name
      let finalSlug = slug?.trim() ? generateSlugFromName(slug.trim()) : generateSlugFromName(name.trim());
      
      // Check if slug already exists and modify if necessary (excluding current brand)
      if (finalSlug !== currentBrand.slug) {
        let slugExists = await Brand.findOne({ slug: finalSlug, _id: { $ne: brandObjectId } });
        let counter = 1;
        while (slugExists) {
          const baseSlug = slug?.trim() ? generateSlugFromName(slug.trim()) : generateSlugFromName(name.trim());
          finalSlug = `${baseSlug}-${counter}`;
          slugExists = await Brand.findOne({ slug: finalSlug, _id: { $ne: brandObjectId } });
          counter++;
        }
        updateFields.slug = finalSlug;
      }

      const updatedBrand = await Brand.findByIdAndUpdate(
        brandObjectId,
        updateFields,
        { new: true, runValidators: true }
      );

      return res.status(200).json(updatedBrand);
    }

    if (req.method === 'DELETE') {
      const brand = await Brand.findById(brandObjectId);
      if (!brand) {
        return res.status(404).json({ message: 'Brand not found' });
      }

      // TODO: Check if brand is used by any products
      // const productsCount = await Product.countDocuments({ brand: brandObjectId });
      // if (productsCount > 0) {
      //   return res.status(400).json({ 
      //     message: `Cannot delete brand. It is used by ${productsCount} product(s).` 
      //   });
      // }

      await Brand.findByIdAndDelete(brandObjectId);
      return res.status(200).json({ message: 'Brand deleted successfully' });
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Admin brand API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
