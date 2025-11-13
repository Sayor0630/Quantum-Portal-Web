import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Stack } from '@mantine/core';
import { TextBlock, ImageBlock, ButtonBlock, VideoBlock, MediaGalleryBlock, ProductAttributeSelector } from '../blocks';
import { applyBindingsToPage, BindingContext } from '../../utils/dataBindingResolver';

interface GridRendererProps {
  gridCells: any[];
  productData?: any; // Pass product data for variant handling
}

export const GridRenderer: FC<GridRendererProps> = ({ gridCells, productData }) => {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedVariantImages, setSelectedVariantImages] = useState<string[]>([]);
  const [initialGridCells, setInitialGridCells] = useState<any[]>([]);

  if (!gridCells || gridCells.length === 0) {
    return null;
  }

  const handleVariantChange = useCallback((selectedAttributes: Record<string, string>, variant: any) => {
    setSelectedVariant(variant);
    
    // Update images if variant has images
    if (variant?.images && variant.images.length > 0) {
      const variantImageUrls = variant.images.map((img: any) => img.url);
      setSelectedVariantImages(variantImageUrls);
    } else {
      setSelectedVariantImages([]);
    }
  }, []); // Empty dependencies - this function doesn't need to change

  // Re-apply bindings with variant data when variant is selected
  const processedGridCells = useMemo(() => {
    // Always apply bindings - either with base product data or variant data
    const bindingContext: BindingContext = {
      product: selectedVariant ? {
        ...productData,
        // Override with variant-specific data for TEXT bindings (price, sku, stock)
        price: selectedVariant.price,
        sku: selectedVariant.sku,
        stock: selectedVariant.stockQuantity,
        stockQuantity: selectedVariant.stockQuantity,
        isInStock: selectedVariant.stockQuantity > 0 && selectedVariant.isActive,
        hasVariants: false, // Treat as single product when variant selected
        brand: productData.brand || {},
        category: productData.category || {},
        // IMPORTANT: Keep original images for MediaGallery
        // MediaGallery will handle variant image scrolling separately
        images: productData.images,
        variants: productData.variants,
      } : {
        ...productData,
        brand: productData.brand || {},
        category: productData.category || {},
      },
    };

    if (selectedVariant) {
      console.log('=== RE-APPLYING BINDINGS WITH VARIANT ===');
      console.log('Selected variant:', selectedVariant);
      console.log('Variant price:', selectedVariant.price);
      console.log('Variant SKU:', selectedVariant.sku);
      console.log('Variant stock:', selectedVariant.stockQuantity);
      console.log('Binding context product:', bindingContext.product);
    } else {
      console.log('=== APPLYING INITIAL BINDINGS ===');
      console.log('Base product data:', bindingContext.product);
    }

    // Apply bindings to the page content
    const updatedPage = applyBindingsToPage({ gridCells }, bindingContext, false);
    
    // Store initial grid cells on first render (when no variant selected)
    if (!selectedVariant && initialGridCells.length === 0) {
      console.log('Storing initial grid cells for later use');
      setInitialGridCells(updatedPage.gridCells);
    }
    
    // When variant is selected, merge: use text blocks from updated, MediaGallery from initial
    if (selectedVariant && initialGridCells.length > 0) {
      console.log('Variant selected - merging initial MediaGallery with updated text blocks');
      
      const mergedCells = updatedPage.gridCells.map((cell: any, cellIndex: number) => {
        const initialCell = initialGridCells[cellIndex];
        if (!initialCell) return cell;
        
        const mergedBlocks = cell.blocks?.map((block: any, blockIndex: number) => {
          const initialBlock = initialCell.blocks?.[blockIndex];
          
          // For MediaGallery: merge the items from initial state but keep everything else from the updated block
          // This preserves interactivity while keeping all images
          if (block.type === 'mediaGallery' && initialBlock?.type === 'mediaGallery') {
            console.log('Merging MediaGallery block - preserving', initialBlock.content?.items?.length, 'items from initial state');
            return {
              ...block, // Keep all handlers and state from the updated block
              content: {
                ...block.content,
                items: initialBlock.content?.items || [] // Only replace items array
              }
            };
          }
          
          // Otherwise use the updated block (for text, etc.)
          return block;
        });
        
        return { ...cell, blocks: mergedBlocks };
      });
      
      return mergedCells;
    }
    
    console.log('Updated grid cells:', updatedPage.gridCells);
    
    // Log first text block to verify bindings were applied
    const firstCell = updatedPage.gridCells.find((c: any) => c.blocks && c.blocks.length > 0);
    if (firstCell) {
      const firstTextBlock = firstCell.blocks.find((b: any) => b.type === 'text');
      if (firstTextBlock) {
        console.log('First text block after binding:', firstTextBlock.content.text);
      }
      
      const mediaGalleryBlock = firstCell.blocks.find((b: any) => b.type === 'mediaGallery');
      if (mediaGalleryBlock) {
        console.log('MediaGallery items count:', mediaGalleryBlock.content?.items?.length);
      }
    }
    
    return updatedPage.gridCells;
  }, [gridCells, selectedVariant, productData]);

  // Find root cell (the one with no parent) from processed cells
  const rootCell = processedGridCells.find((cell: any) => cell.parentId === null);

  const renderCell = (cell: any): JSX.Element => {
    const hasSplit = cell.split && cell.children && cell.children.length > 0;

    if (hasSplit) {
      // This cell is split - render its children
      const child1 = processedGridCells.find((c: any) => c.cellId === cell.children[0]);
      const child2 = processedGridCells.find((c: any) => c.cellId === cell.children[1]);

      if (!child1 || !child2) {
        return <Box>Error: Missing child cells</Box>;
      }

      const isHorizontal = cell.split === 'horizontal';
      const splitRatio = cell.splitRatio || 50;

      return (
        <Box
          style={{
            display: 'flex',
            flexDirection: isHorizontal ? 'column' : 'row',
            width: '100%',
            height: '100%',
            backgroundColor: cell.backgroundColor || 'transparent',
          }}
        >
          {/* First child */}
          <Box
            style={{
              flex: `0 0 ${splitRatio}%`,
              overflow: 'hidden',
            }}
          >
            {renderCell(child1)}
          </Box>

          {/* Second child */}
          <Box
            style={{
              flex: `0 0 ${100 - splitRatio}%`,
              overflow: 'hidden',
            }}
          >
            {renderCell(child2)}
          </Box>
        </Box>
      );
    }

    // This cell has blocks - render them
    return (
      <Box
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: cell.backgroundColor || 'transparent',
          padding: `${cell.padding || 20}px`,
        }}
      >
        <Stack gap={0}>
          {cell.blocks && cell.blocks.length > 0 ? (
            cell.blocks.map((block: any) => (
              <BlockRenderer 
                key={block.blockId} 
                block={block} 
                productData={productData}
                selectedVariant={selectedVariant}
                selectedVariantImages={selectedVariantImages}
                onVariantChange={handleVariantChange}
              />
            ))
          ) : null}
        </Stack>
      </Box>
    );
  };

  return <Box style={{ width: '100%', minHeight: '100vh' }}>{renderCell(rootCell)}</Box>;
};

