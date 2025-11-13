'use client';

import { Box, Button, Stack, TextInput, Group, Modal, Select, Text } from '@mantine/core';
import { IconLink, IconBrackets } from '@tabler/icons-react';
import { useState } from 'react';
import { DataSourceType } from './types';
import { getDataSourceFieldOptions } from './utils';

interface ButtonBlockProps {
  content: any;
  editMode?: 'edit' | 'preview' | null;
  onUpdateContent?: (updates: any) => void;
}

export function ButtonBlock({ 
  content, 
  editMode = null,
  onUpdateContent,
}: ButtonBlockProps) {
  const [isBindingModalOpen, setIsBindingModalOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceType>(DataSourceType.PRODUCT);
  const [selectedField, setSelectedField] = useState<string>('');
  
  // Check if data binding is enabled
  const isDataBindingEnabled = content?.dataBinding?.sourceType !== DataSourceType.STATIC;

  // Function to insert binding in button text
  const insertBinding = () => {
    if (!selectedField) return;
    
    const binding = `{{${selectedField}}}`;
    const currentText = content.buttonText || '';
    
    // Append binding to current text
    const newText = currentText + binding;
    
    onUpdateContent && onUpdateContent({ buttonText: newText });
    
    // Close modal and reset
    setIsBindingModalOpen(false);
    setSelectedField('');
  };
  
  if (editMode === 'edit') {
    return (
      <Box style={{ width: content.width || 'auto', margin: '0 auto' }}>
        {/* Binding Insert Modal */}
        <Modal
          opened={isBindingModalOpen}
          onClose={() => setIsBindingModalOpen(false)}
          title="Insert Dynamic Data"
          size="md"
        >
          <Stack gap="md">
            <Select
              label="Data Source"
              value={selectedDataSource}
              onChange={(value) => {
                setSelectedDataSource(value as DataSourceType);
                setSelectedField(''); // Reset field when source changes
              }}
              data={[
                { value: DataSourceType.PRODUCT, label: 'Product' },
                { value: DataSourceType.CATEGORY, label: 'Category' },
                { value: DataSourceType.COLLECTION, label: 'Collection' },
                { value: DataSourceType.CUSTOMER, label: 'Customer' },
              ]}
            />
            
            <Select
              label="Field"
              value={selectedField}
              onChange={(value) => setSelectedField(value || '')}
              data={getDataSourceFieldOptions(selectedDataSource, 'button').map(opt => ({
                value: opt.value,
                label: opt.label,
              }))}
              placeholder="Select a field to insert..."
              searchable
            />
            
            {selectedField && (
              <Text size="sm" c="dimmed">
                Will insert: <Text span fw={600} ff="monospace">{'{{' + selectedField + '}}'}</Text>
              </Text>
            )}
            
            <Group justify="flex-end" gap="xs">
              <Button 
                variant="subtle" 
                onClick={() => setIsBindingModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={insertBinding}
                disabled={!selectedField}
              >
                Insert Binding
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Stack gap="xs">
          <Group gap="xs" wrap="nowrap">
            <TextInput
              value={content.buttonText || ''}
              onChange={(e) => onUpdateContent && onUpdateContent({ buttonText: e.target.value })}
              placeholder={isDataBindingEnabled ? "e.g., Buy {{product.name}}" : "Button text"}
              size="sm"
              style={{ flex: 1 }}
            />
            {isDataBindingEnabled && (
              <Button
                size="sm"
                variant="light"
                onClick={() => setIsBindingModalOpen(true)}
                leftSection={<IconBrackets size={14} />}
                title="Insert dynamic data"
              >
                {'{{}}'}
              </Button>
            )}
          </Group>
          <TextInput
            value={content.buttonLink || ''}
            onChange={(e) => onUpdateContent && onUpdateContent({ buttonLink: e.target.value })}
            placeholder="Button link (https://...)"
            size="sm"
            leftSection={<IconLink size={14} />}
          />
          <Button 
            variant={content.buttonStyle || 'filled'} 
            size={content.buttonSize || 'md'}
            style={{ width: '100%' }}
          >
            {content.buttonText || 'Click Me'}
          </Button>
        </Stack>
      </Box>
    );
  }
  
  return (
    <Box style={{ width: content.width || 'auto', margin: '0 auto', textAlign: 'center' }}>
      <Button 
        component="a" 
        href={content.buttonLink || '#'} 
        target={content.buttonTarget || '_self'}
        rel={content.buttonTarget === '_blank' ? 'noopener noreferrer' : undefined}
        variant={content.buttonStyle || 'filled'} 
        size={content.buttonSize || 'md'}
      >
        {content.buttonText || 'Click Me'}
      </Button>
    </Box>
  );
}
