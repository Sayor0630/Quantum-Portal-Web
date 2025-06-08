'use client';

import React, { useState } from 'react';
import {
  Modal, Group, Text, NumberInput, Button, Stack,
  Select, Alert, Badge, Divider
} from '@mantine/core';
import {
  IconEdit, IconCheck, IconAlertCircle, IconPlus, IconMinus
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface QuickStockAdjustmentProps {
  opened: boolean;
  onClose: () => void;
  product: any;
  onUpdate: () => void;
}

export default function QuickStockAdjustment({ 
  opened, 
  onClose, 
  product, 
  onUpdate 
}: QuickStockAdjustmentProps) {
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'add' | 'subtract'>('set');
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  if (!product) return null;

  const getCurrentStock = () => {
    if (product.hasVariants && selectedVariant) {
      const variant = product.variants?.find((v: any) => v._id === selectedVariant);
      return variant?.stockQuantity || 0;
    }
    return product.stockQuantity || 0;
  };

  const getNewStock = () => {
    const currentStock = getCurrentStock();
    
    switch (adjustmentType) {
      case 'add':
        return currentStock + adjustmentValue;
      case 'subtract':
        return Math.max(0, currentStock - adjustmentValue);
      case 'set':
      default:
        return adjustmentValue;
    }
  };

  const handleAdjustment = async () => {
    try {
      setUpdating(true);
      
      const newStock = getNewStock();
      
      if (newStock < 0) {
        notifications.show({
          title: 'Invalid Stock',
          message: 'Stock cannot be negative',
          color: 'red'
        });
        return;
      }

      let updateData: any;

      if (product.hasVariants && selectedVariant) {
        // Update specific variant
        const updatedVariants = product.variants.map((variant: any) => {
          if (variant._id === selectedVariant) {
            return { ...variant, stockQuantity: newStock };
          }
          return variant;
        });

        updateData = {
          variants: updatedVariants,
          // Recalculate total stock
          stockQuantity: updatedVariants
            .filter((v: any) => v.isActive)
            .reduce((total: number, v: any) => total + v.stockQuantity, 0)
        };
      } else {
        // Update simple product
        updateData = {
          stockQuantity: newStock
        };
      }

      const response = await fetch(`/api/admin/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update stock');
      }

      notifications.show({
        title: 'Stock Updated',
        message: `Stock adjusted from ${getCurrentStock()} to ${newStock}`,
        color: 'green'
      });

      onUpdate();
      onClose();

    } catch (error: any) {
      notifications.show({
        title: 'Update Error',
        message: error.message || 'Failed to update stock',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const variantOptions = product.hasVariants && product.variants 
    ? product.variants.map((variant: any) => {
        const attributes = Object.entries(variant.attributeCombination)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        
        return {
          value: variant._id,
          label: `${attributes} (Stock: ${variant.stockQuantity})`
        };
      })
    : [];

  const currentStock = getCurrentStock();
  const newStock = getNewStock();
  const stockDifference = newStock - currentStock;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconEdit size="1.2rem" />
          <div>
            <Text fw={500}>Quick Stock Adjustment</Text>
            <Text size="sm" c="dimmed">{product.name}</Text>
          </div>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="lg">
        {product.hasVariants && (
          <div>
            <Text size="sm" fw={500} mb="xs">Select Variant</Text>
            <Select
              placeholder="Choose a variant to adjust"
              data={variantOptions}
              value={selectedVariant}
              onChange={(value) => setSelectedVariant(value || '')}
              searchable
            />
          </div>
        )}

        {(!product.hasVariants || selectedVariant) && (
          <>
            <div>
              <Text size="sm" fw={500} mb="xs">Current Stock</Text>
              <Group gap="sm">
                <Badge size="lg" variant="light">
                  {currentStock} units
                </Badge>
                {currentStock <= 10 && currentStock > 0 && (
                  <Badge color="yellow" size="sm">Low Stock</Badge>
                )}
                {currentStock === 0 && (
                  <Badge color="red" size="sm">Out of Stock</Badge>
                )}
              </Group>
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">Adjustment Type</Text>
              <Select
                data={[
                  { value: 'set', label: 'Set to specific amount' },
                  { value: 'add', label: 'Add to current stock' },
                  { value: 'subtract', label: 'Remove from current stock' }
                ]}
                value={adjustmentType}
                onChange={(value) => setAdjustmentType(value as any || 'set')}
              />
            </div>

            <div>
              <Text size="sm" fw={500} mb="xs">
                {adjustmentType === 'set' ? 'New Stock Amount' : 
                 adjustmentType === 'add' ? 'Amount to Add' : 'Amount to Remove'}
              </Text>
              <NumberInput
                value={adjustmentValue}
                onChange={(value) => setAdjustmentValue(Number(value) || 0)}
                min={0}
                step={1}
                placeholder="Enter amount"
                leftSection={
                  adjustmentType === 'add' ? <IconPlus size="1rem" /> :
                  adjustmentType === 'subtract' ? <IconMinus size="1rem" /> :
                  <IconEdit size="1rem" />
                }
              />
            </div>

            <Divider />

            <div>
              <Text size="sm" fw={500} mb="xs">Preview</Text>
              <Group justify="space-between" align="center">
                <Text size="sm">
                  {currentStock} → {newStock}
                </Text>
                <Badge 
                  color={stockDifference > 0 ? 'green' : stockDifference < 0 ? 'red' : 'gray'}
                  variant="light"
                >
                  {stockDifference > 0 ? '+' : ''}{stockDifference}
                </Badge>
              </Group>
            </div>

            {newStock < 0 && (
              <Alert icon={<IconAlertCircle size="1rem" />} color="red">
                Stock cannot be negative. The adjustment will be capped at 0.
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="subtle" onClick={onClose} disabled={updating}>
                Cancel
              </Button>
              <Button
                leftSection={<IconCheck size="1rem" />}
                onClick={handleAdjustment}
                loading={updating}
                disabled={adjustmentValue === 0 && adjustmentType !== 'set'}
              >
                Apply Adjustment
              </Button>
            </Group>
          </>
        )}

        {product.hasVariants && !selectedVariant && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="blue">
            Please select a variant to adjust its stock level.
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}
