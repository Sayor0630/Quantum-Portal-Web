// Block Components - Standalone and Reusable
// These components can be used in both the admin editor and the frontend

export { TextBlock } from './TextBlock';
export { ImageBlock } from './ImageBlock';
export { ButtonBlock } from './ButtonBlock';
export { VideoBlock } from './VideoBlock';
export { MediaGalleryBlock } from './MediaGalleryBlock';
export { ProductAttributeSelector } from './ProductAttributeSelector';

// Export shared types
export { DataSourceType, ProductFieldPath, CategoryFieldPath } from './types';
export type { DataBinding, FieldOption } from './types';

// Export utilities
export { getDataSourceFieldOptions, parseVideoUrl, fileToDataURL } from './utils';
export { resolvePreviewData, applyPreviewData } from './previewDataResolver';
// export { ProductListBlock } from './ProductListBlock'; // To be created
