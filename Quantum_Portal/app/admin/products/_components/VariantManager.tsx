'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper, Title, Button, Group, Text, Stack, Grid, Alert, Badge,
  ActionIcon, NumberInput, TextInput, Switch, Table, ScrollArea,
  Modal, Autocomplete, MultiSelect, Divider, Box, ThemeIcon
} from '@mantine/core';
import {
  IconPlus, IconTrash, IconSearch, IconPackage, IconAlertCircle,
  IconBoxMultiple, IconSettings, IconPhoto, IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import VariantImageManager from './VariantImageManager';

// Interfaces
interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

interface SelectedAttribute {
  attributeId: string;
  name: string;
  selectedValues: string[];
}

interface VariantImageInfo {
  url: string;
  public_id: string;
}

interface ProductVariant {
  _id?: string;
  attributeCombination: { [key: string]: string };
  sku?: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  images?: VariantImageInfo[];
}

interface VariantManagerProps {
  attributeDefinitions: AttributeDefinition[];
  selectedAttributes: SelectedAttribute[];
  variants: ProductVariant[];
  basePrice: number;
  onAttributesChange: (attributes: SelectedAttribute[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
  hasVariants: boolean;
  onHasVariantsChange: (hasVariants: boolean) => void;
  onAttributeDefinitionsChange?: (attributeDefinitions: AttributeDefinition[]) => void;
  isLoading?: boolean;
  formValues?: {
    price: number;
    sku: string;
    stockQuantity: number;
  };
  onFormValueChange?: (field: string, value: any) => void;
}

export default function VariantManager({
  attributeDefinitions,
  selectedAttributes,
  variants,
  basePrice,
  onAttributesChange,
  onVariantsChange,
  hasVariants,
  onHasVariantsChange,
  onAttributeDefinitionsChange,
  isLoading = false,
  formValues,
  onFormValueChange
}: VariantManagerProps) {
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filteredAttributes, setFilteredAttributes] = useState<AttributeDefinition[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  
  // New state for attribute creation
  const [showCreateAttribute, setShowCreateAttribute] = useState(false);
  const [newAttributeName, setNewAttributeName] = useState('');
  const [isCreatingAttribute, setIsCreatingAttribute] = useState(false);
  
  // New state for value creation
  const [creatingValueForAttribute, setCreatingValueForAttribute] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState('');
  const [isCreatingValue, setIsCreatingValue] = useState(false);

  // Filter attributes based on search - now show all attributes
  useEffect(() => {
    const filtered = attributeDefinitions.filter(attr =>
      attr.name.toLowerCase().includes(searchValue.toLowerCase())
    );
    setFilteredAttributes(filtered);
  }, [searchValue, attributeDefinitions]);

  // Generate all possible combinations when attributes change
  useEffect(() => {
    if (hasVariants && selectedAttributes.length > 0) {
      generateVariantCombinations();
    }
  }, [selectedAttributes, hasVariants]);

  const generateVariantCombinations = () => {
    if (selectedAttributes.length === 0) {
      onVariantsChange([]);
      return;
    }

    // Generate all possible combinations
    const combinations: { [key: string]: string }[] = [];
    
    const generateCombos = (attrs: SelectedAttribute[], currentCombo: { [key: string]: string }, index: number) => {
      if (index >= attrs.length) {
        combinations.push({ ...currentCombo });
        return;
      }

      const attr = attrs[index];
      for (const value of attr.selectedValues) {
        generateCombos(attrs, { ...currentCombo, [attr.name]: value }, index + 1);
      }
    };

    generateCombos(selectedAttributes, {}, 0);

    // Create variants for new combinations, preserve existing ones
    const newVariants: ProductVariant[] = combinations.map(combo => {
      // Check if variant already exists
      const existingVariant = variants.find(v => 
        Object.keys(combo).every(key => v.attributeCombination[key] === combo[key]) &&
        Object.keys(v.attributeCombination).length === Object.keys(combo).length
      );

      if (existingVariant) {
        return existingVariant;
      }

      // Create new variant
      return {
        attributeCombination: combo,
        stockQuantity: 0,
        isActive: true,
        price: undefined, // Will fall back to base price
        images: [] // Initialize empty images array
      };
    });

    onVariantsChange(newVariants);
  };

  const addAttribute = (attribute: AttributeDefinition) => {
    // Check if attribute is already selected
    if (selectedAttributes.some(selected => selected.attributeId === attribute._id)) {
      notifications.show({
        title: 'Already Added',
        message: `${attribute.name} is already selected`,
        color: 'yellow'
      });
      return;
    }

    const newAttribute: SelectedAttribute = {
      attributeId: attribute._id,
      name: attribute.name,
      selectedValues: []
    };
    onAttributesChange([...selectedAttributes, newAttribute]);
    // Don't close modal anymore
    setSearchValue('');
  };

  const removeAttribute = (attributeId: string) => {
    const updatedAttributes = selectedAttributes.filter(attr => attr.attributeId !== attributeId);
    onAttributesChange(updatedAttributes);
  };

  const removeAttributeFromModal = (attributeId: string) => {
    const updatedAttributes = selectedAttributes.filter(attr => attr.attributeId !== attributeId);
    onAttributesChange(updatedAttributes);
    // Don't close modal
  };

  const createNewAttribute = async () => {
    if (!newAttributeName.trim()) {
      notifications.show({
        title: 'Invalid Name',
        message: 'Please enter an attribute name',
        color: 'red'
      });
      return;
    }

    setIsCreatingAttribute(true);
    try {
      const response = await fetch('/api/admin/attribute-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAttributeName.trim(), values: [] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create attribute');
      }

      notifications.show({
        title: 'Attribute Created',
        message: `"${data.name}" has been created`,
        color: 'green'
      });

      // Update the local attributeDefinitions state
      if (onAttributeDefinitionsChange) {
        const newAttribute: AttributeDefinition = {
          _id: data._id,
          name: data.name,
          values: data.values || []
        };
        onAttributeDefinitionsChange([...attributeDefinitions, newAttribute]);
      }

      // Reset the form
      setNewAttributeName('');
      setShowCreateAttribute(false);
      
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to create attribute',
        color: 'red'
      });
    } finally {
      setIsCreatingAttribute(false);
    }
  };

  const createNewValue = async (attributeId: string) => {
    if (!newValueInput.trim()) {
      notifications.show({
        title: 'Invalid Value',
        message: 'Please enter a value',
        color: 'red'
      });
      return;
    }

    const attribute = attributeDefinitions.find(attr => attr._id === attributeId);
    if (!attribute) return;

    // Check if value already exists
    if (attribute.values.includes(newValueInput.trim())) {
      notifications.show({
        title: 'Value Exists',
        message: 'This value already exists for this attribute',
        color: 'yellow'
      });
      return;
    }

    setIsCreatingValue(true);
    try {
      const response = await fetch(`/api/admin/attribute-definitions/${attributeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: attribute.name, 
          values: [...attribute.values, newValueInput.trim()] 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add value');
      }

      notifications.show({
        title: 'Value Added',
        message: `"${newValueInput.trim()}" added to ${attribute.name}`,
        color: 'green'
      });

      // Update the local attributeDefinitions state
      if (onAttributeDefinitionsChange) {
        const updatedAttributes = attributeDefinitions.map(attr =>
          attr._id === attributeId 
            ? { ...attr, values: [...attr.values, newValueInput.trim()] }
            : attr
        );
        onAttributeDefinitionsChange(updatedAttributes);
      }

      setNewValueInput('');
      setCreatingValueForAttribute(null);
      
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to add value',
        color: 'red'
      });
    } finally {
      setIsCreatingValue(false);
    }
  };

  const updateAttributeValues = (attributeId: string, values: string[]) => {
    const updatedAttributes = selectedAttributes.map(attr =>
      attr.attributeId === attributeId ? { ...attr, selectedValues: values } : attr
    );
    onAttributesChange(updatedAttributes);
  };

  const updateVariant = (index: number, updates: Partial<ProductVariant>) => {
    const updatedVariants = variants.map((variant, i) =>
      i === index ? { ...variant, ...updates } : variant
    );
    onVariantsChange(updatedVariants);
  };

  const handleVariantImageUpdate = (images: VariantImageInfo[]) => {
    if (selectedVariantIndex !== null) {
      updateVariant(selectedVariantIndex, { images });
    }
  };

  const openImageManager = (variantIndex: number) => {
    setSelectedVariantIndex(variantIndex);
    setShowImageModal(true);
  };

  const toggleVariantSystem = (enabled: boolean) => {
    onHasVariantsChange(enabled);
    if (!enabled) {
      // Clear all variant data when disabling
      onAttributesChange([]);
      onVariantsChange([]);
    }
  };

  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <Group justify="space-between" mb="xl">
        <Group gap="sm">
          <ThemeIcon variant="light" color="blue" size="lg">
            <IconBoxMultiple size="1.2rem" />
          </ThemeIcon>
          <div>
            <Title order={4}>Product Variants</Title>
            <Text size="sm" c="dimmed">
              Manage stock by attribute combinations (e.g., Size, Color)
            </Text>
          </div>
        </Group>
        <Switch
          label="Enable Variants"
          checked={hasVariants}
          onChange={(event) => toggleVariantSystem(event.currentTarget.checked)}
          disabled={isLoading}
        />
      </Group>

      {!hasVariants && (
        <>
          <Alert icon={<IconSettings size="1rem" />} color="blue" variant="light" mb="md">
            Variants are disabled. This product will use single pricing and inventory.
          </Alert>
          
          <Title order={5} mb="sm">Pricing & Inventory</Title>
          <Grid mb="md">
            <Grid.Col span={{base:12, md:4}}>
              <NumberInput 
                label="Price" 
                placeholder="0.00" 
                required 
                decimalScale={2} 
                step={0.01} 
                min={0} 
                leftSection="$" 
                value={formValues?.price || 0}
                onChange={(value) => onFormValueChange?.('price', value)}
              />
            </Grid.Col>
            <Grid.Col span={{base:12, md:4}}>
              <TextInput 
                label="SKU" 
                placeholder="e.g., TSHIRT-BLK-LG" 
                required 
                value={formValues?.sku || ''}
                onChange={(e) => onFormValueChange?.('sku', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{base:12, md:4}}>
              <NumberInput 
                label="Stock Quantity" 
                placeholder="0" 
                required 
                min={0} 
                step={1} 
                allowDecimal={false} 
                value={formValues?.stockQuantity || 0}
                onChange={(value) => onFormValueChange?.('stockQuantity', value)}
              />
            </Grid.Col>
          </Grid>
        </>
      )}

      {hasVariants && (
        <Alert icon={<IconSettings size="1rem" />} color="blue" variant="light">
          Enable variants to manage stock by different attribute combinations (Size, Color, etc.).
          This allows customers to select specific product options.
        </Alert>
      )}

      {hasVariants && (
        <Stack gap="xl">
          {/* Attribute Selection */}
          <div>
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Selected Attributes</Text>
              <Button
                leftSection={<IconPlus size="1rem" />}
                size="xs"
                variant="light"
                onClick={() => setShowAttributeModal(true)}
                disabled={isLoading}
              >
                Add Attribute
              </Button>
            </Group>

            {selectedAttributes.length === 0 ? (
              <Alert icon={<IconAlertCircle size="1rem" />} color="yellow" variant="light">
                No attributes selected. Add attributes to create product variants.
              </Alert>
            ) : (
              <Stack gap="sm">
                {selectedAttributes.map((attr) => {
                  const attrDef = attributeDefinitions.find(def => def._id === attr.attributeId);
                  return (
                    <Paper key={attr.attributeId} withBorder p="md" radius="md">
                      <Group justify="space-between" mb="sm">
                        <Text fw={500} size="sm">{attr.name}</Text>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => removeAttribute(attr.attributeId)}
                        >
                          <IconTrash size="0.8rem" />
                        </ActionIcon>
                      </Group>
                      <MultiSelect
                        placeholder={`Select ${attr.name.toLowerCase()} options`}
                        data={attrDef?.values || []}
                        value={attr.selectedValues}
                        onChange={(values) => updateAttributeValues(attr.attributeId, values)}
                        size="xs"
                      />
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </div>

          {/* Variant Table */}
          {variants.length > 0 && (
            <div>
              {/* Price and Stock Summary */}
              <Paper withBorder p="md" mb="md" radius="md" style={{ 
                backgroundColor: 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-6))' 
              }}>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed" fw={500}>Price Range</Text>
                    <Text fw={600} size="lg">
                    {(() => {
                      const variantPrices = variants
                        .filter(v => v.price && v.price > 0 && v.isActive)
                        .map(v => v.price!);
                      
                      if (variantPrices.length === 0) {
                        return `$${basePrice.toFixed(2)} (base)`;
                      }
                      
                      const minPrice = Math.min(...variantPrices);
                      const maxPrice = Math.max(...variantPrices);
                      
                      if (minPrice === maxPrice) {
                        return `$${minPrice.toFixed(2)}`;
                      }
                      
                      return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
                    })()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={500}>Total Stock</Text>
                  <Text fw={600} size="lg">
                    {variants.filter(v => v.isActive).reduce((total, v) => total + v.stockQuantity, 0)} units
                  </Text>
                </div>
                </Group>
              </Paper>
              
              <Text fw={500} mb="sm">Variant Stock & Pricing ({variants.length} combinations)</Text>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Attributes</Table.Th>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Stock</Table.Th>
                      <Table.Th>Images</Table.Th>
                      <Table.Th>Active</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {variants.map((variant, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Group gap={4}>
                            {Object.entries(variant.attributeCombination).map(([key, value]) => (
                              <Badge key={key} size="xs" variant="light">
                                {key}: {value}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            placeholder="Optional"
                            value={variant.sku || ''}
                            onChange={(e) => updateVariant(index, { sku: e.target.value })}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            placeholder={`$${basePrice.toFixed(2)}`}
                            value={variant.price || ''}
                            onChange={(value) => updateVariant(index, { price: Number(value) || undefined })}
                            decimalScale={2}
                            min={0}
                            leftSection="$"
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="xs"
                            value={variant.stockQuantity}
                            onChange={(value) => updateVariant(index, { stockQuantity: Number(value) || 0 })}
                            min={0}
                            required
                          />
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconPhoto size="0.8rem" />}
                              onClick={() => openImageManager(index)}
                            >
                              {variant.images && variant.images.length > 0 
                                ? `${variant.images.length} image${variant.images.length > 1 ? 's' : ''}`
                                : 'Manage'
                              }
                            </Button>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Switch
                            size="sm"
                            checked={variant.isActive}
                            onChange={(e) => updateVariant(index, { isActive: e.currentTarget.checked })}
                          />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </Stack>
      )}

      {/* Attribute Search Modal */}
      <Modal
        opened={showAttributeModal}
        onClose={() => {
          setShowAttributeModal(false);
          setShowCreateAttribute(false);
          setNewAttributeName('');
          setCreatingValueForAttribute(null);
          setNewValueInput('');
          setSearchValue('');
        }}
        title="Manage Attributes"
        size="lg"
        centered
        radius="md"
      >
        <Stack gap="md">
          {/* Create New Attribute Section */}
          {!showCreateAttribute ? (
            <Button
              leftSection={<IconPlus size="1rem" />}
              variant="light"
              color="green"
              onClick={() => setShowCreateAttribute(true)}
              disabled={isCreatingAttribute}
            >
              Create New Attribute
            </Button>
          ) : (
            <Paper withBorder p="md" radius="md" style={{ backgroundColor: 'light-dark(var(--mantine-color-green-0), var(--mantine-color-dark-7))' }}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={500} size="sm">Create New Attribute</Text>
                  <ActionIcon 
                    size="sm" 
                    variant="subtle" 
                    onClick={() => {
                      setShowCreateAttribute(false);
                      setNewAttributeName('');
                    }}
                    disabled={isCreatingAttribute}
                  >
                    <IconX size="1rem" />
                  </ActionIcon>
                </Group>
                <Group gap="sm">
                  <TextInput
                    placeholder="e.g., Material, Brand, Style"
                    value={newAttributeName}
                    onChange={(e) => setNewAttributeName(e.target.value)}
                    style={{ flex: 1 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        createNewAttribute();
                      }
                    }}
                    disabled={isCreatingAttribute}
                  />
                  <Button
                    onClick={createNewAttribute}
                    loading={isCreatingAttribute}
                    size="sm"
                  >
                    Save
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

          <Divider />

          {/* Search */}
          <Autocomplete
            placeholder="Search attributes..."
            value={searchValue}
            onChange={setSearchValue}
            data={filteredAttributes.map(attr => attr.name)}
            leftSection={<IconSearch size="1rem" />}
          />
          
          <ScrollArea h={400}>
            <Stack gap="xs">
              {filteredAttributes.map((attr) => {
                const isSelected = selectedAttributes.some(selected => selected.attributeId === attr._id);
                const selectedAttribute = selectedAttributes.find(selected => selected.attributeId === attr._id);
                
                return (
                  <Paper key={attr._id} withBorder p="md" radius="md" style={{
                    backgroundColor: isSelected ? 'light-dark(var(--mantine-color-blue-0), var(--mantine-color-dark-6))' : undefined
                  }}>
                    <Group justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Group justify="space-between" mb="sm">
                          <Text fw={500} size="sm">{attr.name}</Text>
                          {isSelected ? (
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              onClick={() => removeAttributeFromModal(attr._id)}
                            >
                              Remove
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              onClick={() => addAttribute(attr)}
                            >
                              Add
                            </Button>
                          )}
                        </Group>

                        {/* Show attribute values with MultiSelect for selected attributes */}
                        {isSelected && selectedAttribute ? (
                          <MultiSelect
                            placeholder="Select values"
                            data={attr.values.map(value => ({ value, label: value }))}
                            value={selectedAttribute.selectedValues}
                            onChange={(values) => updateAttributeValues(attr._id, values)}
                            size="xs"
                            mb="sm"
                            renderOption={({ option, checked }) => (
                              <Group gap="sm">
                                <input type="checkbox" checked={checked} readOnly />
                                <Text size="xs">{option.label}</Text>
                              </Group>
                            )}
                          />
                        ) : (
                          <Group gap={4} mb="sm">
                            {attr.values.slice(0, 3).map((value, idx) => (
                              <Badge key={idx} size="xs" variant="light">{value}</Badge>
                            ))}
                            {attr.values.length > 3 && (
                              <Text size="xs" c="dimmed">+{attr.values.length - 3} more</Text>
                            )}
                            {attr.values.length === 0 && (
                              <Text size="xs" c="dimmed">No values defined</Text>
                            )}
                          </Group>
                        )}

                        {/* Add new value section */}
                        {isSelected && (
                          <>
                            {creatingValueForAttribute === attr._id ? (
                              <Group gap="xs" mt="sm">
                                <TextInput
                                  placeholder="New value"
                                  value={newValueInput}
                                  onChange={(e) => setNewValueInput(e.target.value)}
                                  size="xs"
                                  style={{ flex: 1 }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      createNewValue(attr._id);
                                    }
                                  }}
                                  disabled={isCreatingValue}
                                />
                                <Button
                                  size="xs"
                                  onClick={() => createNewValue(attr._id)}
                                  loading={isCreatingValue}
                                >
                                  Save
                                </Button>
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => {
                                    setCreatingValueForAttribute(null);
                                    setNewValueInput('');
                                  }}
                                  disabled={isCreatingValue}
                                >
                                  <IconX size="0.8rem" />
                                </ActionIcon>
                              </Group>
                            ) : (
                              <Button
                                size="xs"
                                variant="subtle"
                                leftSection={<IconPlus size="0.8rem" />}
                                onClick={() => setCreatingValueForAttribute(attr._id)}
                                mt="xs"
                              >
                                Add New Value
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </Group>
                  </Paper>
                );
              })}
              
              {filteredAttributes.length === 0 && (
                <Text ta="center" c="dimmed" py="xl">
                  {searchValue ? 'No attributes found' : 'No attributes available'}
                </Text>
              )}
            </Stack>
          </ScrollArea>

          <Divider />
          
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setShowAttributeModal(false);
                setShowCreateAttribute(false);
                setNewAttributeName('');
                setCreatingValueForAttribute(null);
                setNewValueInput('');
                setSearchValue('');
              }}
            >
              Done
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Variant Image Manager Modal */}
      {selectedVariantIndex !== null && (
        <VariantImageManager
          opened={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setSelectedVariantIndex(null);
          }}
          variantCombination={variants[selectedVariantIndex].attributeCombination}
          currentImages={variants[selectedVariantIndex].images || []}
          onImagesChange={handleVariantImageUpdate}
        />
      )}
    </Paper>
  );
}
