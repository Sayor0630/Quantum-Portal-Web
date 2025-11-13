'use client';

import { Box, Stack, Text, TextInput } from '@mantine/core';
import { IconLink, IconUpload, IconVideo } from '@tabler/icons-react';
import { useRef } from 'react';
import { parseVideoUrl, fileToDataURL } from './utils';

interface VideoBlockProps {
  content: any;
  canvasTextColor?: string;
  editMode?: 'edit' | 'preview' | null;
  onUpdateContent?: (updates: any) => void;
}

export function VideoBlock({ 
  content, 
  canvasTextColor = '#000000',
  editMode = null,
  onUpdateContent,
}: VideoBlockProps) {
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  
  const handleVideoUpload = async (file: File | null) => {
    if (!file || !onUpdateContent) return;
    const dataURL = await fileToDataURL(file);
    onUpdateContent({ videoUrl: dataURL, videoType: 'file' });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      await handleVideoUpload(file);
    }
  };
  
  const videoData = parseVideoUrl(content.videoUrl);
  
  return (
    <Box style={{ width: content.width || '100%', margin: '0 auto' }}>
      {editMode === 'edit' && !content.videoUrl ? (
        <Stack gap="md">
          <TextInput
            value={content.videoUrl || ''}
            onChange={(e) => onUpdateContent && onUpdateContent({ videoUrl: e.target.value })}
            placeholder="Enter YouTube/Vimeo URL or upload a video"
            label="Video URL"
            leftSection={<IconLink size={14} />}
          />
          <Text size="sm" ta="center" c="dimmed">OR</Text>
          <Box
            p="xl"
            ta="center"
            style={{ border: `2px dashed ${canvasTextColor}40`, cursor: 'pointer' }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => videoFileInputRef.current?.click()}
          >
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={(e) => handleVideoUpload(e.target.files?.[0] || null)}
            />
            <IconUpload size={48} style={{ color: canvasTextColor, opacity: 0.5 }} />
            <Text mt="sm" style={{ color: canvasTextColor, opacity: 0.6 }}>
              Click to upload or drag & drop a video file
            </Text>
          </Box>
        </Stack>
      ) : videoData ? (
        <Box style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
          {videoData.type === 'file' ? (
            <video
              src={videoData.embedUrl}
              controls={content.controls !== false}
              autoPlay={content.autoplay || false}
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%' 
              }}
            />
          ) : (
            <iframe
              src={videoData.embedUrl + (content.autoplay ? '?autoplay=1' : '')}
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                border: 'none' 
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {editMode === 'edit' && (
            <TextInput
              value={content.videoUrl || ''}
              onChange={(e) => onUpdateContent && onUpdateContent({ videoUrl: e.target.value })}
              placeholder="Enter YouTube/Vimeo URL or upload"
              size="sm"
              mt="xs"
              leftSection={<IconLink size={14} />}
            />
          )}
        </Box>
      ) : (
        <Box ta="center" p="xl" style={{ border: `2px dashed ${canvasTextColor}40` }}>
          <IconVideo size={48} style={{ color: canvasTextColor, opacity: 0.5 }} />
          <Text mt="sm" style={{ color: canvasTextColor, opacity: 0.6 }}>
            {content.videoUrl ? `Invalid video URL: ${content.videoUrl}` : 'Enter a video URL or upload a file'}
          </Text>
        </Box>
      )}
    </Box>
  );
}
