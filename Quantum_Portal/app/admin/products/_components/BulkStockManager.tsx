'use client';

import React, { useState, useRef } from 'react';
import {
  Paper, Title, Text, Group, Stack, Grid, Alert, Badge,
  TextInput, NumberInput, Button, Select, Table, ScrollArea,
  Modal, Switch, Box, Card, Divider, LoadingOverlay,
  FileInput, Progress, ActionIcon, Tabs
} from '@mantine/core';
import {
  IconUpload, IconDownload, IconCheck, IconX, IconAlertCircle,
  IconFileText, IconPackage, IconCurrency, IconEdit
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface BulkStockItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantAttributes?: string;
  currentSku?: string;
  currentPrice: number;
  currentStock: number;
  newSku?: string;
  newPrice?: number;
  newStock?: number;
  hasChanges: boolean;
}

interface BulkStockManagerProps {
  products: any[];
  onUpdate: () => void;
}

export default function BulkStockManager({ products, onUpdate }: BulkStockManagerProps) {
  const [bulkItems, setBulkItems] = useState<BulkStockItem[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate bulk items from products
  const generateBulkItems = () => {
    const items: BulkStockItem[] = [];

    products.forEach(product => {
      if (product.hasVariants && product.variants?.length > 0) {
        // Add each variant as a separate item
        product.variants.forEach((variant: any) => {
          const variantAttributes = Object.entries(variant.attributeCombination)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');

          items.push({
            productId: product._id,
            productName: product.name,
            variantId: variant._id,
            variantAttributes,
            currentSku: variant.sku || '',
            currentPrice: variant.price || product.price,
            currentStock: variant.stockQuantity,
            newSku: variant.sku || '',
            newPrice: variant.price || product.price,
            newStock: variant.stockQuantity,
            hasChanges: false
          });
        });
      } else {
        // Add simple product
        items.push({
          productId: product._id,
          productName: product.name,
          currentSku: product.sku || '',
          currentPrice: product.price,
          currentStock: product.stockQuantity,
          newSku: product.sku || '',
          newPrice: product.price,
          newStock: product.stockQuantity,
          hasChanges: false
        });
      }
    });

    setBulkItems(items);
    setShowBulkModal(true);
  };

  // Update bulk item
  const updateBulkItem = (index: number, field: string, value: any) => {
    const updatedItems = [...bulkItems];
    const item = updatedItems[index];
    
    (item as any)[field] = value;
    
    // Check if there are changes
    item.hasChanges = 
      item.newSku !== item.currentSku ||
      item.newPrice !== item.currentPrice ||
      item.newStock !== item.currentStock;

    setBulkItems(updatedItems);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Product ID',
      'Product Name',
      'Variant ID',
      'Variant Attributes',
      'SKU',
      'Price',
      'Stock'
    ];

    const csvData = [headers];

    products.forEach(product => {
      if (product.hasVariants && product.variants?.length > 0) {
        product.variants.forEach((variant: any) => {
          const variantAttributes = Object.entries(variant.attributeCombination)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');

          csvData.push([
            product._id,
            product.name,
            variant._id || '',
            variantAttributes,
            variant.sku || '',
            (variant.price || product.price).toString(),
            variant.stockQuantity.toString()
          ]);
        });
      } else {
        csvData.push([
          product._id,
          product.name,
          '',
          'Simple Product',
          product.sku || '',
          product.price.toString(),
          product.stockQuantity.toString()
        ]);
      }
    });

    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-template-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Parse CSV file
  const handleFileUpload = (file: File | null) => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());

        // Expected headers
        const expectedHeaders = ['Product ID', 'Product Name', 'Variant ID', 'Variant Attributes', 'SKU', 'Price', 'Stock'];
        
        // Validate headers
        const hasValidHeaders = expectedHeaders.every(h => 
          headers.some(header => header.toLowerCase() === h.toLowerCase())
        );

        if (!hasValidHeaders) {
          throw new Error('Invalid CSV format. Please use the exported template.');
        }

        const updates: BulkStockItem[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cells = line.split(',').map(c => c.replace(/"/g, '').trim());
          
          try {
            const productId = cells[0];
            const productName = cells[1];
            const variantId = cells[2] || undefined;
            const variantAttributes = cells[3];
            const sku = cells[4];
            const price = parseFloat(cells[5]);
            const stock = parseInt(cells[6]);

            if (!productId || !productName || isNaN(price) || isNaN(stock)) {
              errors.push(`Row ${i + 1}: Missing or invalid data`);
              continue;
            }

            // Find the corresponding current item
            const currentItem = bulkItems.find(item => 
              item.productId === productId && 
              (variantId ? item.variantId === variantId : !item.variantId)
            );

            updates.push({
              productId,
              productName,
              variantId,
              variantAttributes: variantAttributes === 'Simple Product' ? undefined : variantAttributes,
              currentSku: currentItem?.currentSku || '',
              currentPrice: currentItem?.currentPrice || price,
              currentStock: currentItem?.currentStock || stock,
              newSku: sku,
              newPrice: price,
              newStock: stock,
              hasChanges: true
            });

          } catch (error) {
            errors.push(`Row ${i + 1}: ${error}`);
          }

          setUploadProgress((i / (lines.length - 1)) * 100);
        }

        if (errors.length > 0) {
          notifications.show({
            title: 'Import Warnings',
            message: `${errors.length} rows had issues. Check console for details.`,
            color: 'yellow'
          });
          console.warn('CSV Import Errors:', errors);
        }

        setBulkItems(updates);
        
        notifications.show({
          title: 'CSV Imported',
          message: `${updates.length} items loaded for review`,
          color: 'green'
        });

      } catch (error: any) {
        notifications.show({
          title: 'Import Error',
          message: error.message || 'Failed to parse CSV file',
          color: 'red'
        });
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    };

    reader.readAsText(file);
  };

  // Apply bulk updates
  const applyBulkUpdates = async () => {
    const itemsWithChanges = bulkItems.filter(item => item.hasChanges);
    
    if (itemsWithChanges.length === 0) {
      notifications.show({
        title: 'No Changes',
        message: 'No items have been modified',
        color: 'blue'
      });
      return;
    }

    try {
      setUpdating(true);

      const updates = itemsWithChanges.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        stockQuantity: item.newStock,
        price: item.newPrice,
        sku: item.newSku
      }));

      const response = await fetch('/api/admin/products/bulk-stock-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update stock');
      }

      notifications.show({
        title: 'Bulk Update Complete',
        message: `${data.successCount} items updated successfully`,
        color: 'green'
      });

      if (data.errors?.length > 0) {
        notifications.show({
          title: 'Some Updates Failed',
          message: `${data.errors.length} items failed to update`,
          color: 'yellow'
        });
        console.warn('Update errors:', data.errors);
      }

      setShowBulkModal(false);
      onUpdate(); // Refresh the main list

    } catch (error: any) {
      notifications.show({
        title: 'Update Error',
        message: error.message || 'Failed to apply bulk updates',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const changedItemsCount = bulkItems.filter(item => item.hasChanges).length;

  return (
    <>
      <Group gap="sm">
        <Button
          leftSection={<IconEdit size="1rem" />}
          variant="light"
          onClick={generateBulkItems}
        >
          Bulk Edit
        </Button>
        <Button
          leftSection={<IconDownload size="1rem" />}
          variant="light"
          onClick={exportToCSV}
        >
          Export Template
        </Button>
      </Group>

      {/* Bulk Edit Modal */}
      <Modal
        opened={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title={
          <Group gap="sm">
            <IconEdit size="1.2rem" />
            <div>
              <Text fw={500}>Bulk Stock & Price Management</Text>
              <Text size="sm" c="dimmed">
                {bulkItems.length} items • {changedItemsCount} modified
              </Text>
            </div>
          </Group>
        }
        size="xl"
        centered
      >
        <Stack gap="lg">
          <LoadingOverlay visible={updating} />
          
          {/* Import Section */}
          <Paper withBorder p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={500} size="sm">Import from CSV</Text>
                  <Text size="xs" c="dimmed">Upload a CSV file to update multiple items at once</Text>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  onClick={exportToCSV}
                  leftSection={<IconDownload size="0.8rem" />}
                >
                  Download Template
                </Button>
              </Group>
              
              <FileInput
                placeholder="Choose CSV file"
                accept=".csv"
                onChange={handleFileUpload}
                leftSection={<IconUpload size="1rem" />}
                disabled={uploading}
              />
              
              {uploading && (
                <Progress value={uploadProgress} size="sm" />
              )}
            </Stack>
          </Paper>

          {/* Bulk Items Table */}
          <ScrollArea.Autosize mah={500}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Current</Table.Th>
                  <Table.Th>New SKU</Table.Th>
                  <Table.Th>New Price</Table.Th>
                  <Table.Th>New Stock</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bulkItems.map((item, index) => (
                  <Table.Tr key={`${item.productId}-${item.variantId || 'base'}`}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>{item.productName}</Text>
                        {item.variantAttributes && (
                          <Text size="xs" c="dimmed">{item.variantAttributes}</Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="xs">SKU: {item.currentSku || 'None'}</Text>
                        <Text size="xs">Price: ${item.currentPrice.toFixed(2)}</Text>
                        <Text size="xs">Stock: {item.currentStock}</Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={item.newSku || ''}
                        onChange={(e) => updateBulkItem(index, 'newSku', e.target.value)}
                        placeholder="SKU"
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        value={item.newPrice}
                        onChange={(value) => updateBulkItem(index, 'newPrice', value)}
                        decimalScale={2}
                        min={0}
                        leftSection="$"
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        value={item.newStock}
                        onChange={(value) => updateBulkItem(index, 'newStock', value)}
                        min={0}
                        step={1}
                      />
                    </Table.Td>
                    <Table.Td>
                      {item.hasChanges ? (
                        <Badge color="blue" size="xs">Modified</Badge>
                      ) : (
                        <Badge color="gray" size="xs">Unchanged</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>

          {bulkItems.length === 0 && (
            <Alert icon={<IconAlertCircle size="1rem" />} color="blue">
              No items to display. Click "Generate" to load current stock data.
            </Alert>
          )}

          {/* Actions */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {changedItemsCount} of {bulkItems.length} items modified
            </Text>
            <Group>
              <Button
                variant="subtle"
                onClick={() => setShowBulkModal(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconCheck size="1rem" />}
                onClick={applyBulkUpdates}
                disabled={changedItemsCount === 0}
                loading={updating}
              >
                Apply Changes ({changedItemsCount})
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
