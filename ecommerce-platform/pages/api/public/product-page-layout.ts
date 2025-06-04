import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../../lib/dbConnect';
import ProductPageLayoutConfig, { getDefaultProductPageLayout, IPageSection } from '../../../../models/ProductPageLayoutConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    await connectToDatabase();
    let layoutConfig = await ProductPageLayoutConfig.findOne().lean(); // Use .lean()

    let sectionsToReturn: Partial<IPageSection>[]; // Using Partial as _id might not be on default

    if (!layoutConfig || !layoutConfig.sections || layoutConfig.sections.length === 0) {
      // If no config or empty sections, create/return default and save it for future GETs
      const defaultSections = getDefaultProductPageLayout(); // This returns plain objects
      // Attempt to save the default layout if none exists
      // Use findOneAndUpdate with upsert to ensure only one document is created
      layoutConfig = await ProductPageLayoutConfig.findOneAndUpdate(
        {}, // Find any document (effectively, the singleton)
        { $setOnInsert: { sections: defaultSections } }, // Set sections only on insert
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true } // Create if doesn't exist, return new
      ).lean();
      sectionsToReturn = layoutConfig?.sections || defaultSections; // Use newly created or default if somehow still null
    } else {
      sectionsToReturn = layoutConfig.sections;
    }

    const publicSections = sectionsToReturn
        .filter(section => section.isVisible)
        .sort((a, b) => (a.order || 0) - (b.order || 0)) // Ensure order is a number
        .map(section => ({
            sectionId: section.sectionId,
            name: section.name, // Name might be useful for aria-labels or debugging
            // order: section.order, // Client usually renders in received order
            // isVisible: section.isVisible // Already filtered
        }));

    return res.status(200).json({ sections: publicSections });
  } catch (error) {
    console.error('[PUBLIC API] Error fetching product page layout:', error);
    return res.status(500).json({ message: 'Error fetching product page layout' });
  }
}
