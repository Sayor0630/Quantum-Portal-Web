import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]'; // Path from product-page-layout.ts
import connectToDatabase from '../../../lib/dbConnect'; // Path from product-page-layout.ts
import ProductPageLayoutConfig, { getDefaultProductPageLayout, IPageSection } from '../../../models/ProductPageLayoutConfig'; // Path
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) { // Add role check if necessary later
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      let layoutConfig = await ProductPageLayoutConfig.findOne();
      if (!layoutConfig) {
        // If no config, create and return default
        const defaultSections = getDefaultProductPageLayout();
        layoutConfig = await ProductPageLayoutConfig.create({ sections: defaultSections });
      } else if (layoutConfig.sections.length === 0) {
        // If config exists but sections are empty, populate with defaults and save
        layoutConfig.sections = getDefaultProductPageLayout() as any[]; // Cast needed if subdoc types mismatch
        await layoutConfig.save();
      }
      // Sort sections by order before returning
      layoutConfig.sections.sort((a, b) => a.order - b.order);
      return res.status(200).json(layoutConfig);
    } catch (error) {
      console.error('Error fetching product page layout:', error);
      return res.status(500).json({ message: 'Error fetching product page layout', error: (error as Error).message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { sections } = req.body as { sections?: Partial<IPageSection>[] }; // Allow partial updates to sections

      if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({ message: 'Sections array is required.' });
      }

      // Validate sections: ensure required fields are present and sectionIds are unique
      const incomingSectionIds = new Set<string>();
      for (const section of sections) {
        if (!section.sectionId || !section.name || typeof section.isVisible !== 'boolean' || typeof section.order !== 'number') {
          return res.status(400).json({ message: `Invalid section data: ${JSON.stringify(section)}. Each section must have sectionId, name, isVisible, and order.` });
        }
        if (incomingSectionIds.has(section.sectionId)) {
          return res.status(400).json({ message: `Duplicate sectionId found: ${section.sectionId}. Section IDs must be unique.` });
        }
        incomingSectionIds.add(section.sectionId);
      }

      // Merge incoming sections with defaults:
      // Start with a map of default sections.
      const defaultLayoutMap = new Map(getDefaultProductPageLayout().map(s => [s.sectionId, s]));
      const finalSectionsMap = new Map<string, Partial<IPageSection>>(defaultLayoutMap);

      // Update with incoming sections, overriding defaults where IDs match.
      for (const incomingSection of sections) {
          if (incomingSection.sectionId) {
              finalSectionsMap.set(incomingSection.sectionId, incomingSection);
          }
      }

      // Convert map back to array
      const finalSectionsArray = Array.from(finalSectionsMap.values());


      const updatedLayout = await ProductPageLayoutConfig.findOneAndUpdate(
        {}, // Find the single document
        { sections: finalSectionsArray },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      // Sort sections by order before returning
      if (updatedLayout) {
         updatedLayout.sections.sort((a, b) => a.order - b.order);
      }
      return res.status(200).json(updatedLayout);
    } catch (error) {
      console.error('Error updating product page layout:', error);
      // Check for the specific pre-save hook error for duplicate sectionIds
      if ((error as Error).message.includes('Duplicate sectionId found')) {
        return res.status(400).json({ message: (error as Error).message });
      }
      return res.status(500).json({ message: 'Error updating product page layout', error: (error as Error).message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
