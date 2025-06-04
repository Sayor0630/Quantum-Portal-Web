import { BreadcrumbItem } from '../app/(store)/_components/BreadcrumbsDisplay'; // Adjust path as necessary
import { IconHome } from '@tabler/icons-react'; // For Home icon
import React from 'react'; // For React.ReactNode type for Icon

// Simplified types for what breadcrumb generators expect.
// These should align with what the public APIs populate and return.
// Crucially, `parent` should be populated recursively for full path, and `isPublished` must be present.
export interface BreadcrumbNestedCategory {
    _id: string;
    name: string;
    slug: string;
    parent?: BreadcrumbNestedCategory | null;
    isPublished?: boolean;
}

export interface BreadcrumbProductData {
    name: string;
    category?: BreadcrumbNestedCategory | null;
}

const HomeBreadcrumb: BreadcrumbItem = { title: <IconHome size={16} />, href: '/' };

export function generateCategoryBreadcrumbs(category?: BreadcrumbNestedCategory | null): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [HomeBreadcrumb];

    const buildPath = (cat?: BreadcrumbNestedCategory | null) => {
        if (!cat || cat.isPublished === false) return; // Stop if category is null or unpublished

        // Recursively add parent categories first
        if (cat.parent && typeof cat.parent === 'object') {
            buildPath(cat.parent);
        }
        // Add current category to breadcrumbs (will be a link unless it's the last one)
        items.push({ title: cat.name, href: `/category/${cat.slug}` });
    };

    if (category) {
        buildPath(category);
        // Make the last item (the current category itself) not a link
        if (items.length > 0 && items[items.length - 1].href === `/category/${category.slug}`) {
            const currentCategoryItem = items.pop();
            if (currentCategoryItem) { // Should always be true
                items.push({ title: currentCategoryItem.title }); // Add back without href
            }
        }
    } else {
        items.push({ title: 'Category' }); // Fallback if no category data
    }
    return items;
}

export function generateProductBreadcrumbs(product?: BreadcrumbProductData | null): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [HomeBreadcrumb];

    const buildCategoryPath = (cat?: BreadcrumbNestedCategory | null) => {
        if (!cat || cat.isPublished === false) return;
        if (cat.parent && typeof cat.parent === 'object') {
            buildPath(cat.parent);
        }
        items.push({ title: cat.name, href: `/category/${cat.slug}` });
    };

    if (product?.category) {
        // Check if the direct category is published before attempting to build its path
        if (product.category.isPublished !== false) { // Assume true if undefined, or be strict: product.category.isPublished === true
             buildCategoryPath(product.category);
        } else {
            // If main category is unpublished, perhaps only show "Home / Product Name"
            // Or "Home / Uncategorized / Product Name" - for now, just stops path here
        }
    }

    if (product) {
        items.push({ title: product.name }); // Current product name is the last item, not a link
    } else {
        items.push({ title: 'Product' }); // Fallback if no product data
    }
    return items;
}
