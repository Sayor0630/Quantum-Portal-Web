'use client';

import { Box, Group, Text, Button, Select, Switch, NumberInput, ActionIcon, FileButton, TextInput } from '@mantine/core';
import {
  IconLayoutGrid,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPlay,
  IconTrash,
  IconPhotoPlus,
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { DataSourceType } from './types';
import { getDataSourceFieldOptions } from './utils';

interface MediaGalleryBlockProps {
  content: any;
  canvasTextColor?: string;
  editMode?: 'edit' | 'preview' | null;
  onUpdateContent?: (updates: any) => void;
  currentMediaIndex?: number;
  setCurrentMediaIndex?: (index: number) => void;
  previousMediaIndex?: number;
  setPreviousMediaIndex?: (index: number) => void;
  slideDirection?: 'left' | 'right';
  setSlideDirection?: (direction: 'left' | 'right') => void;
}

export function MediaGalleryBlock({
  content,
  canvasTextColor = '#000000',
  editMode = null,
  onUpdateContent,
  currentMediaIndex: externalCurrentIndex,
  setCurrentMediaIndex: externalSetCurrentIndex,
  previousMediaIndex: externalPreviousIndex,
  setPreviousMediaIndex: externalSetPreviousIndex,
  slideDirection: externalSlideDirection,
  setSlideDirection: externalSetSlideDirection,
}: MediaGalleryBlockProps) {
  // Internal state (used if external state not provided)
  const [internalCurrentIndex, setInternalCurrentIndex] = useState(0);
  const [internalPreviousIndex, setInternalPreviousIndex] = useState(0);
  const [internalSlideDirection, setInternalSlideDirection] = useState<'left' | 'right'>('right');
  const [galleryHeight, setGalleryHeight] = useState(content.height || 400);
  const [isResizing, setIsResizing] = useState(false);

  // Use external state if provided, otherwise use internal
  const currentMediaIndex = externalCurrentIndex !== undefined ? externalCurrentIndex : internalCurrentIndex;
  const setCurrentMediaIndex = externalSetCurrentIndex || setInternalCurrentIndex;
  const previousMediaIndex = externalPreviousIndex !== undefined ? externalPreviousIndex : internalPreviousIndex;
  const setPreviousMediaIndex = externalSetPreviousIndex || setInternalPreviousIndex;
  const slideDirection = externalSlideDirection || internalSlideDirection;
  const setSlideDirection = externalSetSlideDirection || setInternalSlideDirection;

  const items = content.items || [];
  const displayMode = content.displayMode || 'carousel1';
  const animation = content.transitionAnimation || 'slide';
  const isDataBindingEnabled = content?.dataBinding?.sourceType !== DataSourceType.STATIC;

  // Navigation functions
  const goToSlide = (index: number) => {
    if (index === currentMediaIndex) return;
    setPreviousMediaIndex(currentMediaIndex);
    setSlideDirection(index > currentMediaIndex ? 'right' : 'left');
    setCurrentMediaIndex(index);
  };

  const goToNextSlide = (totalItems: number) => {
    const nextIndex = (currentMediaIndex + 1) % totalItems;
    goToSlide(nextIndex);
  };

  const goToPrevSlide = (totalItems: number) => {
    const prevIndex = currentMediaIndex === 0 ? totalItems - 1 : currentMediaIndex - 1;
    goToSlide(prevIndex);
  };

  // Media management functions
  const handleMediaGalleryBatchAdd = async (type: 'image' | 'video', files: File[]) => {
    if (!onUpdateContent || files.length === 0) return;

    const processFile = (file: File): Promise<any> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (type === 'video') {
            const video = document.createElement('video');
            video.src = reader.result as string;
            video.currentTime = 1;
            video.addEventListener('loadeddata', () => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(video, 0, 0);
              const thumbnail = canvas.toDataURL('image/jpeg');

              resolve({
                id: nanoid(),
                type,
                url: reader.result as string,
                thumbnail,
                alt: file.name,
              });
            });
          } else {
            resolve({
              id: nanoid(),
              type,
              url: reader.result as string,
              thumbnail: reader.result as string,
              alt: file.name,
            });
          }
        };
        reader.readAsDataURL(file);
      });
    };

    const newItems = await Promise.all(Array.from(files).map(processFile));
    onUpdateContent({
      items: [...items, ...newItems],
    });
  };

  const handleMediaGalleryItemRemove = (itemId: string) => {
    if (!onUpdateContent) return;
    const newItems = items.filter((item: any) => item.id !== itemId);
    onUpdateContent({ items: newItems });
    if (currentMediaIndex >= newItems.length && newItems.length > 0) {
      setCurrentMediaIndex(newItems.length - 1);
    }
  };

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = galleryHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(200, Math.min(1200, startHeight + deltaY));
      setGalleryHeight(newHeight);
      if (onUpdateContent) {
        onUpdateContent({ height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Auto slideshow effect
  useEffect(() => {
    if (
      (displayMode === 'slideshow1' || displayMode === 'slideshow2') &&
      content.autoPlay &&
      items.length > 1
    ) {
      const interval = setInterval(() => {
        goToNextSlide(items.length);
      }, content.autoPlayInterval || 3000);
      return () => clearInterval(interval);
    }
  }, [displayMode, content.autoPlay, content.autoPlayInterval, items.length]);

  // Animation styles
  const getAnimationStyle = (idx: number) => {
    const isActive = idx === currentMediaIndex;
    const isPrevious = idx === previousMediaIndex;

    const shouldTransition = isActive || (isPrevious && previousMediaIndex !== currentMediaIndex);

    const baseStyle: React.CSSProperties = {
      transition: shouldTransition ? `all ${content.transitionSpeed || 500}ms ease-in-out` : 'none',
    };

    if (isActive) {
      return { ...baseStyle, opacity: 1, transform: 'translateX(0)', pointerEvents: 'auto' as const, zIndex: 2 };
    } else if (isPrevious && previousMediaIndex !== currentMediaIndex) {
      switch (animation) {
        case 'slide':
          const exitDirection = slideDirection === 'right' ? '-100%' : '100%';
          return {
            ...baseStyle,
            opacity: 0,
            transform: `translateX(${exitDirection})`,
            pointerEvents: 'none' as const,
            zIndex: 1,
          };
        case 'fade':
          return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const, zIndex: 1 };
        case 'zoom':
          return { ...baseStyle, transform: 'scale(1.2)', opacity: 0, pointerEvents: 'none' as const, zIndex: 1 };
        case 'flip':
          return {
            ...baseStyle,
            transform: 'rotateY(-90deg)',
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 1,
          };
        case 'cube':
          return {
            ...baseStyle,
            transform: 'rotateY(-90deg) scale(0.5)',
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 1,
          };
        case 'coverflow':
          return {
            ...baseStyle,
            transform: 'translateX(-100%) rotateY(-45deg) scale(0.8)',
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 1,
          };
        default:
          return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const, zIndex: 1 };
      }
    } else {
      switch (animation) {
        case 'fade':
          return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const, zIndex: 0 };
        case 'slide':
          const enterDirection = slideDirection === 'right' ? '100%' : '-100%';
          return {
            ...baseStyle,
            transform: `translateX(${enterDirection})`,
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 0,
          };
        case 'zoom':
          return { ...baseStyle, transform: 'scale(0.8)', opacity: 0, pointerEvents: 'none' as const, zIndex: 0 };
        case 'flip':
          return { ...baseStyle, transform: 'rotateY(90deg)', opacity: 0, pointerEvents: 'none' as const, zIndex: 0 };
        case 'cube':
          return {
            ...baseStyle,
            transform: 'rotateY(90deg) scale(0.5)',
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 0,
          };
        case 'coverflow':
          return {
            ...baseStyle,
            transform: 'translateX(100%) rotateY(45deg) scale(0.8)',
            opacity: 0,
            pointerEvents: 'none' as const,
            zIndex: 0,
          };
        default:
          return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const, zIndex: 0 };
      }
    }
  };

  return (
    <Box style={{ width: content.width || '100%', margin: '0 auto' }}>
      {editMode === 'edit' && (
        <Group gap="xs" mb="md" wrap="wrap" align="flex-end">
          {/* Hide Add Images/Videos when data binding is enabled */}
          {!isDataBindingEnabled && (
            <>
              <FileButton
                accept="image/*"
                multiple
                onChange={(files) => files.length > 0 && handleMediaGalleryBatchAdd('image', files)}
              >
                {(props) => (
                  <Button {...props} size="xs" variant="light" leftSection={<IconPhotoPlus size={14} />}>
                    Add Images
                  </Button>
                )}
              </FileButton>
              <FileButton
                accept="video/*"
                multiple
                onChange={(files) => files.length > 0 && handleMediaGalleryBatchAdd('video', files)}
              >
                {(props) => (
                  <Button {...props} size="xs" variant="light" leftSection={<IconPlayerPlay size={14} />}>
                    Add Videos
                  </Button>
                )}
              </FileButton>
            </>
          )}

          {/* Show data binding configuration when enabled */}
          {isDataBindingEnabled && getDataSourceFieldOptions && (
            <>
              <Select
                size="xs"
                label="Data Source"
                value={content.dataBinding?.sourceType || DataSourceType.PRODUCT}
                onChange={(value) =>
                  onUpdateContent &&
                  onUpdateContent({
                    dataBinding: {
                      ...content.dataBinding,
                      sourceType: value,
                      fieldPath: undefined,
                    },
                  })
                }
                data={[
                  { value: DataSourceType.PRODUCT, label: 'Product' },
                  { value: DataSourceType.CATEGORY, label: 'Category' },
                  { value: DataSourceType.COLLECTION, label: 'Collection' },
                  { value: DataSourceType.CUSTOMER, label: 'Customer' },
                ]}
                style={{ minWidth: 120 }}
              />
              <Select
                size="xs"
                label="Field"
                value={content.dataBinding?.fieldPath || ''}
                onChange={(value) =>
                  onUpdateContent && onUpdateContent({ dataBinding: { ...content.dataBinding, fieldPath: value } })
                }
                data={getDataSourceFieldOptions(
                  content.dataBinding?.sourceType || DataSourceType.PRODUCT,
                  'mediaGallery'
                )}
                style={{ minWidth: 150 }}
                placeholder="Select field..."
              />
              <TextInput
                size="xs"
                label="Placeholder Image URL"
                value={content.dataBinding?.fallbackValue || ''}
                onChange={(e) =>
                  onUpdateContent &&
                  onUpdateContent({ dataBinding: { ...content.dataBinding, fallbackValue: e.target.value } })
                }
                placeholder="https://..."
                style={{ minWidth: 200 }}
              />
            </>
          )}

          <Select
            size="xs"
            label="Display Mode"
            value={content.displayMode || 'carousel1'}
            onChange={(value) => onUpdateContent && onUpdateContent({ displayMode: value })}
            data={[
              { value: 'carousel1', label: 'Carousel 1 (Thumbnails)' },
              { value: 'carousel2', label: 'Carousel 2 (Dots)' },
              { value: 'slideshow1', label: 'Slideshow 1 (Thumbnails)' },
              { value: 'slideshow2', label: 'Slideshow 2 (Dots)' },
              { value: 'grid', label: 'Grid' },
            ]}
            style={{ minWidth: 180 }}
          />
          <Select
            size="xs"
            label="Animation"
            value={content.transitionAnimation || 'slide'}
            onChange={(value) => onUpdateContent && onUpdateContent({ transitionAnimation: value })}
            data={[
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'zoom', label: 'Zoom' },
              { value: 'flip', label: 'Flip' },
              { value: 'cube', label: 'Cube' },
              { value: 'coverflow', label: 'Coverflow' },
            ]}
            style={{ minWidth: 120 }}
          />
          {displayMode === 'grid' && (
            <>
              <Select
                size="xs"
                label="Grid Columns"
                value={content.gridColumns?.toString() || 'auto'}
                onChange={(value) =>
                  onUpdateContent &&
                  onUpdateContent({ gridColumns: value === 'auto' ? 'auto' : value ? parseInt(value) : 'auto' })
                }
                data={[
                  { value: 'auto', label: 'Auto (Responsive)' },
                  { value: '1', label: '1 Column' },
                  { value: '2', label: '2 Columns' },
                  { value: '3', label: '3 Columns' },
                  { value: '4', label: '4 Columns' },
                  { value: '5', label: '5 Columns' },
                  { value: '6', label: '6 Columns' },
                ]}
                style={{ minWidth: 140 }}
              />
              <Select
                size="xs"
                label="Alignment"
                value={content.gridAlign || 'start'}
                onChange={(value) => onUpdateContent && onUpdateContent({ gridAlign: value })}
                data={[
                  { value: 'start', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'end', label: 'Right' },
                ]}
                style={{ minWidth: 100 }}
              />
            </>
          )}
          {(displayMode === 'slideshow1' || displayMode === 'slideshow2') && (
            <>
              <Switch
                size="xs"
                label="Auto Play"
                checked={content.autoPlay || false}
                onChange={(e) => onUpdateContent && onUpdateContent({ autoPlay: e.currentTarget.checked })}
              />
              {content.autoPlay && (
                <NumberInput
                  size="xs"
                  label="Interval (ms)"
                  value={content.autoPlayInterval || 3000}
                  onChange={(value) => onUpdateContent && onUpdateContent({ autoPlayInterval: value })}
                  min={1000}
                  max={10000}
                  step={500}
                  style={{ width: 120 }}
                />
              )}
            </>
          )}
        </Group>
      )}

      {items.length === 0 ? (
        <Box ta="center" p="xl" style={{ border: `2px dashed ${canvasTextColor}40` }}>
          <IconLayoutGrid size={48} style={{ color: canvasTextColor, opacity: 0.5 }} />
          <Text mt="sm" style={{ color: canvasTextColor, opacity: 0.6 }}>
            {editMode ? 'Add images or videos to your gallery' : 'No media in gallery'}
          </Text>
        </Box>
      ) : (
        <>
          {/* Carousel 1: With Thumbnails */}
          {displayMode === 'carousel1' && (
            <Box style={{ position: 'relative' }}>
              <Box
                style={{
                  position: 'relative',
                  width: '100%',
                  height: `${galleryHeight}px`,
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {items.map((item: any, idx: number) => (
                  <Box
                    key={item.id}
                    style={{
                      ...getAnimationStyle(idx),
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </Box>
                ))}

                {items.length > 1 && (
                  <>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                      onClick={() => goToPrevSlide(items.length)}
                    >
                      <IconChevronLeft size={24} />
                    </ActionIcon>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                      }}
                      onClick={() => goToNextSlide(items.length)}
                    >
                      <IconChevronRight size={24} />
                    </ActionIcon>
                  </>
                )}

                {editMode === 'edit' && (
                  <ActionIcon
                    color="red"
                    variant="filled"
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                    onClick={() => handleMediaGalleryItemRemove(items[currentMediaIndex].id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Box>

              {/* Thumbnails */}
              {items.length > 1 && (
                <Group gap="xs" mt="sm" justify="center">
                  {items.map((item: any, idx: number) => (
                    <Box
                      key={item.id}
                      onClick={() => goToSlide(idx)}
                      style={{
                        width: 80,
                        height: 50,
                        cursor: 'pointer',
                        opacity: idx === currentMediaIndex ? 1 : 0.6,
                        border:
                          idx === currentMediaIndex ? `3px solid #228be6` : '2px solid rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                      }}
                    >
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#333',
                          }}
                        >
                          <IconPlayerPlay size={20} style={{ color: 'white' }} />
                        </Box>
                      )}
                    </Box>
                  ))}
                </Group>
              )}
            </Box>
          )}

          {/* Carousel 2: With Dots Only */}
          {displayMode === 'carousel2' && (
            <Box style={{ position: 'relative' }}>
              <Box
                style={{
                  position: 'relative',
                  width: '100%',
                  height: `${galleryHeight}px`,
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {items.map((item: any, idx: number) => (
                  <Box
                    key={item.id}
                    style={{
                      ...getAnimationStyle(idx),
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </Box>
                ))}

                {items.length > 1 && (
                  <>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                      onClick={() => goToPrevSlide(items.length)}
                    >
                      <IconChevronLeft size={24} />
                    </ActionIcon>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                      }}
                      onClick={() => goToNextSlide(items.length)}
                    >
                      <IconChevronRight size={24} />
                    </ActionIcon>
                  </>
                )}

                {editMode === 'edit' && (
                  <ActionIcon
                    color="red"
                    variant="filled"
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                    onClick={() => handleMediaGalleryItemRemove(items[currentMediaIndex].id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}

                {/* Dots Navigation */}
                {items.length > 1 && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      padding: '8px 16px',
                      borderRadius: '20px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Group gap={8} justify="center">
                      {items.map((_: any, idx: number) => (
                        <Box
                          key={idx}
                          onClick={() => goToSlide(idx)}
                          style={{
                            width: idx === currentMediaIndex ? 24 : 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: idx === currentMediaIndex ? '#228be6' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                          }}
                        />
                      ))}
                    </Group>
                  </Box>
                )}
              </Box>

              {/* Resize Handle */}
              {editMode === 'edit' && (
                <Box
                  onMouseDown={handleMouseDown}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '8px',
                    cursor: 'ns-resize',
                    backgroundColor: isResizing ? 'rgba(34, 139, 230, 0.3)' : 'transparent',
                    borderTop: '2px solid rgba(34, 139, 230, 0.5)',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                  }}
                >
                  <Box
                    style={{
                      width: '40px',
                      height: '4px',
                      backgroundColor: '#228be6',
                      borderRadius: '2px',
                    }}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Slideshow 1: Auto-play with Thumbnails */}
          {displayMode === 'slideshow1' && (
            <Box style={{ position: 'relative' }}>
              <Box
                style={{
                  position: 'relative',
                  width: '100%',
                  height: `${galleryHeight}px`,
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {items.map((item: any, idx: number) => (
                  <Box
                    key={item.id}
                    style={{
                      ...getAnimationStyle(idx),
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </Box>
                ))}

                {items.length > 1 && (
                  <>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                      onClick={() => goToPrevSlide(items.length)}
                    >
                      <IconChevronLeft size={24} />
                    </ActionIcon>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                      }}
                      onClick={() => goToNextSlide(items.length)}
                    >
                      <IconChevronRight size={24} />
                    </ActionIcon>
                  </>
                )}

                {editMode === 'edit' && (
                  <ActionIcon
                    color="red"
                    variant="filled"
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                    onClick={() => handleMediaGalleryItemRemove(items[currentMediaIndex].id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Box>

              {/* Thumbnails */}
              {items.length > 1 && (
                <Group gap="xs" mt="sm" justify="center">
                  {items.map((item: any, idx: number) => (
                    <Box
                      key={item.id}
                      onClick={() => goToSlide(idx)}
                      style={{
                        width: 80,
                        height: 50,
                        cursor: 'pointer',
                        opacity: idx === currentMediaIndex ? 1 : 0.6,
                        border:
                          idx === currentMediaIndex ? `3px solid #228be6` : '2px solid rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        transition: 'all 0.2s',
                      }}
                    >
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#333',
                          }}
                        >
                          <IconPlayerPlay size={20} style={{ color: 'white' }} />
                        </Box>
                      )}
                    </Box>
                  ))}
                </Group>
              )}
            </Box>
          )}

          {/* Slideshow 2: Auto-play with Dots Only */}
          {displayMode === 'slideshow2' && (
            <Box style={{ position: 'relative' }}>
              <Box
                style={{
                  position: 'relative',
                  width: '100%',
                  height: `${galleryHeight}px`,
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {items.map((item: any, idx: number) => (
                  <Box
                    key={item.id}
                    style={{
                      ...getAnimationStyle(idx),
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </Box>
                ))}

                {items.length > 1 && (
                  <>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                      onClick={() => goToPrevSlide(items.length)}
                    >
                      <IconChevronLeft size={24} />
                    </ActionIcon>
                    <ActionIcon
                      variant="filled"
                      size="lg"
                      style={{
                        position: 'absolute',
                        right: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 10,
                      }}
                      onClick={() => goToNextSlide(items.length)}
                    >
                      <IconChevronRight size={24} />
                    </ActionIcon>
                  </>
                )}

                {editMode === 'edit' && (
                  <ActionIcon
                    color="red"
                    variant="filled"
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
                    onClick={() => handleMediaGalleryItemRemove(items[currentMediaIndex].id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}

                {/* Dots Navigation */}
                {items.length > 1 && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 10,
                      padding: '8px 16px',
                      borderRadius: '20px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Group gap={8} justify="center">
                      {items.map((_: any, idx: number) => (
                        <Box
                          key={idx}
                          onClick={() => goToSlide(idx)}
                          style={{
                            width: idx === currentMediaIndex ? 24 : 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: idx === currentMediaIndex ? '#228be6' : 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                          }}
                        />
                      ))}
                    </Group>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Grid Display */}
          {displayMode === 'grid' && (
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns:
                  content.gridColumns === 'auto' || !content.gridColumns
                    ? `repeat(auto-fill, minmax(${galleryHeight / 2}px, 1fr))`
                    : `repeat(${content.gridColumns}, minmax(0, ${galleryHeight / 2}px))`,
                gap: '12px',
                justifyContent: content.gridAlign || 'start',
              }}
            >
              {items.map((item: any) => (
                <Box
                  key={item.id}
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '100%',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#000',
                  }}
                >
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.alt || ''}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <video
                        src={item.url}
                        controls
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                    {editMode === 'edit' && (
                      <ActionIcon
                        color="red"
                        variant="filled"
                        size="sm"
                        style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}
                        onClick={() => handleMediaGalleryItemRemove(item.id)}
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {/* Resize Handle - shown at the bottom for all display modes in edit mode */}
      {editMode === 'edit' && items.length > 0 && (
        <Box
          onMouseDown={handleMouseDown}
          style={{
            marginTop: '8px',
            height: '8px',
            cursor: 'ns-resize',
            backgroundColor: isResizing ? 'rgba(34, 139, 230, 0.3)' : 'transparent',
            borderTop: '2px solid rgba(34, 139, 230, 0.5)',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            style={{
              width: '40px',
              height: '4px',
              backgroundColor: '#228be6',
              borderRadius: '2px',
            }}
          />
        </Box>
      )}
    </Box>
  );
}
