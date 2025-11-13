'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Group, Stack, Text, Badge } from '@mantine/core';

interface ProductAttributeSelectorProps {
  content: any;
  productData?: any;
  onVariantChange?: (selectedAttributes: Record<string, string>, variant: any) => void;
  editMode?: 'edit' | 'preview' | null;
}

export function ProductAttributeSelector({
  content,
  productData,
  onVariantChange,
  editMode = null,
}: ProductAttributeSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [currentVariant, setCurrentVariant] = useState<any>(null);

  // Don't auto-select - start with no variant selected

  // Find matching variant when selection changes
  useEffect(() => {
    if (!productData?.hasVariants || !productData?.variants) {
      return;
    }

    // Get all available attributes
    const attributes = productData.attributeDefinitions instanceof Map
      ? Object.fromEntries(productData.attributeDefinitions)
      : productData.attributeDefinitions;
    
    const totalAttributes = Object.keys(attributes || {}).length;
    const selectedCount = Object.keys(selectedAttributes).length;

    // Only proceed if ALL attributes are selected
    if (selectedCount === 0 || selectedCount < totalAttributes) {
      setCurrentVariant(null);
      if (onVariantChange) {
        onVariantChange({}, null);
      }
      return;
    }

    // Find variant that matches ALL selected attributes exactly
    const matchingVariant = productData.variants.find((variant: any) => {
      const variantAttrs = variant.attributeCombination instanceof Map
        ? Object.fromEntries(variant.attributeCombination)
        : variant.attributeCombination || {};
      
      // Check if all selected attributes match AND variant has same number of attributes
      const allMatch = Object.keys(selectedAttributes).every(
        key => variantAttrs[key] === selectedAttributes[key]
      );
      
      const sameAttributeCount = Object.keys(variantAttrs).length === selectedCount;
      
      return allMatch && sameAttributeCount;
    });

    console.log('=== VARIANT SELECTION ===');
    console.log('Total attributes needed:', totalAttributes);
    console.log('Selected count:', selectedCount);
    console.log('Selected attributes:', selectedAttributes);
    console.log('Matching variant:', matchingVariant);

    setCurrentVariant(matchingVariant);
    
    // Only notify parent if we found a matching variant
    if (onVariantChange) {
      onVariantChange(selectedAttributes, matchingVariant || null);
    }
  }, [selectedAttributes, productData, onVariantChange]);

  const handleAttributeSelect = (attributeName: string, value: string) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attributeName]: value,
    }));
  };

  const handleClearAll = () => {
    setSelectedAttributes({});
    setCurrentVariant(null);
    if (onVariantChange) {
      onVariantChange({}, null);
    }
  };

  // If in edit mode, show placeholder
  if (editMode === 'edit') {
    return (
      <Box p="md" style={{ border: '2px dashed gray', borderRadius: '8px' }}>
        <Text size="sm" c="dimmed">
          Product Attribute Selector
        </Text>
        <Text size="xs" c="dimmed">
          This will display variant options when viewing a product page
        </Text>
      </Box>
    );
  }

  // If no product data or no variants, don't show
  if (!productData || !productData.hasVariants || !productData.attributeDefinitions) {
    return null;
  }

  const attributes = productData.attributeDefinitions instanceof Map
    ? Object.fromEntries(productData.attributeDefinitions)
    : productData.attributeDefinitions;

  return (
    <Stack gap="md">
      {Object.entries(attributes).map(([attributeName, values]: [string, any]) => {
        if (!Array.isArray(values)) return null;

        return (
          <Box key={attributeName}>
            <Group gap="xs" mb="xs">
              <Text fw={600} size="sm">
                {attributeName}:
              </Text>
              <Text size="sm" c="dimmed">
                {selectedAttributes[attributeName]}
              </Text>
            </Group>
            
            <Group gap="xs">
              {values.map((value: string) => {
                const isSelected = selectedAttributes[attributeName] === value;
                
                // Check if this combination is in stock
                const testAttributes = { ...selectedAttributes, [attributeName]: value };
                const testVariant = productData.variants?.find((v: any) => {
                  const vAttrs = v.attributeCombination instanceof Map
                    ? Object.fromEntries(v.attributeCombination)
                    : v.attributeCombination || {};
                  
                  return Object.keys(testAttributes).every(
                    key => vAttrs[key] === testAttributes[key]
                  );
                });
                
                const isAvailable = testVariant?.isActive && testVariant?.stockQuantity > 0;

                return (
                  <Button
                    key={value}
                    variant={isSelected ? 'filled' : 'outline'}
                    size="sm"
                    onClick={() => handleAttributeSelect(attributeName, value)}
                    disabled={!isAvailable}
                    style={{
                      opacity: isAvailable ? 1 : 0.5,
                    }}
                  >
                    {value}
                    {!isAvailable && (
                      <Badge size="xs" color="red" ml="xs">
                        Out of Stock
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </Group>
          </Box>
        );
      })}

      {/* Clear All button at bottom - only show if any attributes are selected */}
      {Object.keys(selectedAttributes).length > 0 && (
        <Group justify="flex-start" mt={4}>
          <Button
            variant="subtle"
            size="xs"
            onClick={handleClearAll}
            color="gray"
            styles={{
              root: {
                fontSize: '11px',
                height: '24px',
                padding: '0 8px',
              }
            }}
          >
            Clear
          </Button>
        </Group>
      )}
    </Stack>
  );
}
