'use client';

import { Paper, Group, TextInput, Select, Collapse, Button, Text, MultiSelect, Switch, Space, Stack, Accordion, Badge, ActionIcon, Box, ScrollArea, Checkbox } from '@mantine/core';
import { IconSearch, IconFilter, IconChevronDown, IconChevronUp, IconX, IconPlus, IconSettings } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState, useEffect } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface AttributeFilter {
  id: string;
  name: string;
  values: string[];
  selectedValues: string[];
}

export interface NestedAttributeFilter {
  id: string;
  name: string;
  values: string[];
  selectedValues: string[];
  isExpanded?: boolean;
}

export interface TwoStepAttributeFilter {
  id: string;
  name: string;
  values: string[];
}

export interface FilterPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Conditional filters based on context
  showCategoryFilter?: boolean;
  categories?: FilterOption[];
  selectedCategory?: string | null;
  onCategoryChange?: (value: string | null) => void;
  isCategoriesLoading?: boolean;
  
  showBrandFilter?: boolean;
  brands?: FilterOption[];
  selectedBrand?: string | null;
  onBrandChange?: (value: string | null) => void;
  isBrandsLoading?: boolean;
  
  // Enhanced attribute filtering
  showAttributeFilters?: boolean;
  attributes?: AttributeFilter[];
  onAttributeChange?: (attributeName: string, selectedValues: string[]) => void;
  isAttributesLoading?: boolean;
  
  // Nested attribute filtering with search (for products page)
  useNestedAttributeFiltering?: boolean;
  nestedAttributes?: NestedAttributeFilter[];
  onNestedAttributeChange?: (attributeId: string, selectedValues: string[]) => void;
  isNestedAttributesLoading?: boolean;
  
  // Structured attribute filtering (for products page)
  useStructuredAttributeFiltering?: boolean;
  selectedAttributeForFiltering?: string | null;
  onSelectedAttributeChange?: (attributeName: string | null) => void;
  
  // For attribute value filtering (used in attributes page)
  showAttributeValueFilter?: boolean;
  availableAttributeValues?: string[];
  selectedAttributeValues?: string[];
  onAttributeValueChange?: (selectedValues: string[]) => void;
  attributeValueLabel?: string;
  
  // Two-step attribute filtering (for products page)
  useTwoStepAttributeFiltering?: boolean;
  availableAttributes?: TwoStepAttributeFilter[];
  selectedAttributeIds?: string[];
  onSelectedAttributeIdsChange?: (attributeIds: string[]) => void;
  twoStepAttributeValues?: Record<string, string[]>;
  onTwoStepAttributeValueChange?: (attributeId: string, selectedValues: string[]) => void;
  isTwoStepAttributesLoading?: boolean;
  
  // Additional filters
  showPublishedFilter?: boolean;
  isPublished?: boolean | null;
  onPublishedChange?: (value: boolean | null) => void;
  
  showActiveFilter?: boolean;
  isActive?: boolean | null;
  onActiveChange?: (value: boolean | null) => void;
  
  // Product type filtering (for stock management)
  showProductTypeFilter?: boolean;
  productTypeOptions?: FilterOption[];
  selectedProductType?: string | null;
  onProductTypeChange?: (value: string | null) => void;
  
  // Sort options
  showSortFilter?: boolean;
  sortOptions?: FilterOption[];
  selectedSort?: string | null;
  onSortChange?: (value: string | null) => void;
  
  // Clear all filters
  onClearFilters?: () => void;
  
  // Search placeholder
  searchPlaceholder?: string;
}