// Block Renderer Component
interface BlockRendererProps {
  block: any;
  productData?: any;
  selectedVariant?: any;
  selectedVariantImages?: string[];
  onVariantChange?: (selectedAttributes: Record<string, string>, variant: any) => void;
}

const BlockRenderer: FC<BlockRendererProps> = ({ 
  block, 
  productData,
  selectedVariant,
  selectedVariantImages,
  onVariantChange 
}) => {
  const { type, content } = block;
  
  // State for MediaGallery
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [previousMediaIndex, setPreviousMediaIndex] = useState(0);

  // Use the block's content (which is already processed with bindings from processedGridCells)
  const effectiveContent = { ...content };
  
  // For MediaGallery: Scroll to variant image when variant is selected
  useEffect(() => {
    if (type === 'mediaGallery' && selectedVariant && selectedVariantImages && selectedVariantImages.length > 0 && content.items && content.items.length > 0) {
      // Find the index of the first variant image in the gallery
      const firstVariantImageUrl = selectedVariantImages[0];
      const variantImageIndex = content.items.findIndex((item: any) => item.url === firstVariantImageUrl);
      
      console.log('[MediaGallery] Looking for variant image:', firstVariantImageUrl);
      console.log('[MediaGallery] Found at index:', variantImageIndex);
      console.log('[MediaGallery] Total items:', content.items.length);
      
      if (variantImageIndex !== -1 && currentMediaIndex !== variantImageIndex) {
        console.log('[MediaGallery] Scrolling from index', currentMediaIndex, 'to', variantImageIndex);
        setCurrentMediaIndex(variantImageIndex);
        setPreviousMediaIndex(currentMediaIndex);
      }
    }
  }, [selectedVariant]); // Only depend on selectedVariant, not selectedVariantImages or content.items

  return (
    <Box
      style={{
        padding: `${block.padding || 0}px`,
        backgroundColor: block.backgroundColor || 'transparent',
        width: content?.width || '100%',
        margin: '0 auto',
      }}
    >
      {type === 'text' && (
        <TextBlock
          content={effectiveContent}
          canvasTextColor="inherit"
          editMode={null}
          onUpdateContent={() => {}}
        />
      )}

      {type === 'image' && (
        <ImageBlock
          content={effectiveContent}
          canvasTextColor="inherit"
          editMode={null}
          onUpdateContent={() => {}}
        />
      )}

      {type === 'button' && (
        <ButtonBlock
          content={effectiveContent}
          editMode={null}
          onUpdateContent={() => {}}
        />
      )}

      {type === 'video' && (
        <VideoBlock
          content={effectiveContent}
          canvasTextColor="inherit"
          editMode={null}
          onUpdateContent={() => {}}
        />
      )}

      {type === 'mediaGallery' && (
        <MediaGalleryBlock
          content={effectiveContent}
          canvasTextColor="inherit"
          editMode={null}
          onUpdateContent={() => {}}
          currentMediaIndex={currentMediaIndex}
          setCurrentMediaIndex={setCurrentMediaIndex}
          previousMediaIndex={previousMediaIndex}
          setPreviousMediaIndex={setCurrentMediaIndex}
          slideDirection="right"
          setSlideDirection={() => {}}
        />
      )}

      {type === 'productAttributeSelector' && (
        <ProductAttributeSelector
          content={effectiveContent}
          productData={productData}
          onVariantChange={onVariantChange}
          editMode={null}
        />
      )}

      {!['text', 'image', 'button', 'video', 'mediaGallery', 'productAttributeSelector'].includes(type) && (
        <Box p="md" style={{ border: '1px dashed gray', borderRadius: '4px' }}>
          Block type "{type}" not yet supported in frontend
        </Box>
      )}
    </Box>
  );
};
