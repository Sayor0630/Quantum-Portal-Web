'use client';

import { Box, Button, Group, Text, TextInput } from '@mantine/core';
import { IconPhoto, IconUpload, IconLink } from '@tabler/icons-react';
import { useRef } from 'react';
import { fileToDataURL } from './utils';

interface ImageBlockProps {
  content: any;
  canvasTextColor?: string;
  editMode?: 'edit' | 'preview' | null;
  onUpdateContent?: (updates: any) => void;
}

export function ImageBlock({ 
  content, 
  canvasTextColor = '#000000',
  editMode = null,
  onUpdateContent,
}: ImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File | null) => {
    if (!file || !onUpdateContent) return;
    const dataURL = await fileToDataURL(file);
    onUpdateContent({ imageUrl: dataURL });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageUpload(file);
    }
  };

  const imageContent = (
    <Box style={{ width: content.width || '100%', margin: '0 auto', position: 'relative' }}>
      {!content.imageUrl && editMode === 'edit' ? (
        <Box
          p="xl"
          ta="center"
          style={{ border: `2px dashed ${canvasTextColor}40`, cursor: 'pointer' }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
          />
          <IconPhoto size={48} style={{ color: canvasTextColor, opacity: 0.5 }} />
          <Text mt="sm" style={{ color: canvasTextColor, opacity: 0.6 }}>
            Click to upload or drag & drop an image
          </Text>
        </Box>
      ) : content.imageUrl ? (
        <>
          <img
            src={content.imageUrl}
            alt={content.imageAlt || 'Image'}
            style={{ 
              width: '100%', 
              height: 'auto', 
              objectFit: content.imageFit || 'cover',
              maxHeight: content.imageMaxHeight || 'none',
            }}
          />
          {editMode === 'edit' && (
            <Group gap="xs" mt="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconUpload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Change Image
              </Button>
              {content.imageLink && (
                <TextInput
                  size="xs"
                  placeholder="Image link (optional)"
                  value={content.imageLink || ''}
                  onChange={(e) => onUpdateContent && onUpdateContent({ imageLink: e.target.value })}
                  leftSection={<IconLink size={14} />}
                  style={{ flex: 1 }}
                />
              )}
              {!content.imageLink && (
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => onUpdateContent && onUpdateContent({ imageLink: '' })}
                >
                  Add Link
                </Button>
              )}
            </Group>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && handleImageUpload) handleImageUpload(file);
            }}
          />
        </>
      ) : (
        <Box p="xl" ta="center" style={{ border: `2px dashed ${canvasTextColor}40` }}>
          <IconPhoto size={48} style={{ color: canvasTextColor, opacity: 0.5 }} />
          <Text mt="sm" style={{ color: canvasTextColor, opacity: 0.6 }}>
            No image selected
          </Text>
        </Box>
      )}
    </Box>
  );

  // Wrap with link if imageLink exists
  return content.imageLink && content.imageUrl ? (
    <a href={content.imageLink} target="_blank" rel="noopener noreferrer">
      {imageContent}
    </a>
  ) : imageContent;
}
