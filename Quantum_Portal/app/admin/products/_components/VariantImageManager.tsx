'use client';

import { useState } from 'react';
import { 
  Modal, 
  Title, 
  Text, 
  FileInput, 
  Button, 
  Group, 
  SimpleGrid, 
  Image as MantineImage, 
  CloseButton, 
  Box as MantineBox, 
  Progress, 
  Alert,
  Badge,
  Paper,
  Stack
} from '@mantine/core';
import { IconUpload, IconAlertCircle, IconPhoto } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface VariantImageInfo {
  url: string;
  public_id: string;
}

interface VariantImageManagerProps {
  opened: boolean;
  onClose: () => void;
  variantCombination: { [key: string]: string };
  currentImages: VariantImageInfo[];
  onImagesChange: (images: VariantImageInfo[]) => void;
}

export default function VariantImageManager({
  opened,
  onClose,
  variantCombination,
  currentImages,
  onImagesChange
}: VariantImageManagerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelectAndUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadError(null);
    const newImages = [...currentImages];
    
    for (const file of files) {
      try {
        // Get upload signature
        const sigResponse = await fetch('/api/admin/upload/cloudinary-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'product_variant_images' })
        });
        
        if (!sigResponse.ok) {
          const sigErrorData = await sigResponse.json();
          throw new Error(sigErrorData.message || 'Failed to get upload signature.');
        }
        
        const sigData = await sigResponse.json();
        
        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sigData.api_key);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        if (sigData.folder) formData.append('folder', sigData.folder);
        
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`;
        const cloudinaryResponse = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData
        });
        
        if (!cloudinaryResponse.ok) {
          const cloudErrorData = await cloudinaryResponse.json();
          throw new Error(cloudErrorData.error?.message || 'Cloudinary upload failed.');
        }
        
        const cloudinaryData = await cloudinaryResponse.json();
        newImages.push({
          url: cloudinaryData.secure_url,
          public_id: cloudinaryData.public_id
        });
        
      } catch (err: any) {
        setUploadError((prevError) => 
          prevError ? `${prevError}\n${file.name}: ${err.message}` : `${file.name}: ${err.message}`
        );
        notifications.show({
          title: `Upload Error: ${file.name}`,
          message: err.message,
          color: 'red'
        });
      }
    }
    
    onImagesChange(newImages);
    setSelectedFiles([]);
    setIsUploading(false);
  };

  const handleRemoveImage = (publicIdToRemove: string) => {
    const filteredImages = currentImages.filter(img => img.public_id !== publicIdToRemove);
    onImagesChange(filteredImages);
  };

  const variantDisplayName = Object.entries(variantCombination)
    .map(([attr, value]) => `${attr}: ${value}`)
    .join(', ');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPhoto size={20} />
          <Title order={4}>Variant Images</Title>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-light)' }}>
          <Text size="sm" fw={500} mb="xs">Variant Combination:</Text>
          <Group gap="xs">
            {Object.entries(variantCombination).map(([attr, value]) => (
              <Badge key={attr} variant="light" color="blue">
                {attr}: {value}
              </Badge>
            ))}
          </Group>
        </Paper>

        <div>
          <Text size="sm" fw={500} mb="xs">Upload Images for this Variant</Text>
          <FileInput
            label="Select Images"
            placeholder="Click to select variant images"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileSelectAndUpload}
            disabled={isUploading}
            value={selectedFiles}
            clearable
            leftSection={<IconUpload size={16} />}
          />
        </div>

        {isUploading && (
          <Progress value={100} striped animated />
        )}

        {uploadError && (
          <Alert 
            color="red" 
            title="Upload Error" 
            icon={<IconAlertCircle />} 
            withCloseButton 
            onClose={() => setUploadError(null)}
          >
            {uploadError}
          </Alert>
        )}

        {currentImages.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">Current Images ({currentImages.length})</Text>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
              {currentImages.map((image, index) => (
                <MantineBox 
                  key={image.public_id || index} 
                  style={{ 
                    position: 'relative', 
                    border: '1px solid #dee2e6', 
                    padding: '4px', 
                    borderRadius: '4px' 
                  }}
                >
                  <MantineImage 
                    src={image.url} 
                    alt={`${variantDisplayName} image ${index + 1}`} 
                    radius="sm" 
                    height={100} 
                    fit="contain" 
                  />
                  <CloseButton 
                    size="xs" 
                    onClick={() => handleRemoveImage(image.public_id)} 
                    style={{ 
                      position: 'absolute', 
                      top: 2, 
                      right: 2, 
                      backgroundColor: 'rgba(255,255,255,0.8)' 
                    }} 
                    aria-label="Remove image" 
                    disabled={isUploading} 
                  />
                </MantineBox>
              ))}
            </SimpleGrid>
          </div>
        )}

        {currentImages.length === 0 && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No images uploaded for this variant yet.
          </Text>
        )}

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
