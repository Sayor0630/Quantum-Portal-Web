'use client';

import { useState, useRef } from 'react';
import { Button, Group, Text, Paper, Stack, Alert, Avatar, ActionIcon } from '@mantine/core';
import { IconUpload, IconX, IconPhoto } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface CloudinaryImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  placeholder?: string;
  folder?: string;
  tags?: string[];
  disabled?: boolean;
}

export default function CloudinaryImageUpload({
  value,
  onChange,
  onClear,
  placeholder = "Upload an image",
  folder = "brands",
  tags = [],
  disabled = false,
}: CloudinaryImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get signature from our API
      const signatureResponse = await fetch('/api/admin/upload/cloudinary-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder,
          tags: tags.length > 0 ? tags.join(',') : undefined,
        }),
      });

      if (!signatureResponse.ok) {
        throw new Error('Failed to get upload signature');
      }

      const { signature, timestamp, api_key, cloud_name } = await signatureResponse.json();

      // Create form data for Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', api_key);
      formData.append('folder', folder);
      if (tags.length > 0) {
        formData.append('tags', tags.join(','));
      }

      // Upload to Cloudinary
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadResult = await uploadResponse.json();
      
      // Call onChange with the secure URL
      onChange(uploadResult.secure_url);
      
      notifications.show({
        title: 'Success',
        message: 'Image uploaded successfully',
        color: 'green',
      });

    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Upload Error',
        message: err.message,
        color: 'red',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value to allow uploading the same file again
    event.target.value = '';
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
    setError(null);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Stack gap="sm">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {value ? (
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Group gap="sm">
              <Avatar src={value} size="lg" radius="md" />
              <div>
                <Text size="sm" fw={500}>Current Image</Text>
                <Text size="xs" c="dimmed" truncate style={{ maxWidth: 200 }}>
                  {value}
                </Text>
              </div>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconUpload size={14} />}
                onClick={openFileDialog}
                loading={isUploading}
                disabled={disabled}
              >
                Replace
              </Button>
              <ActionIcon
                variant="light"
                color="red"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      ) : (
        <Paper 
          withBorder 
          p="xl" 
          radius="md" 
          style={{ 
            border: '2px dashed var(--mantine-color-gray-4)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
          onClick={!disabled ? openFileDialog : undefined}
        >
          <Stack align="center" gap="sm">
            <IconPhoto size={48} color="var(--mantine-color-gray-6)" />
            <div style={{ textAlign: 'center' }}>
              <Text size="sm" fw={500}>{placeholder}</Text>
              <Text size="xs" c="dimmed">
                Click to browse or drag and drop
              </Text>
              <Text size="xs" c="dimmed">
                Supports: JPG, PNG, GIF, WebP (max 10MB)
              </Text>
            </div>
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              loading={isUploading}
              disabled={disabled}
            >
              {isUploading ? 'Uploading...' : 'Choose File'}
            </Button>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
