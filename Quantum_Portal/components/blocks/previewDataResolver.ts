import { DataSourceType } from './types';

/**
 * Generate preview placeholder text for data bindings (legacy support)
 * Shows what field is bound without using fake data
 */
export function resolvePreviewData(
  dataBinding: any,
  blockType: string
): any {
  // If static or no binding, return null (use original content)
  if (!dataBinding || dataBinding.sourceType === DataSourceType.STATIC) {
    return null;
  }

  const { sourceType, fieldPath, templateString, fallbackValue } = dataBinding;

  // If no field path specified, return fallback or source type
  if (!fieldPath) {
    return fallbackValue || `{{${sourceType}}}`;
  }

  // Generate display text showing what's bound
  let displayText = `{{${fieldPath}}}`;

  // Apply template if specified (for text/button blocks)
  if (templateString) {
    return templateString;
  }

  return displayText;
}

/**
 * Apply preview data to block content
 * Shows bindings as-is without replacement (no demo data)
 */
export function applyPreviewData(
  content: any,
  blockType: string
): any {
  // Just return content as-is - bindings will be visible in preview
  // The text already contains {{field}} notation from the editor
  return content;
}
