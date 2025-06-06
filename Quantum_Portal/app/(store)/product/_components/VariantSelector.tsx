'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper, Title, Text, Group, Select, Badge, Alert, Stack,
  NumberInput, Button, Box, Table
} from '@mantine/core';
import { IconShoppingCartPlus, IconAlertCircle, IconCheck } from '@tabler/icons-react';

// Interfaces
interface ProductVariant {
  _id?: string;
  attributeCombination: { [key: string]: string };
  sku?: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
}

interface VariantSelectorProps {
  attributeDefinitions: { [key: string]: string[] };
  variants: ProductVariant[];
  basePrice: number;
  onVariantChange: (variant: ProductVariant | null) => void;
}

export default function VariantSelector({
  attributeDefinitions,
  variants,
  basePrice,
  onVariantChange
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<{ [key: string]: string }>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Find matching variant when attributes change
  useEffect(() => {
    const attributeKeys = Object.keys(attributeDefinitions);
    const selectedKeys = Object.keys(selectedAttributes);
    
    // Check if all attributes are selected
    if (attributeKeys.length === selectedKeys.length && 
        attributeKeys.every(key => selectedAttributes[key])) {
      
      // Find matching variant
      const matchingVariant = variants.find(variant => {
        return attributeKeys.every(key => 
          variant.attributeCombination[key] === selectedAttributes[key]
        );
      });
      
      if (matchingVariant && matchingVariant.isActive) {
        setSelectedVariant(matchingVariant);
        onVariantChange(matchingVariant);
      } else {
        setSelectedVariant(null);
        onVariantChange(null);
      }
    } else {
      setSelectedVariant(null);
      onVariantChange(null);
    }
  }, [selectedAttributes, variants, attributeDefinitions, onVariantChange]);

  const handleAttributeChange = (attributeName: string, value: string | null) => {
    setSelectedAttributes(prev => {
      const newAttributes = { ...prev };
      if (value) {
        newAttributes[attributeName] = value;
      } else {
        delete newAttributes[attributeName];
      }
      return newAttributes;
    });
  };

  const getAttributeOptions = (attributeName: string) => {
    return attributeDefinitions[attributeName]?.map(value => ({
      value,
      label: value
    })) || [];
  };

  const isAttributeValueAvailable = (attributeName: string, value: string) => {
    // Check if this value is available in any variant
    return variants.some(variant => 
      variant.attributeCombination[attributeName] === value && 
      variant.isActive &&
      variant.stockQuantity > 0
    );
  };

  const getAllSelectedAttributeKeys = () => Object.keys(attributeDefinitions);
  const allAttributesSelected = getAllSelectedAttributeKeys().every(key => selectedAttributes[key]);

  return (
    <Paper p="md" withBorder radius="sm">
      <Title order={4} mb="md">Select Options</Title>
      
      <Stack gap="md">
        {Object.entries(attributeDefinitions).map(([attributeName, values]) => (
          <Box key={attributeName}>
            <Text size="sm" fw={500} mb="xs">{attributeName}:</Text>
            <Select
              placeholder={`Choose ${attributeName.toLowerCase()}`}
              data={getAttributeOptions(attributeName).map(option => ({
                ...option,
                disabled: !isAttributeValueAvailable(attributeName, option.value)
              }))}
              value={selectedAttributes[attributeName] || null}
              onChange={(value) => handleAttributeChange(attributeName, value)}
              clearable
            />
          </Box>
        ))}

        {/* Show selected variant info */}
        {allAttributesSelected && (
          <Box>
            {selectedVariant ? (
              <Group justify="space-between" align="center" p="sm" style={{ 
                backgroundColor: 'var(--mantine-color-green-0)', 
                borderRadius: 'var(--mantine-radius-sm)',
                border: '1px solid var(--mantine-color-green-3)'
              }}>
                <Box>
                  <Group gap="xs" align="center">
                    <IconCheck size={16} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>Available</Text>
                  </Group>
                  {selectedVariant.sku && (
                    <Text size="xs" c="dimmed">SKU: {selectedVariant.sku}</Text>
                  )}
                </Box>
                <Box ta="right">
                  <Text size="lg" fw={700} c="blue.7">
                    ${(selectedVariant.price || basePrice).toFixed(2)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedVariant.stockQuantity} in stock
                  </Text>
                </Box>
              </Group>
            ) : (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                This combination is not available
              </Alert>
            )}
          </Box>
        )}

        {/* Quantity and Add to Cart */}
        {selectedVariant && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Quantity:</Text>
            <Group gap="md" align="end">
              <NumberInput
                value={quantity}
                onChange={(value) => setQuantity(Number(value) || 1)}
                min={1}
                max={selectedVariant.stockQuantity}
                style={{ flex: 1 }}
              />
              <Button 
                leftSection={<IconShoppingCartPlus size={18} />}
                disabled={selectedVariant.stockQuantity === 0}
                flex={2}
              >
                {selectedVariant.stockQuantity > 0 ? 'Add to Cart' : 'Out of Stock'}
              </Button>
            </Group>
          </Box>
        )}

        {/* Show selected attributes summary */}
        {Object.keys(selectedAttributes).length > 0 && (
          <Box>
            <Text size="sm" fw={500} mb="xs">Selected:</Text>
            <Group gap="xs">
              {Object.entries(selectedAttributes).map(([key, value]) => (
                <Badge key={key} variant="light" size="sm">
                  {key}: {value}
                </Badge>
              ))}
            </Group>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
