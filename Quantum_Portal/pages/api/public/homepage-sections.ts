import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../lib/dbConnect';
import HomepageSection from '../../../models/HomepageSection';
import Product, { IProduct } from '../../../models/Product'; // Import IProduct
import Category, { ICategory } from '../../../models/Category'; // Import ICategory

// Helper to sanitize content items based on type
const sanitizeContentItems = async (items: any[]): Promise<any[]> => {
    if (!items || items.length === 0) return [];

    const populatedItems: any[] = [];
    for (const item of items) {
        if (!item.itemId || !item.itemType) continue;

        let populatedItemData: any = null; // Simplified type

        if (item.itemType === 'Product') {
            populatedItemData = await Product.findOne({ _id: item.itemId, isPublished: true }) // Add isPublished check
                .select('name slug price images customAttributes category seoTitle seoDescription isPublished') // Ensure all needed public fields
                .populate('category', 'name slug isPublished') // Populate product's category and select its isPublished
                .lean();
        } else if (item.itemType === 'Category') {
            populatedItemData = await Category.findById(item.itemId) // Assuming findById implicitly checks for existing document
                // For categories referenced by homepage sections, we also need to ensure they are published
                .where({ isPublished: true }) // Add isPublished check
                .select('name slug image parent children isPublished') // Add 'image' if you have it, ensure isPublished is selected
                .lean();
        }

        if (populatedItemData) {
            // If itemType is Product, and its category is populated but not published, treat product as unavailable for this section item
            if (item.itemType === 'Product' && populatedItemData.category && typeof populatedItemData.category === 'object' && !populatedItemData.category.isPublished) {
                // Skip this product as its category is not published
                continue;
            }

            // Determine image URL carefully, checking if images array exists and has content
            let finalImageUrl = item.imageUrl; // Use item's override first
            if (!finalImageUrl && populatedItemData.images && Array.isArray(populatedItemData.images) && populatedItemData.images.length > 0) {
                const firstImage = populatedItemData.images[0];
                if (typeof firstImage === 'string') {
                    finalImageUrl = firstImage;
                } else if (typeof (firstImage as any)?.url === 'string') { // If images are objects with a URL
                    finalImageUrl = (firstImage as any).url;
                }
            } else if (!finalImageUrl && item.itemType === 'Category' && populatedItemData.image?.url) { // For category image
                finalImageUrl = populatedItemData.image?.url;
            }


            populatedItems.push({
                itemId: item.itemId,
                itemType: item.itemType,
                title: item.title || (populatedItemData as any).name,
                imageUrl: finalImageUrl,
                link: item.link || (item.itemType === 'Product' ? `/products/${(populatedItemData as any).slug || item.itemId}` : `/categories/${(populatedItemData as any).slug || item.itemId}`),
                subtitle: item.subtitle,
                ...(item.itemType === 'Product' && populatedItemData && {
                    price: (populatedItemData as IProduct).price,
                    // Potentially add other product-specific fields like seoTitle, seoDescription if needed by specific section displays
                    // For example, if a "featured product" card on homepage shows more details
                    // description: (populatedItemData as IProduct).description?.substring(0,100) + "...", // Short description
                }),
            });
        } else if (item.itemType === 'CustomLink') {
             if (item.title && item.link) {
                populatedItems.push({
                    itemType: 'CustomLink',
                    title: item.title,
                    imageUrl: item.imageUrl, // CustomLink might also have an image
                    link: item.link,
                    subtitle: item.subtitle,
                });
            }
        }
    }
    return populatedItems;
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    await connectToDatabase();
    const sectionsFromDB = await HomepageSection.find({ isVisible: true })
      .sort({ order: 1 })
      .lean();

    const sections: any[] = [];
    for (const section of sectionsFromDB) {
        let processedContent = { ...section.content };
        if (section.content.items && (section.type === 'productCarousel' || section.type === 'featuredProducts' || section.type === 'categoryList')) {
            processedContent.items = await sanitizeContentItems(section.content.items);
        }

        sections.push({
            _id: section._id,
            // name: section.name, // Admin name, usually not needed for public rendering of the section itself
            type: section.type,
            // isVisible: section.isVisible, // Already filtered, not needed in public response unless for some conditional client logic
            // order: section.order, // Client usually doesn't need order if API returns them sorted
            content: {
                title: processedContent.title,
                subtitle: processedContent.subtitle,
                text: processedContent.text,
                imageUrl: processedContent.imageUrl,
                videoUrl: processedContent.videoUrl,
                buttonText: processedContent.buttonText,
                buttonLink: processedContent.buttonLink,
                items: processedContent.items,
                htmlContent: processedContent.htmlContent,
            },
        });
    }

    return res.status(200).json(sections);
  } catch (error) {
    console.error('[PUBLIC API] Error fetching homepage sections:', error);
    return res.status(500).json({ message: 'Unable to retrieve homepage sections.' });
  }
}