export default function FilterPanel({
  searchTerm,
  onSearchChange,
  
  showCategoryFilter = false,
  categories = [],
  selectedCategory,
  onCategoryChange,
  isCategoriesLoading = false,
  
  showBrandFilter = false,
  brands = [],
  selectedBrand,
  onBrandChange,
  isBrandsLoading = false,
  
  showAttributeFilters = false,
  attributes = [],
  onAttributeChange,
  isAttributesLoading = false,
  
  useNestedAttributeFiltering = false,
  nestedAttributes = [],
  onNestedAttributeChange,
  isNestedAttributesLoading = false,
  
  useStructuredAttributeFiltering = false,
  selectedAttributeForFiltering,
  onSelectedAttributeChange,
  
  showAttributeValueFilter = false,
  availableAttributeValues = [],
  selectedAttributeValues = [],
  onAttributeValueChange,
  attributeValueLabel = "Attribute Values",
  
  useTwoStepAttributeFiltering = false,
  availableAttributes = [],
  selectedAttributeIds = [],
  onSelectedAttributeIdsChange,
  twoStepAttributeValues = {},
  onTwoStepAttributeValueChange,
  isTwoStepAttributesLoading = false,
  
  showPublishedFilter = false,
  isPublished,
  onPublishedChange,
  
  showActiveFilter = false,
  isActive,
  onActiveChange,
  
  showProductTypeFilter = false,
  productTypeOptions = [],
  selectedProductType,
  onProductTypeChange,
  
  showSortFilter = false,
  sortOptions = [],
  selectedSort,
  onSortChange,
  
  onClearFilters,
  searchPlaceholder = "Search..."
}: FilterPanelProps) {
  const [filtersOpened, { toggle: toggleFilters }] = useDisclosure(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  
  // Nested attribute filtering state
  const [attributeSearchTerm, setAttributeSearchTerm] = useState('');
  const [debouncedAttributeSearch] = useDebouncedValue(attributeSearchTerm, 300);
  const [valueSearchTerms, setValueSearchTerms] = useState<Record<string, string>>({});
  const [expandedAttributes, setExpandedAttributes] = useState<Set<string>>(new Set());

  // Check if any filters are active
  useEffect(() => {
    const hasFilters = 
      searchTerm.length > 0 ||
      (selectedCategory && selectedCategory.length > 0) ||
      (selectedBrand && selectedBrand.length > 0) ||
      isPublished !== null ||
      isActive !== null ||
      (selectedProductType && selectedProductType.length > 0 && selectedProductType !== 'all') ||
      (selectedSort && selectedSort.length > 0 && selectedSort !== 'name') ||
      attributes.some(attr => attr.selectedValues.length > 0) ||
      nestedAttributes.some(attr => attr.selectedValues.length > 0) ||
      (selectedAttributeValues && selectedAttributeValues.length > 0) ||
      selectedAttributeIds.length > 0 ||
      Object.values(twoStepAttributeValues).some(values => values.length > 0);
    
    setHasActiveFilters(hasFilters);
  }, [searchTerm, selectedCategory, selectedBrand, isPublished, isActive, selectedProductType, selectedSort, attributes, nestedAttributes, selectedAttributeValues, selectedAttributeIds, twoStepAttributeValues]);

  // Helper functions for nested attribute filtering
  const toggleAttributeExpansion = (attributeId: string) => {
    setExpandedAttributes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attributeId)) {
        newSet.delete(attributeId);
      } else {
        newSet.add(attributeId);
      }
      return newSet;
    });
  };

  const updateValueSearchTerm = (attributeId: string, searchTerm: string) => {
    setValueSearchTerms(prev => ({
      ...prev,
      [attributeId]: searchTerm
    }));
  };

  const getFilteredAttributes = () => {
    if (!debouncedAttributeSearch) return nestedAttributes;
    return nestedAttributes.filter(attr => 
      attr.name.toLowerCase().includes(debouncedAttributeSearch.toLowerCase())
    );
  };

  const getFilteredValues = (attribute: NestedAttributeFilter) => {
    const valueSearchTerm = valueSearchTerms[attribute.id] || '';
    if (!valueSearchTerm) return attribute.values;
    return attribute.values.filter(value => 
      value.toLowerCase().includes(valueSearchTerm.toLowerCase())
    );
  };

  const handleClearAll = () => {
    onSearchChange('');
    onCategoryChange?.('');
    onBrandChange?.('');
    onPublishedChange?.(null);
    onActiveChange?.(null);
    onProductTypeChange?.('');
    onSortChange?.('');
    onAttributeValueChange?.([]);
    onSelectedAttributeChange?.('');
    
    // Clear traditional attributes
    attributes.forEach(attr => {
      onAttributeChange?.(attr.name, []);
    });
    
    // Clear nested attributes
    nestedAttributes.forEach(attr => {
      onNestedAttributeChange?.(attr.id, []);
    });
    
    // Clear two-step attribute filtering
    onSelectedAttributeIdsChange?.([]);
    Object.keys(twoStepAttributeValues).forEach(attributeId => {
      onTwoStepAttributeValueChange?.(attributeId, []);
    });
    
    // Clear search terms
    setAttributeSearchTerm('');
    setValueSearchTerms({});
    setExpandedAttributes(new Set());
    
    onClearFilters?.();
  };

  return (
    <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
      {/* Search Row */}
      <Group grow mb="md">
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          rightSection={
            searchTerm ? (
              <IconX 
                size={16} 
                style={{ cursor: 'pointer' }} 
                onClick={() => onSearchChange('')}
              />
            ) : null
          }
        />
      </Group>

      {/* Filter Controls Row */}
      <Group justify="space-between" mb="sm">
        <Group>
          <Button
            variant="light"
            leftSection={<IconFilter size={16} />}
            rightSection={filtersOpened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            onClick={toggleFilters}
          >
            Filters {hasActiveFilters && `(${[
              // Basic filters
              showCategoryFilter && selectedCategory ? 1 : 0,
              showBrandFilter && selectedBrand ? 1 : 0,
              showPublishedFilter && isPublished !== null ? 1 : 0,
              showActiveFilter && isActive !== null ? 1 : 0,
              showProductTypeFilter && selectedProductType && selectedProductType !== 'all' ? 1 : 0,
              showSortFilter && selectedSort && selectedSort !== 'name' ? 1 : 0,
              
              // Attribute filters - only count the active filtering approach
              showAttributeFilters && !useNestedAttributeFiltering && !useTwoStepAttributeFiltering && !useStructuredAttributeFiltering 
                ? attributes.filter(attr => attr.selectedValues.length > 0).length 
                : 0,
              
              useNestedAttributeFiltering 
                ? nestedAttributes.filter(attr => attr.selectedValues.length > 0).length 
                : 0,
              
              useStructuredAttributeFiltering && selectedAttributeForFiltering ? 1 : 0,
              
              showAttributeValueFilter && selectedAttributeValues && selectedAttributeValues.length > 0 ? 1 : 0,
              
              useTwoStepAttributeFiltering 
                ? (selectedAttributeIds?.length || 0) + Object.values(twoStepAttributeValues).filter(values => values.length > 0).length 
                : 0
            ].reduce((a, b) => a + b, 0)})`}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="red"
              size="sm"
              leftSection={<IconX size={14} />}
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
        </Group>
      </Group>

      {/* Collapsible Filters */}
      <Collapse in={filtersOpened}>
        <Space h="sm" />
        <Group grow>
          {/* Category Filter */}
          {showCategoryFilter && (
            <Select
              placeholder="Filter by category"
              data={[
                { label: 'All Categories', value: '' },
                ...categories
              ]}
              value={selectedCategory || ''}
              onChange={onCategoryChange}
              disabled={isCategoriesLoading}
              clearable
              searchable
            />
          )}

          {/* Brand Filter */}
          {showBrandFilter && (
            <Select
              placeholder="Filter by brand"
              data={[
                { label: 'All Brands', value: '' },
                ...brands
              ]}
              value={selectedBrand || ''}
              onChange={onBrandChange}
              disabled={isBrandsLoading}
              clearable
              searchable
            />
          )}

          {/* Published Filter */}
          {showPublishedFilter && (
            <Select
              placeholder="Filter by status"
              data={[
                { label: 'All Items', value: '' },
                { label: 'Published Only', value: 'true' },
                { label: 'Unpublished Only', value: 'false' }
              ]}
              value={isPublished === null ? '' : String(isPublished)}
              onChange={(value) => onPublishedChange?.(value === '' ? null : value === 'true')}
            />
          )}

          {/* Active Filter */}
          {showActiveFilter && (
            <Select
              placeholder="Filter by active status"
              data={[
                { label: 'All Items', value: '' },
                { label: 'Active Only', value: 'true' },
                { label: 'Inactive Only', value: 'false' }
              ]}
              value={isActive === null ? '' : String(isActive)}
              onChange={(value) => onActiveChange?.(value === '' ? null : value === 'true')}
            />
          )}

          {/* Product Type Filter */}
          {showProductTypeFilter && (
            <Select
              placeholder="Filter by product type"
              data={[
                { label: 'All Products', value: '' },
                ...productTypeOptions
              ]}
              value={selectedProductType || ''}
              onChange={onProductTypeChange}
              clearable
            />
          )}

          {/* Sort Filter */}
          {showSortFilter && (
            <Select
              placeholder="Sort by"
              data={sortOptions}
              value={selectedSort || ''}
              onChange={onSortChange}
              clearable
            />
          )}
        </Group>

        {/* Nested Attribute Filters (Enhanced for Products Page) */}
        {useNestedAttributeFiltering && nestedAttributes.length > 0 && (
          <>
            <Space h="md" />
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>Product Attributes</Text>
              <Badge variant="light" color="blue" size="sm">
                {nestedAttributes.filter(attr => attr.selectedValues.length > 0).length} active
              </Badge>
            </Group>
            
            {/* Attribute Search */}
            <TextInput
              placeholder="Search attributes..."
              leftSection={<IconSearch size={14} />}
              value={attributeSearchTerm}
              onChange={(event) => setAttributeSearchTerm(event.currentTarget.value)}
              mb="sm"
              size="sm"
              rightSection={
                attributeSearchTerm ? (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => setAttributeSearchTerm('')}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                ) : null
              }
            />

            {/* Attributes List */}
            <Box style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <Stack gap="xs">
                {getFilteredAttributes().map((attribute) => {
                  const isExpanded = expandedAttributes.has(attribute.id);
                  const filteredValues = getFilteredValues(attribute);
                  const selectedCount = attribute.selectedValues.length;
                  
                  return (
                    <Paper key={attribute.id} withBorder p="sm" radius="sm">
                      {/* Attribute Header */}
                      <Group justify="space-between" mb={isExpanded ? "sm" : 0}>
                        <Group gap="sm">
                          <Button
                            variant="subtle"
                            size="xs"
                            leftSection={isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                            onClick={() => toggleAttributeExpansion(attribute.id)}
                            style={{ fontWeight: 500 }}
                          >
                            {attribute.name}
                          </Button>
                          {selectedCount > 0 && (
                            <Badge size="xs" variant="filled" color="blue">
                              {selectedCount}
                            </Badge>
                          )}
                        </Group>
                        
                        {selectedCount > 0 && (
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => onNestedAttributeChange?.(attribute.id, [])}
                          >
                            <IconX size={12} />
                          </ActionIcon>
                        )}
                      </Group>

                      {/* Attribute Values */}
                      <Collapse in={isExpanded}>
                        <Stack gap="xs">
                          {/* Value Search */}
                          <TextInput
                            placeholder={`Search ${attribute.name.toLowerCase()} values...`}
                            leftSection={<IconSearch size={12} />}
                            value={valueSearchTerms[attribute.id] || ''}
                            onChange={(event) => updateValueSearchTerm(attribute.id, event.currentTarget.value)}
                            size="xs"
                            rightSection={
                              valueSearchTerms[attribute.id] ? (
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => updateValueSearchTerm(attribute.id, '')}
                                >
                                  <IconX size={10} />
                                </ActionIcon>
                              ) : null
                            }
                          />

                          {/* Values List */}
                          <ScrollArea style={{ maxHeight: '200px' }}>
                            <Stack gap={2}>
                              {filteredValues.length > 0 ? (
                                filteredValues.map((value) => (
                                  <Checkbox
                                    key={value}
                                    label={value}
                                    size="sm"
                                    checked={attribute.selectedValues.includes(value)}
                                    onChange={(event) => {
                                      const isChecked = event.currentTarget.checked;
                                      const newSelectedValues = isChecked
                                        ? [...attribute.selectedValues, value]
                                        : attribute.selectedValues.filter(v => v !== value);
                                      onNestedAttributeChange?.(attribute.id, newSelectedValues);
                                    }}
                                  />
                                ))
                              ) : (
                                <Text size="xs" c="dimmed" ta="center" py="sm">
                                  No values found
                                </Text>
                              )}
                            </Stack>
                          </ScrollArea>

                          {/* Quick Actions */}
                          {filteredValues.length > 0 && (
                            <Group justify="space-between" mt="xs">
                              <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => onNestedAttributeChange?.(attribute.id, filteredValues)}
                                disabled={filteredValues.every(v => attribute.selectedValues.includes(v))}
                              >
                                Select All
                              </Button>
                              <Button
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() => onNestedAttributeChange?.(attribute.id, [])}
                                disabled={attribute.selectedValues.length === 0}
                              >
                                Clear
                              </Button>
                            </Group>
                          )}
                        </Stack>
                      </Collapse>
                    </Paper>
                  );
                })}
              </Stack>
              
              {getFilteredAttributes().length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No attributes found
                </Text>
              )}
            </Box>
          </>
        )}

        {/* Two-Step Attribute Filtering */}
        {useTwoStepAttributeFiltering && availableAttributes.length > 0 && (
          <>
            <Space h="md" />
            <Text size="sm" fw={500} mb="xs">Attribute Filters</Text>
            
            {/* Step 1: Select Attributes */}
            <MultiSelect
              label="Select attributes to filter by"
              placeholder="Choose attributes..."
              data={availableAttributes.map(attr => ({ value: attr.id, label: attr.name }))}
              value={selectedAttributeIds}
              onChange={onSelectedAttributeIdsChange}
              disabled={isTwoStepAttributesLoading}
              clearable
              searchable
              mb="md"
            />
            
            {/* Step 2: Select Values for Each Selected Attribute */}
            {selectedAttributeIds.length > 0 && (
              <Stack gap="md">
                {selectedAttributeIds.map(attributeId => {
                  const attribute = availableAttributes.find(attr => attr.id === attributeId);
                  if (!attribute) return null;
                  
                  return (
                    <div key={attributeId}>
                      <MultiSelect
                        label={`${attribute.name} Values`}
                        placeholder={`Select ${attribute.name.toLowerCase()} values...`}
                        data={attribute.values.map(value => ({ value, label: value }))}
                        value={twoStepAttributeValues[attribute.id] || []}
                        onChange={(values) => onTwoStepAttributeValueChange?.(attribute.id, values)}
                        disabled={isTwoStepAttributesLoading}
                        clearable
                        searchable
                        hidePickedOptions
                      />
                    </div>
                  );
                })}
              </Stack>
            )}
          </>
        )}

        {/* Traditional Attribute Filters (Fallback) */}
        {showAttributeFilters && !useNestedAttributeFiltering && !useTwoStepAttributeFiltering && attributes.length > 0 && (
          <>
            <Space h="md" />
            <Text size="sm" fw={500} mb="xs">Product Attributes</Text>
            <Stack gap="sm">
              {attributes.map((attribute) => (
                <Group key={attribute.name} grow>
                  <Text size="sm" fw={500} style={{ minWidth: '120px' }}>
                    {attribute.name}:
                  </Text>
                  <MultiSelect
                    placeholder={`Select ${attribute.name.toLowerCase()}`}
                    data={attribute.values.map(value => ({ value, label: value }))}
                    value={attribute.selectedValues}
                    onChange={(values) => onAttributeChange?.(attribute.name, values)}
                    disabled={isAttributesLoading}
                    clearable
                    searchable
                    hidePickedOptions
                    style={{ flex: 1 }}
                  />
                </Group>
              ))}
            </Stack>
          </>
        )}

        {/* Attribute Value Filter (for attributes page) */}
        {showAttributeValueFilter && availableAttributeValues.length > 0 && (
          <>
            <Space h="md" />
            <Text size="sm" fw={500} mb="xs">{attributeValueLabel}</Text>
            <MultiSelect
              placeholder="Select specific values"
              data={availableAttributeValues.map(value => ({ value, label: value }))}
              value={selectedAttributeValues}
              onChange={onAttributeValueChange}
              clearable
              searchable
              hidePickedOptions
            />
          </>
        )}
      </Collapse>
    </Paper>
  );
}
