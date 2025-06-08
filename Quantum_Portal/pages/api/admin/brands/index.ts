import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Brand from '../../../../models/Brand';
import { hasPermission, Permission } from '../../../../lib/permissions';

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

    if (req.method === 'GET') {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        sortBy = 'name',
        sortOrder = 'asc',
        isActive 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      
      // Build query
      const query: any = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      // Build sort
      const sortOptions: any = {};
      sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      const brands = await Brand.find(query)
        .sort(sortOptions)
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);

      const totalBrands = await Brand.countDocuments(query);
      const totalPages = Math.ceil(totalBrands / limitNum);

      return res.status(200).json({
        brands,
        currentPage: pageNum,
        totalPages,
        totalItems: totalBrands,
      });
    }

    if (req.method === 'POST') {
      const { name, slug, description, logo, website, isActive } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Brand name is required' });
      }

      // Check if brand with same name already exists
      const existingBrand = await Brand.findOne({ name: name.trim() });
      if (existingBrand) {
        return res.status(409).json({ message: 'A brand with this name already exists' });
      }

      // Generate or use provided slug
      let finalSlug = slug?.trim() ? generateSlugFromName(slug.trim()) : generateSlugFromName(name.trim());
      
      // Check if slug already exists and modify if necessary
      let slugExists = await Brand.findOne({ slug: finalSlug });
      let counter = 1;
      while (slugExists) {
        const baseSlug = slug?.trim() ? generateSlugFromName(slug.trim()) : generateSlugFromName(name.trim());
        finalSlug = `${baseSlug}-${counter}`;
        slugExists = await Brand.findOne({ slug: finalSlug });
        counter++;
      }

      const newBrand = new Brand({
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || '',
        logo: logo?.trim() || '',
        website: website?.trim() || '',
        isActive: isActive !== undefined ? isActive : true,
      });

      await newBrand.save();
      return res.status(201).json(newBrand);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Admin brands API error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
