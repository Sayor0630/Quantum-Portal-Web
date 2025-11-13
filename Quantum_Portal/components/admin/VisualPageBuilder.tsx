'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Box,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  ColorInput,
  NumberInput,
  Switch,
  Tabs,
  Divider,
  Accordion,
  Badge,
  Container,
  Title,
  LoadingOverlay,
  FileButton,
  MultiSelect,
  JsonInput,
  useMantineColorScheme,
  Menu,
  Tooltip,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconArrowLeft,
  IconPlus,
  IconTrash,
  IconPencil,
  IconEye,
  IconCode,
  IconSettings,
  IconGripVertical,
  IconCopy,
  IconPhoto,
  IconVideo,
  IconFileText,
  IconClick,
  IconShoppingCart,
  IconX,
  IconArrowBack,
  IconArrowForward,
  IconRowInsertTop,
  IconRowInsertBottom,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconGridDots,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconPhotoPlus,
  IconPlayerPlay,
  IconLayoutGrid,
  IconChevronLeft,
  IconChevronRight,
  IconLink,
  IconUpload,
  IconCheck,
  IconAlertCircle,
  IconAdjustments,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { nanoid } from 'nanoid';

// Import standalone block components
import { TextBlock, ImageBlock, ButtonBlock, VideoBlock, MediaGalleryBlock, ProductAttributeSelector, DataSourceType, ProductFieldPath, CategoryFieldPath, getDataSourceFieldOptions, applyPreviewData } from '../blocks';
import type { DataBinding, FieldOption } from '../blocks';

// Visual Page Builder Component
export default function VisualPageBuilder() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { colorScheme } = useMantineColorScheme();
  const pageId = params?.id as string;

  const [pageData, setPageData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit');
  const [showGridInPreview, setShowGridInPreview] = useState(false); // New: Show grid lines in preview
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [showCellEditor, setShowCellEditor] = useState(false);
  const [currentEditingCell, setCurrentEditingCell] = useState<any>(null);
  
  // Grid structure
  const [gridCells, setGridCells] = useState<any[]>([
    {
      cellId: nanoid(),
      parentId: null,
      split: null, // 'horizontal' | 'vertical' | null
      splitRatio: 50, // Percentage for first child
      children: [], // Array of child cellIds if split
      blocks: [],
      backgroundColor: '',
      padding: 20,
    }
  ]);
  
  // Resizing state
  const [resizingDivider, setResizingDivider] = useState<{
    cellId: string;
    startY: number;
    startX: number;
    startRatio: number;
  } | null>(null);
  
  // Block editing state
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [currentEditingBlock, setCurrentEditingBlock] = useState<any>(null);
  const [editingBlockCellId, setEditingBlockCellId] = useState<string | null>(null);
  
  // Drag and drop state for blocks
  const [activeBlock, setActiveBlock] = useState<any>(null);
  const [dragSourceCell, setDragSourceCell] = useState<string | null>(null);
  
  // History for undo/redo
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const fetchPageData = useCallback(async () => {
    // VisualPageBuilder now requires a page ID - redirect to create page if missing
    if (!pageId) {
      notifications.show({
        title: 'No Page Selected',
        message: 'Please create a page first before accessing the page builder.',
        color: 'orange',
      });
      router.push('/admin/content/dynamic-pages/new');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/admin/dynamic-pages/${pageId}`);
      if (!response.ok) throw new Error('Failed to fetch page');
      const data = await response.json();
      
      // Ensure gridCells exists, create default if missing
      if (!data.gridCells || data.gridCells.length === 0) {
        data.gridCells = [
          {
            cellId: nanoid(),
            parentId: null,
            split: null,
            splitRatio: 50,
            children: [],
            blocks: [],
            backgroundColor: '',
            padding: 20,
          }
        ];
      }
      
      setPageData(data);
      setGridCells(data.gridCells);
      // Save initial loaded state to history
      setHistory([JSON.parse(JSON.stringify(data))]);
      setHistoryIndex(0);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchPageData();
    }
  }, [authStatus, fetchPageData]);

  // Save state to history for undo/redo
  const saveToHistory = useCallback((newPageData: any) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newPageData)));
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Helper to update pageData properties while preserving gridCells
  const updatePageDataProperty = useCallback((updates: any) => {
    const updatedData = {
      ...pageData,
      ...updates,
      gridCells: gridCells, // Always use current gridCells state
    };
    setPageData(updatedData);
  }, [pageData, gridCells]);

  // Update pageData and gridCells together, save to history
  const updatePageData = useCallback((newPageData: any, newGridCells?: any[]) => {
    const updatedData = {
      ...newPageData,
      gridCells: newGridCells || newPageData.gridCells || gridCells
    };
    saveToHistory(updatedData);
    setPageData(updatedData);
    setGridCells(updatedData.gridCells);
    setHasUnsavedChanges(true); // Mark as having unsaved changes
  }, [saveToHistory, gridCells]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = JSON.parse(JSON.stringify(history[historyIndex - 1]));
      setHistoryIndex(historyIndex - 1);
      setPageData(previousState);
      if (previousState.gridCells) {
        setGridCells(previousState.gridCells);
      }
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = JSON.parse(JSON.stringify(history[historyIndex + 1]));
      setHistoryIndex(historyIndex + 1);
      setPageData(nextState);
      if (nextState.gridCells) {
        setGridCells(nextState.gridCells);
      }
    }
  }, [history, historyIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Split a cell into two children
  const handleSplitCell = (cellId: string, orientation: 'horizontal' | 'vertical') => {
    const newCells = gridCells.map(cell => {
      if (cell.cellId === cellId) {
        // Create two new child cells
        const child1Id = nanoid();
        const child2Id = nanoid();
        
        return {
          ...cell,
          split: orientation,
          splitRatio: 50, // 50/50 split initially
          children: [child1Id, child2Id],
          blocks: [], // Move blocks to children if needed
        };
      }
      return cell;
    });
    
    // Add the two new child cells
    const parentCell = gridCells.find(c => c.cellId === cellId);
    if (parentCell) {
      const child1Id = newCells.find(c => c.cellId === cellId)?.children[0];
      const child2Id = newCells.find(c => c.cellId === cellId)?.children[1];
      
      if (child1Id && child2Id) {
        newCells.push({
          cellId: child1Id,
          parentId: cellId,
          split: null,
          splitRatio: 50,
          children: [],
          blocks: [...(parentCell.blocks || [])], // Inherit parent's blocks in first child
          backgroundColor: parentCell.backgroundColor || '',
          padding: parentCell.padding || 20,
        });
        
        newCells.push({
          cellId: child2Id,
          parentId: cellId,
          split: null,
          splitRatio: 50,
          children: [],
          blocks: [],
          backgroundColor: '',
          padding: 20,
        });
      }
    }
    
    updatePageData({ ...pageData, gridCells: newCells });
    notifications.show({ 
      message: `Cell split ${orientation === 'horizontal' ? 'horizontally' : 'vertically'}`, 
      color: 'green' 
    });
  };

  // Handle divider drag start
  const handleDividerMouseDown = (cellId: string, e: React.MouseEvent, containerSize: number) => {
    e.stopPropagation();
    const cell = gridCells.find((c: any) => c.cellId === cellId);
    if (!cell) return;
    
    setResizingDivider({ 
      cellId, 
      startX: e.clientX, 
      startY: e.clientY,
      startRatio: cell.splitRatio || 50
    });
    
    // Store container size for accurate percentage calculation
    (window as any).__resizeContainerSize = containerSize;
  };

  // Handle divider drag
  const handleDividerMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingDivider) return;
    
    const cell = gridCells.find((c: any) => c.cellId === resizingDivider.cellId);
    if (!cell || !cell.split) return;
    
    const containerSize = (window as any).__resizeContainerSize || 1000;
    
    const deltaX = e.clientX - resizingDivider.startX;
    const deltaY = e.clientY - resizingDivider.startY;
    
    // Calculate new split ratio based on actual pixel movement
    const delta = cell.split === 'horizontal' ? deltaY : deltaX;
    const percentChange = (delta / containerSize) * 100;
    const newRatio = Math.max(10, Math.min(90, resizingDivider.startRatio + percentChange));
    
    const newCells = gridCells.map((c: any) =>
      c.cellId === cell.cellId ? { ...c, splitRatio: newRatio } : c
    );
    
    setGridCells(newCells);
  }, [resizingDivider, gridCells]);

  // Handle divider drag end
  const handleDividerMouseUp = useCallback(() => {
    if (resizingDivider) {
      updatePageData({ ...pageData, gridCells });
      setResizingDivider(null);
    }
  }, [resizingDivider, gridCells, pageData, updatePageData]);

  // Attach global mouse handlers for divider dragging
  useEffect(() => {
    if (resizingDivider) {
      window.addEventListener('mousemove', handleDividerMouseMove);
      window.addEventListener('mouseup', handleDividerMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleDividerMouseMove);
        window.removeEventListener('mouseup', handleDividerMouseUp);
        delete (window as any).__resizeContainerSize;
      };
    }
  }, [resizingDivider, handleDividerMouseMove, handleDividerMouseUp]);

  // Add a new root cell
  const handleAddCell = () => {
    const newCell = {
      cellId: nanoid(),
      parentId: null,
      split: null,
      splitRatio: 50,
      children: [],
      blocks: [],
      backgroundColor: '',
      padding: 20,
    };
    
    const newCells = [...gridCells, newCell];
    updatePageData({ ...pageData, gridCells: newCells });
    notifications.show({ message: 'Cell added', color: 'green' });
  };

  // Delete cell (and all its children recursively)
  const handleDeleteCell = (cellId: string) => {
    // Find all descendant cells recursively
    const getDescendants = (id: string): string[] => {
      const cell = gridCells.find((c: any) => c.cellId === id);
      if (!cell || !cell.children || cell.children.length === 0) return [id];
      
      return [id, ...cell.children.flatMap((childId: string) => getDescendants(childId))];
    };
    
    const cellsToDelete = getDescendants(cellId);
    let newCells = gridCells.filter((c: any) => !cellsToDelete.includes(c.cellId));
    
    // If this cell had a parent, we need to handle that
    const cell = gridCells.find((c: any) => c.cellId === cellId);
    if (cell?.parentId) {
      const parent = gridCells.find((c: any) => c.cellId === cell.parentId);
      if (parent && parent.children) {
        // Remove this child from parent's children array
        const remainingChildren = parent.children.filter((id: string) => id !== cellId);
        
        // If parent now has only one child, collapse it by merging the child into the parent
        if (remainingChildren.length === 1) {
          const remainingChildId = remainingChildren[0];
          const remainingChild = newCells.find((c: any) => c.cellId === remainingChildId);
          
          if (remainingChild) {
            // Merge the remaining child's properties into the parent
            newCells = newCells
              .filter((c: any) => c.cellId !== remainingChildId) // Remove the child
              .map((c: any) => 
                c.cellId === parent.cellId 
                  ? { 
                      ...c,
                      split: remainingChild.split,
                      splitRatio: remainingChild.splitRatio,
                      children: remainingChild.children,
                      blocks: remainingChild.blocks,
                      backgroundColor: remainingChild.backgroundColor,
                      padding: remainingChild.padding,
                    }
                  : c.cellId === parent.cellId || (remainingChild.children && remainingChild.children.includes(c.cellId))
                  ? { ...c, parentId: parent.cellId } // Update grandchildren's parent reference
                  : c
              );
          }
        } else {
          // More than one child remains, just update the parent's children array
          newCells = newCells.map((c: any) =>
            c.cellId === parent.cellId ? { ...c, children: remainingChildren } : c
          );
        }
      }
    }
    
    updatePageData({ ...pageData, gridCells: newCells });
    notifications.show({ message: 'Cell deleted', color: 'green' });
  };

  // Edit cell
  const handleEditCell = (cell: any) => {
    setCurrentEditingCell(cell);
    setShowCellEditor(true);
  };

  // Update cell
  const handleUpdateCell = (updates: any) => {
    const newCells = gridCells.map(c =>
      c.cellId === currentEditingCell.cellId ? { ...c, ...updates } : c
    );
    updatePageData({ ...pageData, gridCells: newCells });
    setShowCellEditor(false);
    setCurrentEditingCell(null);
    notifications.show({ message: 'Cell updated', color: 'green' });
  };

  // Add block to cell
  const handleAddBlockToCell = (cellId: string, blockType: string) => {
    const newCells = gridCells.map((cell: any) => {
      if (cell.cellId === cellId) {
        const newBlock = {
          blockId: nanoid(),
          type: blockType,
          content: getDefaultBlockContent(blockType),
          padding: 20,
        };
        console.log('Adding block to cell:', cellId, 'Block:', newBlock);
        return {
          ...cell,
          blocks: [
            ...(cell.blocks || []),
            newBlock,
          ],
        };
      }
      return cell;
    });
    console.log('Updated cells after adding block:', newCells);
    updatePageData({ ...pageData, gridCells: newCells });
    notifications.show({ message: `${blockType} block added`, color: 'green' });
  };

  // Edit block
  const handleEditBlock = (cellId: string, block: any) => {
    setCurrentEditingBlock(block);
    setEditingBlockCellId(cellId);
    setShowBlockEditor(true);
  };

  // Update block
  const handleUpdateBlock = (updates: any) => {
    if (!editingBlockCellId || !currentEditingBlock) return;
    
    const newCells = gridCells.map((cell: any) => {
      if (cell.cellId === editingBlockCellId) {
        return {
          ...cell,
          blocks: cell.blocks.map((block: any) =>
            block.blockId === currentEditingBlock.blockId ? { ...block, ...updates } : block
          ),
        };
      }
      return cell;
    });
    
    updatePageData({ ...pageData, gridCells: newCells });
    setShowBlockEditor(false);
    setCurrentEditingBlock(null);
    setEditingBlockCellId(null);
    notifications.show({ message: 'Block updated', color: 'green' });
  };

  // Delete block
  const handleDeleteBlock = (cellId: string, blockId: string) => {
    const newCells = gridCells.map((cell: any) => {
      if (cell.cellId === cellId) {
        return {
          ...cell,
          blocks: cell.blocks.filter((block: any) => block.blockId !== blockId),
        };
      }
      return cell;
    });
    
    updatePageData({ ...pageData, gridCells: newCells });
    notifications.show({ message: 'Block deleted', color: 'green' });
  };

  // Update block content inline
  const handleUpdateBlockContent = (cellId: string, blockId: string, contentUpdates: any) => {
    const newCells = gridCells.map((cell: any) => {
      if (cell.cellId === cellId) {
        return {
          ...cell,
          blocks: cell.blocks.map((block: any) =>
            block.blockId === blockId
              ? { ...block, content: { ...block.content, ...contentUpdates } }
              : block
          ),
        };
      }
      return cell;
    });
    
    updatePageData({ ...pageData, gridCells: newCells });
  };

  // Drag and drop handlers for blocks
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const blockData = active.data.current;
    if (blockData) {
      setActiveBlock(blockData.block);
      setDragSourceCell(blockData.cellId);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // We can add visual feedback here if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveBlock(null);
    setDragSourceCell(null);
    
    if (!over || !active.data.current) {
      return;
    }

    const sourceData = active.data.current;
    const targetData = over.data.current;
    
    if (!sourceData || !sourceData.block) {
      return;
    }
    
    const sourceCellId = sourceData.cellId;
    const sourceIndex = sourceData.index;
    const sourceBlockId = sourceData.block.blockId;
    
    // Determine target cell and index
    let targetCellId: string;
    let targetIndex: number;
    
    if (targetData && targetData.cellId) {
      // Dropped on another block
      targetCellId = targetData.cellId;
      targetIndex = targetData.index;
    } else {
      // Dropped on empty space or cell - treat 'over.id' as cellId
      targetCellId = over.id as string;
      const targetCell = gridCells.find((c: any) => c.cellId === targetCellId);
      targetIndex = targetCell?.blocks?.length || 0;
    }

    // Same cell reordering
    if (sourceCellId === targetCellId) {
      if (sourceIndex === targetIndex) {
        return; // No change
      }
      
      const newCells = gridCells.map((cell: any) => {
        if (cell.cellId === sourceCellId) {
          const newBlocks = arrayMove(cell.blocks, sourceIndex, targetIndex);
          return { ...cell, blocks: newBlocks };
        }
        return cell;
      });
      
      updatePageData({ ...pageData, gridCells: newCells });
      notifications.show({ message: 'Block reordered', color: 'blue' });
    } 
    // Move between cells
    else {
      const block = sourceData.block;
      
      const newCells = gridCells.map((cell: any) => {
        // Remove from source cell
        if (cell.cellId === sourceCellId) {
          return {
            ...cell,
            blocks: cell.blocks.filter((b: any) => b.blockId !== sourceBlockId),
          };
        }
        // Add to target cell
        if (cell.cellId === targetCellId) {
          const newBlocks = [...cell.blocks];
          newBlocks.splice(targetIndex, 0, block);
          return {
            ...cell,
            blocks: newBlocks,
          };
        }
        return cell;
      });
      
      updatePageData({ ...pageData, gridCells: newCells });
      notifications.show({ message: 'Block moved to another cell', color: 'green' });
    }
  };

  const handleSave = async () => {
    if (!pageData) return;
    
    // Validate required fields
    if (!pageData.title || !pageData.slug) {
      notifications.show({ 
        title: 'Validation Error', 
        message: 'Title and Slug are required', 
        color: 'red' 
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Always updating an existing page (no create mode)
      const url = `/api/admin/dynamic-pages/${pageId}`;
      
      // Ensure gridCells are included in the save payload
      const savePayload = {
        ...pageData,
        gridCells: gridCells, // Use the current gridCells state
      };
      
      console.log('=== SAVING PAGE ===');
      console.log('GridCells count:', savePayload.gridCells?.length);
      console.log('GridCells data:', JSON.stringify(savePayload.gridCells, null, 2));
      console.log('Full payload keys:', Object.keys(savePayload));
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save');
      }
      
      const saved = await response.json();
      
      console.log('=== SAVE RESPONSE ===');
      console.log('Response _debug:', saved._debug);
      console.log('Response gridCells count:', saved.gridCells?.length);
      console.log('Response has gridCells field:', 'gridCells' in saved);
      console.log('Full response keys:', Object.keys(saved));
      
      // Update local state with saved data
      const updatedPageData = {
        ...saved,
        gridCells: saved.gridCells || gridCells, // Ensure gridCells are preserved
      };
      setPageData(updatedPageData);
      setGridCells(updatedPageData.gridCells);
      setHasUnsavedChanges(false); // Clear unsaved changes flag
      
      notifications.show({ 
        title: 'Saved', 
        message: 'Page saved successfully', 
        color: 'green',
        autoClose: 2000,
      });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !pageData) {
    return <LoadingOverlay visible />;
  }

  // Calculate theme colors based on settings
  const themeMode = pageData.pageSettings?.themeMode || 'inherit';
  const isDarkMode = colorScheme === 'dark';
  let canvasBackgroundColor = '#ffffff';
  let canvasTextColor = '#000000';

  if (themeMode === 'custom') {
    // Use custom colors based on current color scheme
    if (isDarkMode) {
      canvasBackgroundColor = pageData.pageSettings?.customTheme?.dark?.backgroundColor || '#1a1b1e';
      canvasTextColor = pageData.pageSettings?.customTheme?.dark?.textColor || '#ffffff';
    } else {
      canvasBackgroundColor = pageData.pageSettings?.customTheme?.light?.backgroundColor || '#ffffff';
      canvasTextColor = pageData.pageSettings?.customTheme?.light?.textColor || '#000000';
    }
  } else {
    // Inherit mode - use admin panel's current theme colors
    if (isDarkMode) {
      canvasBackgroundColor = '#1a1b1e'; // Mantine's default dark background
      canvasTextColor = '#c1c2c5'; // Mantine's default dark text
    } else {
      canvasBackgroundColor = '#ffffff';
      canvasTextColor = '#000000';
    }
  }

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Toolbar */}
      <Paper shadow="sm" p="md" style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: '#4c6ef5' }}>
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" onClick={() => router.push('/admin/content/dynamic-pages')} style={{ color: 'white' }}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap={4}>
                <Text fw={600} size="lg" c="white">
                  {pageData.title}
                </Text>
                {hasUnsavedChanges && (
                  <Badge size="sm" color="yellow" variant="filled">
                    Unsaved
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="white" opacity={0.9}>
                🎨 NEW Visual Page Builder
              </Text>
            </div>
          </Group>
          <Group>
            <Tooltip label="Undo (Ctrl+Z)">
              <ActionIcon onClick={handleUndo} disabled={historyIndex <= 0} variant="light" color="white">
                <IconArrowBack size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Redo (Ctrl+Y)">
              <ActionIcon onClick={handleRedo} disabled={historyIndex >= history.length - 1} variant="light" color="white">
                <IconArrowForward size={18} />
              </ActionIcon>
            </Tooltip>
            <Button onClick={() => setShowPageSettings(true)} leftSection={<IconSettings size={16} />} variant="light" color="white">
              Page Settings
            </Button>
            <Button variant={editMode === 'edit' ? 'white' : 'light'} size="sm" onClick={() => setEditMode('edit')} leftSection={<IconPencil size={16} />} color={editMode === 'edit' ? 'blue' : 'white'}>
              Edit
            </Button>
            <Button variant={editMode === 'preview' ? 'white' : 'light'} size="sm" onClick={() => setEditMode('preview')} leftSection={<IconEye size={16} />} color={editMode === 'preview' ? 'blue' : 'white'}>
              Preview
            </Button>
            {editMode === 'preview' && (
              <Button 
                variant={showGridInPreview ? 'white' : 'light'} 
                size="sm" 
                onClick={() => setShowGridInPreview(!showGridInPreview)} 
                leftSection={<IconLayoutGrid size={16} />} 
                color={showGridInPreview ? 'blue' : 'white'}
              >
                {showGridInPreview ? 'Grid ON' : 'Grid OFF'}
              </Button>
            )}
            <Button onClick={handleSave} loading={isSaving} leftSection={<IconDeviceFloppy size={16} />} variant="white" color="blue">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Canvas Area */}
      <Box style={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5', position: 'relative' }}>
        {/* Usable Space Indicator */}
        {editMode === 'edit' && (
          <Box
            style={{
              position: 'absolute',
              top: `${pageData.pageSettings?.pageMargins?.top || 0}px`,
              bottom: `${pageData.pageSettings?.pageMargins?.bottom || 0}px`,
              left: `${pageData.pageSettings?.pageMargins?.left || 0}px`,
              right: `${pageData.pageSettings?.pageMargins?.right || 0}px`,
              border: '2px dashed rgba(34, 139, 230, 0.4)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {/* Top Label */}
            <Text
              size="xs"
              style={{
                position: 'absolute',
                top: -20,
                left: 0,
                color: 'rgba(34, 139, 230, 0.8)',
                fontWeight: 600,
                backgroundColor: '#f5f5f5',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Usable Space
            </Text>
            {/* Margin Labels */}
            {pageData.pageSettings?.pageMargins?.top > 0 && (
              <Text
                size="xs"
                style={{
                  position: 'absolute',
                  top: -20,
                  right: 0,
                  color: 'rgba(34, 139, 230, 0.7)',
                  backgroundColor: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                ↑ {pageData.pageSettings.pageMargins.top}px
              </Text>
            )}
            {pageData.pageSettings?.pageMargins?.bottom > 0 && (
              <Text
                size="xs"
                style={{
                  position: 'absolute',
                  bottom: -20,
                  right: 0,
                  color: 'rgba(34, 139, 230, 0.7)',
                  backgroundColor: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                ↓ {pageData.pageSettings.pageMargins.bottom}px
              </Text>
            )}
            {pageData.pageSettings?.pageMargins?.left > 0 && (
              <Text
                size="xs"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: -45,
                  transform: 'translateY(-50%)',
                  color: 'rgba(34, 139, 230, 0.7)',
                  backgroundColor: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                ← {pageData.pageSettings.pageMargins.left}px
              </Text>
            )}
            {pageData.pageSettings?.pageMargins?.right > 0 && (
              <Text
                size="xs"
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: -45,
                  transform: 'translateY(-50%)',
                  color: 'rgba(34, 139, 230, 0.7)',
                  backgroundColor: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                → {pageData.pageSettings.pageMargins.right}px
              </Text>
            )}
          </Box>
        )}
        
        <Box 
          ref={canvasRef}
          style={{ 
            backgroundColor: canvasBackgroundColor, 
            color: canvasTextColor,
            minHeight: '600px',
            height: '100%',
            paddingTop: `${pageData.pageSettings?.pageMargins?.top || 0}px`,
            paddingBottom: `${pageData.pageSettings?.pageMargins?.bottom || 0}px`,
            paddingLeft: `${pageData.pageSettings?.pageMargins?.left || 0}px`,
            paddingRight: `${pageData.pageSettings?.pageMargins?.right || 0}px`,
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Wrap with DndContext for block drag & drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Render root cells recursively */}
            {gridCells.filter(cell => !cell.parentId).map((cell) => (
              <RecursiveCell
                key={cell.cellId}
                cell={cell}
                allCells={gridCells}
                editMode={editMode}
                showGridInPreview={showGridInPreview}
                canvasTextColor={canvasTextColor}
                colorScheme={colorScheme}
                onEdit={handleEditCell}
                onDelete={handleDeleteCell}
                onAddBlock={handleAddBlockToCell}
                onSplit={handleSplitCell}
                onDividerMouseDown={handleDividerMouseDown}
                onEditBlock={handleEditBlock}
                onDeleteBlock={handleDeleteBlock}
                onUpdateBlockContent={handleUpdateBlockContent}
              />
            ))}

            {gridCells.length === 0 && (
              <Paper p="xl" ta="center" style={{ backgroundColor: 'transparent', border: `2px dashed ${canvasTextColor}40`, margin: '40px' }}>
                <Text size="lg" mb="md" style={{ color: canvasTextColor, opacity: 0.6 }}>
                  Your canvas is empty
                </Text>
                <Text size="sm" mb="lg" style={{ color: canvasTextColor, opacity: 0.5 }}>
                  Add your first cell to get started
                </Text>
                <Button 
                  onClick={handleAddCell} 
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  color="blue"
                >
                  Add Cell
                </Button>
              </Paper>
            )}
            
            {/* Drag Overlay */}
            <DragOverlay>
              {activeBlock ? (
                <Paper p="md" shadow="lg" withBorder>
                  <BlockPreview block={activeBlock} canvasTextColor={canvasTextColor} editMode={false} />
                </Paper>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Box>
      </Box>

      {/* Cell Editor Modal */}
      <Modal
        opened={showCellEditor}
        onClose={() => {
          setShowCellEditor(false);
          setCurrentEditingCell(null);
        }}
        title="Edit Grid Cell"
        size="md"
      >
        {currentEditingCell && (
          <Stack gap="md">
            <ColorInput
              label="Background Color"
              value={currentEditingCell.backgroundColor || ''}
              onChange={(value) =>
                setCurrentEditingCell({ ...currentEditingCell, backgroundColor: value })
              }
            />
            <NumberInput
              label="Padding"
              value={currentEditingCell.padding || 20}
              onChange={(value) =>
                setCurrentEditingCell({ ...currentEditingCell, padding: value })
              }
              suffix=" px"
              min={0}
            />
            <Button
              onClick={() => handleUpdateCell(currentEditingCell)}
              fullWidth
            >
              Save Cell
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Block Editor Modal */}
      <Modal
        opened={showBlockEditor}
        onClose={() => {
          setShowBlockEditor(false);
          setCurrentEditingBlock(null);
          setEditingBlockCellId(null);
        }}
        title={`Edit ${currentEditingBlock?.type || 'Block'}`}
        size="lg"
      >
        {currentEditingBlock && (
          <BlockEditor 
            block={currentEditingBlock}
            onUpdate={handleUpdateBlock}
            onClose={() => {
              setShowBlockEditor(false);
              setCurrentEditingBlock(null);
              setEditingBlockCellId(null);
            }}
          />
        )}
      </Modal>

      {/* Page Settings Modal */}
      <Modal
        opened={showPageSettings}
        onClose={() => setShowPageSettings(false)}
        title="Page Settings"
        size="lg"
      >
        <Stack>
          <Tabs defaultValue="basic">
            <Tabs.List>
              <Tabs.Tab value="basic">Basic Info</Tabs.Tab>
              <Tabs.Tab value="seo">SEO</Tabs.Tab>
              <Tabs.Tab value="theme">Theme</Tabs.Tab>
              <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Stack>
                <TextInput
                  label="Page Title"
                  required
                  value={pageData.title}
                  onChange={(e) => updatePageDataProperty({ title: e.target.value })}
                  placeholder="Enter page title"
                />
                <TextInput
                  label="Slug"
                  required
                  value={pageData.slug}
                  onChange={(e) => updatePageDataProperty({ slug: e.target.value })}
                  placeholder="page-url-slug"
                  description="URL-friendly version of the page name"
                />
                <Textarea
                  label="Description"
                  value={pageData.description}
                  onChange={(e) => updatePageDataProperty({ description: e.target.value })}
                  placeholder="Brief description of this page"
                  minRows={3}
                />
                <Select
                  label="Page Type"
                  value={pageData.pageType}
                  onChange={(value) => updatePageDataProperty({ pageType: value })}
                  data={[
                    { value: 'landing', label: 'Landing Page' },
                    { value: 'content', label: 'Content Page' },
                    { value: 'category', label: 'Category Page' },
                    { value: 'brand', label: 'Brand Page' },
                    { value: 'custom', label: 'Custom Page' },
                  ]}
                />
                <Switch
                  label="Publish this page"
                  checked={pageData.isPublished}
                  onChange={(e) => updatePageDataProperty({ isPublished: e.target.checked })}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="seo" pt="md">
              <Stack>
                <TextInput
                  label="SEO Title"
                  value={pageData.seoTitle}
                  onChange={(e) => updatePageDataProperty({ seoTitle: e.target.value })}
                  placeholder="Leave empty to use page title"
                />
                <Textarea
                  label="SEO Description"
                  value={pageData.seoDescription}
                  onChange={(e) => updatePageDataProperty({ seoDescription: e.target.value })}
                  placeholder="Meta description for search engines"
                  minRows={3}
                  maxLength={160}
                />
                <Text size="xs" c="dimmed">
                  {pageData.seoDescription?.length || 0}/160 characters
                </Text>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="theme" pt="md">
              <Stack>
                <Select
                  label="Theme Mode"
                  description="Choose how this page handles color themes"
                  value={pageData.pageSettings?.themeMode || 'inherit'}
                  onChange={(value) =>
                    updatePageDataProperty({
                      pageSettings: { 
                        ...pageData.pageSettings, 
                        themeMode: value || 'inherit',
                        customTheme: pageData.pageSettings?.customTheme || {
                          light: { backgroundColor: '#ffffff', textColor: '#000000' },
                          dark: { backgroundColor: '#1a1b1e', textColor: '#ffffff' },
                        },
                      },
                    })
                  }
                  data={[
                    { value: 'inherit', label: 'Inherit from Admin Panel Theme' },
                    { value: 'custom', label: 'Custom Theme Colors' },
                  ]}
                />

                {pageData.pageSettings?.themeMode === 'custom' && (
                  <>
                    <Divider label="Light Mode Colors" labelPosition="center" mt="md" />
                    <Group grow>
                      <ColorInput
                        label="Background Color"
                        value={pageData.pageSettings?.customTheme?.light?.backgroundColor || '#ffffff'}
                        onChange={(value) =>
                          updatePageDataProperty({
                            pageSettings: {
                              ...pageData.pageSettings,
                              customTheme: {
                                ...pageData.pageSettings?.customTheme,
                                light: {
                                  ...pageData.pageSettings?.customTheme?.light,
                                  backgroundColor: value,
                                },
                              },
                            },
                          })
                        }
                      />
                      <ColorInput
                        label="Text Color"
                        value={pageData.pageSettings?.customTheme?.light?.textColor || '#000000'}
                        onChange={(value) =>
                          updatePageDataProperty({
                            pageSettings: {
                              ...pageData.pageSettings,
                              customTheme: {
                                ...pageData.pageSettings?.customTheme,
                                light: {
                                  ...pageData.pageSettings?.customTheme?.light,
                                  textColor: value,
                                },
                              },
                            },
                          })
                        }
                      />
                    </Group>

                    <Divider label="Dark Mode Colors" labelPosition="center" mt="md" />
                    <Group grow>
                      <ColorInput
                        label="Background Color"
                        value={pageData.pageSettings?.customTheme?.dark?.backgroundColor || '#1a1b1e'}
                        onChange={(value) =>
                          updatePageDataProperty({
                            pageSettings: {
                              ...pageData.pageSettings,
                              customTheme: {
                                ...pageData.pageSettings?.customTheme,
                                dark: {
                                  ...pageData.pageSettings?.customTheme?.dark,
                                  backgroundColor: value,
                                },
                              },
                            },
                          })
                        }
                      />
                      <ColorInput
                        label="Text Color"
                        value={pageData.pageSettings?.customTheme?.dark?.textColor || '#ffffff'}
                        onChange={(value) =>
                          updatePageDataProperty({
                            pageSettings: {
                              ...pageData.pageSettings,
                              customTheme: {
                                ...pageData.pageSettings?.customTheme,
                                dark: {
                                  ...pageData.pageSettings?.customTheme?.dark,
                                  textColor: value,
                                },
                              },
                            },
                          })
                        }
                      />
                    </Group>

                    <Text size="xs" c="dimmed" mt="sm">
                      💡 These colors will be applied to the page when viewed on the frontend. Segment backgrounds can override these.
                    </Text>
                  </>
                )}

                {pageData.pageSettings?.themeMode === 'inherit' && (
                  <Text size="sm" c="dimmed" mt="sm">
                    ✓ This page will automatically use the admin panel's current theme (light or dark mode).
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="advanced" pt="md">
              <Stack>
                <Switch
                  label="Show Header"
                  checked={pageData.pageSettings?.headerVisible ?? true}
                  onChange={(e) =>
                    updatePageDataProperty({
                      pageSettings: { ...pageData.pageSettings, headerVisible: e.target.checked },
                    })
                  }
                />
                <Switch
                  label="Show Footer"
                  checked={pageData.pageSettings?.footerVisible ?? true}
                  onChange={(e) =>
                    updatePageDataProperty({
                      pageSettings: { ...pageData.pageSettings, footerVisible: e.target.checked },
                    })
                  }
                />

                <Divider label="Page Margins (Usable Space)" labelPosition="center" mt="md" />
                <Text size="xs" c="dimmed">
                  Define the usable space within the page. All segments will be contained within these margins.
                </Text>
                <Group grow>
                  <NumberInput
                    label="Top Margin"
                    value={pageData.pageSettings?.pageMargins?.top || 0}
                    onChange={(value) =>
                      updatePageDataProperty({
                        pageSettings: {
                          ...pageData.pageSettings,
                          pageMargins: {
                            ...pageData.pageSettings?.pageMargins,
                            top: value,
                          },
                        },
                      })
                    }
                    suffix=" px"
                    min={0}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Bottom Margin"
                    value={pageData.pageSettings?.pageMargins?.bottom || 0}
                    onChange={(value) =>
                      updatePageDataProperty({
                        pageSettings: {
                          ...pageData.pageSettings,
                          pageMargins: {
                            ...pageData.pageSettings?.pageMargins,
                            bottom: value,
                          },
                        },
                      })
                    }
                    suffix=" px"
                    min={0}
                    placeholder="0"
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Left Margin"
                    value={pageData.pageSettings?.pageMargins?.left || 0}
                    onChange={(value) =>
                      updatePageDataProperty({
                        pageSettings: {
                          ...pageData.pageSettings,
                          pageMargins: {
                            ...pageData.pageSettings?.pageMargins,
                            left: value,
                          },
                        },
                      })
                    }
                    suffix=" px"
                    min={0}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Right Margin"
                    value={pageData.pageSettings?.pageMargins?.right || 0}
                    onChange={(value) =>
                      updatePageDataProperty({
                        pageSettings: {
                          ...pageData.pageSettings,
                          pageMargins: {
                            ...pageData.pageSettings?.pageMargins,
                            right: value,
                          },
                        },
                      })
                    }
                    suffix=" px"
                    min={0}
                    placeholder="0"
                  />
                </Group>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setShowPageSettings(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// Grid Cell Component
// Recursive Cell Component for nested grid cells
function RecursiveCell({ 
  cell, 
  allCells, 
  editMode,
  showGridInPreview = false,
  canvasTextColor,
  colorScheme,
  onEdit, 
  onDelete, 
  onAddBlock, 
  onSplit,
  onDividerMouseDown,
  onEditBlock,
  onDeleteBlock,
  onUpdateBlockContent
}: any) {
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const BLOCK_TYPES = [
    { value: 'text', label: 'Text', icon: IconFileText },
    { value: 'mediaGallery', label: 'Media Gallery', icon: IconLayoutGrid },
    { value: 'button', label: 'Button', icon: IconClick },
    { value: 'productAttributeSelector', label: 'Product Attributes', icon: IconAdjustments },
    { value: 'productList', label: 'Products', icon: IconShoppingCart },
  ];

  // Get the current cell from allCells to ensure we have the latest state
  const currentCell = allCells.find((c: any) => c.cellId === cell.cellId) || cell;
  console.log('RecursiveCell rendering cell:', currentCell.cellId, 'blocks:', currentCell.blocks);

  // Create callbacks with currentCell to ensure we're using the latest cell ID
  const handleEdit = () => onEdit(currentCell);
  const handleDelete = () => onDelete(currentCell.cellId);
  const handleAddBlock = (blockType: string) => {
    console.log('handleAddBlock called for cell:', currentCell.cellId, 'blockType:', blockType);
    onAddBlock(currentCell.cellId, blockType);
  };
  const handleSplit = (orientation: 'horizontal' | 'vertical') => {
    onSplit(currentCell.cellId, orientation);
  };

  // Get child cells if this cell is split
  const children = currentCell.children && currentCell.children.length > 0
    ? currentCell.children.map((childId: string) => allCells.find((c: any) => c.cellId === childId))
    : [];

  // If cell is split, render it as a container with divider
  if (currentCell.split && children.length === 2) {
    const handleDividerStart = (e: React.MouseEvent) => {
      if (containerRef.current) {
        const containerSize = currentCell.split === 'horizontal' 
          ? containerRef.current.offsetHeight 
          : containerRef.current.offsetWidth;
        onDividerMouseDown(currentCell.cellId, e, containerSize);
      }
    };

    return (
      <Box
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: currentCell.split === 'horizontal' ? 'column' : 'row',
          position: 'relative',
          height: '100%',
          width: '100%',
        }}
      >
        {/* First child */}
        <Box
          style={{
            [currentCell.split === 'horizontal' ? 'height' : 'width']: `${currentCell.splitRatio}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <RecursiveCell
            cell={children[0]}
            allCells={allCells}
            editMode={editMode}
            showGridInPreview={showGridInPreview}
            canvasTextColor={canvasTextColor}
            colorScheme={colorScheme}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddBlock={onAddBlock}
            onSplit={onSplit}
            onDividerMouseDown={onDividerMouseDown}
            onEditBlock={onEditBlock}
            onDeleteBlock={onDeleteBlock}
            onUpdateBlockContent={onUpdateBlockContent}
          />
        </Box>

        {/* Divider - Show in edit mode OR preview with grid enabled */}
        {(editMode === 'edit' || (editMode === 'preview' && showGridInPreview)) && (
          <Box
            onMouseDown={handleDividerStart}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = showGridInPreview ? 'rgba(76, 110, 245, 0.6)' : 'rgba(34, 139, 230, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = showGridInPreview ? 'rgba(76, 110, 245, 0.3)' : 'rgba(34, 139, 230, 0.3)';
            }}
            style={{
              // In grid preview mode, use absolute positioning to overlay instead of taking space
              position: showGridInPreview ? 'absolute' : 'relative',
              [currentCell.split === 'horizontal' ? 'top' : 'left']: showGridInPreview ? `calc(${currentCell.splitRatio}% - 3px)` : undefined,
              [currentCell.split === 'horizontal' ? 'left' : 'top']: showGridInPreview ? 0 : undefined,
              [currentCell.split === 'horizontal' ? 'width' : 'height']: showGridInPreview ? '100%' : undefined,
              [currentCell.split === 'horizontal' ? 'height' : 'width']: showGridInPreview ? '6px' : '4px',
              backgroundColor: showGridInPreview ? 'rgba(76, 110, 245, 0.3)' : 'rgba(34, 139, 230, 0.3)',
              cursor: currentCell.split === 'horizontal' ? 'row-resize' : 'col-resize',
              zIndex: 10,
              flexShrink: showGridInPreview ? undefined : 0,
              transition: 'background-color 0.2s',
            }}
          />
        )}

        {/* Second child */}
        <Box
          style={{
            [currentCell.split === 'horizontal' ? 'height' : 'width']: `${100 - currentCell.splitRatio}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <RecursiveCell
            cell={children[1]}
            allCells={allCells}
            editMode={editMode}
            showGridInPreview={showGridInPreview}
            canvasTextColor={canvasTextColor}
            colorScheme={colorScheme}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddBlock={onAddBlock}
            onSplit={onSplit}
            onDividerMouseDown={onDividerMouseDown}
            onEditBlock={onEditBlock}
            onDeleteBlock={onDeleteBlock}
            onUpdateBlockContent={onUpdateBlockContent}
          />
        </Box>
      </Box>
    );
  }

  // Otherwise, render as a leaf cell with content
  // Determine if we should show grid controls
  const showGridControls = editMode === 'edit' || (editMode === 'preview' && showGridInPreview);
  // In grid preview mode, only show controls on hover
  const shouldShowControls = editMode === 'edit' || (showGridInPreview && isHovered);
  
  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: 1,
        height: '100%',
        width: '100%',
        backgroundColor: editMode === 'preview' && !showGridInPreview ? 'transparent' : (currentCell.backgroundColor || 'rgba(255,255,255,0.02)'),
        border: showGridControls ? `2px solid ${showGridInPreview ? (isHovered ? 'rgba(76, 110, 245, 0.6)' : 'rgba(76, 110, 245, 0.2)') : 'rgba(100,100,100,0.3)'}` : 'none',
        padding: editMode === 'preview' && !showGridInPreview ? '0' : `${currentCell.padding || 20}px`,
        position: 'relative',
        minHeight: showGridControls ? '150px' : 'auto',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s',
      }}
    >
      {/* In grid preview mode, show only split button on hover */}
      {showGridInPreview && isHovered && (
        <Menu opened={showSplitMenu} onChange={setShowSplitMenu}>
          <Menu.Target>
            <ActionIcon 
              variant="filled" 
              size="md"
              color="blue"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <IconGridDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item 
              leftSection={<IconArrowsHorizontal size={14} />}
              onClick={() => {
                handleSplit('vertical');
                setShowSplitMenu(false);
              }}
            >
              Split Vertical
            </Menu.Item>
            <Menu.Item 
              leftSection={<IconArrowsVertical size={14} />}
              onClick={() => {
                handleSplit('horizontal');
                setShowSplitMenu(false);
              }}
            >
              Split Horizontal
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}

      {/* In edit mode, show full controls panel */}
      {editMode === 'edit' && (
        <Paper
          p="xs"
          withBorder
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: 'auto',
            zIndex: 100,
            backgroundColor: canvasTextColor === '#000000' ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,30,0.95)',
            borderColor: canvasTextColor === '#000000' ? '#dee2e6' : '#373A40',
          }}
        >
          <Group justify="space-between">
            <Badge variant="light" size="sm">
              Cell
            </Badge>
            <Group gap="xs">
              <Menu opened={showSplitMenu} onChange={setShowSplitMenu}>
                <Menu.Target>
                  <ActionIcon variant="light" size="sm">
                    <IconGridDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item 
                    leftSection={<IconArrowsHorizontal size={14} />}
                    onClick={() => {
                      handleSplit('vertical');
                      setShowSplitMenu(false);
                    }}
                  >
                    Split Vertical
                  </Menu.Item>
                  <Menu.Item 
                    leftSection={<IconArrowsVertical size={14} />}
                    onClick={() => {
                      handleSplit('horizontal');
                      setShowSplitMenu(false);
                    }}
                  >
                    Split Horizontal
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <ActionIcon variant="light" size="sm" onClick={() => setShowBlockSelector(!showBlockSelector)}>
                <IconPlus size={16} />
              </ActionIcon>
              <ActionIcon variant="light" size="sm" onClick={handleEdit}>
                <IconSettings size={16} />
              </ActionIcon>
              <ActionIcon variant="light" size="sm" color="red" onClick={handleDelete}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {showBlockSelector && (
            <Group mt="sm" gap="xs">
              {BLOCK_TYPES.map((blockType) => (
                <Button
                  key={blockType.value}
                  size="xs"
                  variant="light"
                  leftSection={<blockType.icon size={14} />}
                  onClick={() => {
                    handleAddBlock(blockType.value);
                    setShowBlockSelector(false);
                  }}
                >
                  {blockType.label}
                </Button>
              ))}
            </Group>
          )}
        </Paper>
      )}

      {/* Render blocks */}
      {editMode === 'preview' && !showGridInPreview ? (
        // Pure preview mode - render blocks directly without any controls
        <Stack gap={0} style={{ flex: 1 }}>
          {currentCell.blocks?.map((block: any) => (
            <Box
              key={block.blockId}
              style={{
                padding: `${block.padding || 20}px`,
                backgroundColor: getBlockBackgroundColor(block, colorScheme),
                width: block.content?.width || '100%',
                margin: '0 auto',
              }}
            >
              <BlockPreview 
                block={block} 
                canvasTextColor={canvasTextColor}
                editMode={editMode}
                onUpdateContent={() => {}}
              />
            </Box>
          ))}
        </Stack>
      ) : (
        // Edit mode or grid preview mode - render with drag & drop
        <Box style={{ flex: 1, paddingTop: editMode === 'edit' ? '60px' : '0' }}>
          <DroppableCell cellId={currentCell.cellId}>
            <SortableContext items={currentCell.blocks?.map((b: any) => b.blockId) || []} strategy={verticalListSortingStrategy}>
              <Stack gap="md" style={{ flex: 1, minHeight: '100px' }}>
              {currentCell.blocks?.map((block: any, index: number) => {
                console.log('Rendering block in cell', currentCell.cellId, ':', block);
                return (
                  <DraggableBlock
                    key={block.blockId}
                    block={block}
                    cellId={currentCell.cellId}
                    index={index}
                    editMode={editMode}
                    canvasTextColor={canvasTextColor}
                    colorScheme={colorScheme}
                    onEdit={() => onEditBlock(currentCell.cellId, block)}
                    onDelete={() => onDeleteBlock(currentCell.cellId, block.blockId)}
                    onUpdateContent={(contentUpdates: any) => 
                      onUpdateBlockContent(currentCell.cellId, block.blockId, contentUpdates)
                    }
                  >
                    <BlockPreview 
                      block={block} 
                      canvasTextColor={canvasTextColor}
                      editMode={editMode}
                      onUpdateContent={(contentUpdates: any) => 
                        onUpdateBlockContent(currentCell.cellId, block.blockId, contentUpdates)
                      }
                    />
                  </DraggableBlock>
                );
              })}
            </Stack>
          </SortableContext>
        </DroppableCell>
        </Box>
      )}

      {(!currentCell.blocks || currentCell.blocks.length === 0) && showGridControls && (
        <Text c="dimmed" ta="center" size="sm" mt="xl">
          {showGridInPreview ? 'Click split icon to divide this cell' : 'Click + to add blocks or split this cell'}
        </Text>
      )}
    </Box>
  );
}

function GridCell({ cell, editMode, canvasTextColor, onEdit, onDelete, onAddBlock }: any) {
  const [showBlockSelector, setShowBlockSelector] = useState(false);

  const BLOCK_TYPES = [
    { value: 'text', label: 'Text', icon: IconFileText },
    { value: 'mediaGallery', label: 'Media Gallery', icon: IconLayoutGrid },
    { value: 'button', label: 'Button', icon: IconClick },
    { value: 'productAttributeSelector', label: 'Product Attributes', icon: IconAdjustments },
    { value: 'productList', label: 'Products', icon: IconShoppingCart },
  ];

  return (
    <Box
      style={{
        gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
        gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
        backgroundColor: cell.backgroundColor || 'rgba(255,255,255,0.02)',
        border: editMode === 'edit' ? `2px solid rgba(100,100,100,0.3)` : 'none',
        padding: `${cell.padding || 20}px`,
        position: 'relative',
        minHeight: '150px',
        overflow: 'hidden',
      }}
    >
      {editMode === 'edit' && (
        <Paper
          p="xs"
          mb="sm"
          withBorder
          style={{
            backgroundColor: canvasTextColor === '#000000' ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,30,0.95)',
            borderColor: canvasTextColor === '#000000' ? '#dee2e6' : '#373A40',
          }}
        >
          <Group justify="space-between">
            <Badge variant="light" size="sm">
              Cell {cell.row + 1}-{cell.col + 1}
            </Badge>
            <Group gap="xs">
              <ActionIcon variant="light" size="sm" onClick={() => setShowBlockSelector(!showBlockSelector)}>
                <IconPlus size={16} />
              </ActionIcon>
              <ActionIcon variant="light" size="sm" onClick={onEdit}>
                <IconSettings size={16} />
              </ActionIcon>
              <ActionIcon variant="light" size="sm" color="red" onClick={onDelete}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {showBlockSelector && (
            <Group mt="sm" gap="xs">
              {BLOCK_TYPES.map((blockType) => (
                <Button
                  key={blockType.value}
                  size="xs"
                  variant="light"
                  leftSection={<blockType.icon size={14} />}
                  onClick={() => {
                    onAddBlock(blockType.value);
                    setShowBlockSelector(false);
                  }}
                >
                  {blockType.label}
                </Button>
              ))}
            </Group>
          )}
        </Paper>
      )}

      {/* Render blocks */}
      <Stack gap="md">
        {cell.blocks?.map((block: any) => (
          <Box
            key={block.blockId}
            style={{
              padding: `${block.padding || 20}px`,
              backgroundColor: block.backgroundColor || 'transparent',
            }}
          >
            <BlockPreview block={block} canvasTextColor={canvasTextColor} />
          </Box>
        ))}
      </Stack>

      {(!cell.blocks || cell.blocks.length === 0) && editMode === 'edit' && (
        <Text c="dimmed" ta="center" size="sm" mt="xl">
          Click + to add blocks
        </Text>
      )}
    </Box>
  );
}

// Visual Segment Component
function VisualSegment({ segment, editMode, canvasTextColor, onEdit, onDelete, onDuplicate, onAddBlock, onEditBlock, onDeleteBlock, onSplitHorizontal, onSplitVertical }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: segment.segmentId });
  const [showBlockSelector, setShowBlockSelector] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const segmentStyles = {
    backgroundColor: segment.backgroundColor || 'transparent',
    backgroundImage: segment.backgroundImage ? `url(${segment.backgroundImage})` : undefined,
    paddingTop: typeof segment.paddingTop === 'number' ? `${segment.paddingTop}px` : segment.paddingTop || '40px',
    paddingBottom: typeof segment.paddingBottom === 'number' ? `${segment.paddingBottom}px` : segment.paddingBottom || '40px',
    paddingLeft: segment.paddingLeft || '0',
    paddingRight: segment.paddingRight || '0',
    marginTop: segment.marginTop || '0',
    marginBottom: segment.marginBottom || '20px',
    position: 'relative' as const,
    color: canvasTextColor, // Apply theme text color
    width: segment.width || '100%',
    height: segment.height || 'auto',
    maxWidth: segment.maxWidth || '1200px',
    marginLeft: segment.position === 'center' ? 'auto' : segment.position === 'right' ? 'auto' : '0',
    marginRight: segment.position === 'center' ? 'auto' : segment.position === 'left' ? 'auto' : '0',
    display: segment.isGrid ? 'grid' : 'block',
    gridTemplateColumns: segment.gridTemplateColumns,
    gridTemplateRows: segment.gridTemplateRows,
    gridRow: segment.gridRow,
    gridColumn: segment.gridColumn,
  };

  const BLOCK_TYPES = [
    { value: 'text', label: 'Text', icon: IconFileText },
    { value: 'mediaGallery', label: 'Media Gallery', icon: IconLayoutGrid },
    { value: 'button', label: 'Button', icon: IconClick },
    { value: 'productAttributeSelector', label: 'Product Attributes', icon: IconAdjustments },
    { value: 'productList', label: 'Products', icon: IconShoppingCart },
  ];

  return (
    <Box ref={setNodeRef} style={style} mb="md">
      <Box style={segmentStyles}>
        {editMode === 'edit' && !segment.isGrid && (
          <Paper 
            p="xs" 
            mb="sm" 
            withBorder 
            style={{ 
              backgroundColor: canvasTextColor === '#000000' ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,30,0.95)',
              borderColor: canvasTextColor === '#000000' ? '#dee2e6' : '#373A40',
            }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                <ActionIcon {...listeners} variant="subtle" style={{ cursor: 'grab' }}>
                  <IconGripVertical size={18} />
                </ActionIcon>
                <Badge variant="light">{segment.name}</Badge>
                <Badge variant="outline" size="sm">
                  {segment.layout}
                </Badge>
              </Group>
              <Group gap="xs">
                <Menu>
                  <Menu.Target>
                    <Tooltip label="Split into Grid">
                      <ActionIcon variant="light" size="sm">
                        <IconGridDots size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconColumnInsertRight size={14} />} onClick={() => onSplitHorizontal(segment.segmentId)}>
                      Split Horizontally (Left/Right)
                    </Menu.Item>
                    <Menu.Item leftSection={<IconRowInsertBottom size={14} />} onClick={() => onSplitVertical(segment.segmentId)}>
                      Split Vertically (Top/Bottom)
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
                <ActionIcon variant="light" size="sm" onClick={() => setShowBlockSelector(!showBlockSelector)}>
                  <IconPlus size={16} />
                </ActionIcon>
                <ActionIcon variant="light" size="sm" onClick={onEdit}>
                  <IconSettings size={16} />
                </ActionIcon>
                <ActionIcon variant="light" size="sm" onClick={onDuplicate}>
                  <IconCopy size={16} />
                </ActionIcon>
                <ActionIcon variant="light" size="sm" color="red" onClick={onDelete}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>

            {showBlockSelector && (
              <Group mt="sm" gap="xs">
                {BLOCK_TYPES.map((blockType) => (
                  <Button
                    key={blockType.value}
                    size="xs"
                    variant="light"
                    leftSection={<blockType.icon size={14} />}
                    onClick={() => {
                      onAddBlock(blockType.value);
                      setShowBlockSelector(false);
                    }}
                  >
                    {blockType.label}
                  </Button>
                ))}
              </Group>
            )}
          </Paper>
        )}

        <Container size={segment.maxWidth || 'xl'} px={0}>
          <Stack gap="md">
            {segment.blocks?.map((block: any) => (
              <VisualBlock 
                key={block.blockId} 
                block={block} 
                editMode={editMode} 
                canvasTextColor={canvasTextColor}
                onEdit={() => onEditBlock(block)} 
                onDelete={() => onDeleteBlock(block.blockId)} 
              />
            ))}

            {(!segment.blocks || segment.blocks.length === 0) && editMode === 'edit' && (
              <Paper 
                p="xl" 
                ta="center" 
                withBorder 
                style={{ 
                  borderStyle: 'dashed', 
                  backgroundColor: 'transparent',
                  borderColor: canvasTextColor === '#000000' ? '#dee2e6' : '#373A40',
                }}
              >
                <Text style={{ color: canvasTextColor, opacity: 0.6 }}>No blocks in this segment. Click + to add content.</Text>
              </Paper>
            )}
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

// Visual Block Component
function VisualBlock({ block, editMode, canvasTextColor, onEdit, onDelete }: any) {
  return (
    <Box
      style={{
        backgroundColor: block.backgroundColor || 'transparent',
        padding: typeof block.padding === 'number' ? `${block.padding}px` : block.padding || '20px',
        margin: block.margin || '0',
        width: block.width || '100%',
        position: 'relative',
        color: canvasTextColor, // Apply theme text color
        minHeight: '60px',
      }}
    >
      {editMode === 'edit' && (
        <Group justify="flex-end" gap="xs" mb="xs" style={{ position: 'absolute', top: 5, right: 5, zIndex: 10 }}>
          <ActionIcon size="sm" variant="filled" onClick={onEdit}>
            <IconPencil size={14} />
          </ActionIcon>
          <ActionIcon size="sm" variant="filled" color="red" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      )}

      <BlockPreview block={block} canvasTextColor={canvasTextColor} />
    </Box>
  );
}

// Droppable Cell Wrapper
function DroppableCell({ cellId, children }: { cellId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: {
      cellId,
    },
  });

  return (
    <Box
      ref={setNodeRef}
      style={{
        flex: 1,
        minHeight: '100px',
        backgroundColor: isOver ? 'rgba(100, 150, 255, 0.1)' : 'transparent',
        border: isOver ? '2px dashed rgba(100, 150, 255, 0.5)' : 'none',
        borderRadius: '8px',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </Box>
  );
}

// Draggable Block Wrapper
function DraggableBlock({ block, cellId, index, editMode, canvasTextColor, colorScheme, onEdit, onDelete, onUpdateContent, children }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.blockId,
    data: {
      block,
      cellId,
      index,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: `${block.padding || 20}px`,
    backgroundColor: getBlockBackgroundColor(block, colorScheme),
    position: 'relative' as const,
    border: editMode === 'edit' ? '1px dashed rgba(100,100,100,0.3)' : 'none',
    width: block.content?.width || '100%',
    margin: '0 auto',
  };

  return (
    <Box ref={setNodeRef} style={style}>
      {editMode === 'edit' && (
        <Group gap="xs" justify="space-between" mb="xs" style={{ position: 'relative' }}>
          <Group gap="xs">
            <ActionIcon 
              {...attributes}
              {...listeners}
              size="sm" 
              variant="light"
              style={{ cursor: 'grab' }}
            >
              <IconGripVertical size={14} />
            </ActionIcon>
            <Badge size="xs" variant="light">{block.type.toUpperCase()}</Badge>
            
            {/* Data Binding Toggle - Inline */}
            {(block.type === 'text' || block.type === 'mediaGallery') && (
              <Group gap={4}>
                <Text size="xs" c="dimmed">Bind:</Text>
                <Switch
                  size="xs"
                  checked={block.content?.dataBinding?.sourceType !== DataSourceType.STATIC}
                  onChange={(e) => {
                    const isEnabled = e.currentTarget.checked;
                    const newDataBinding = {
                      sourceType: isEnabled ? DataSourceType.PRODUCT : DataSourceType.STATIC,
                      fieldPath: undefined,
                      fallbackValue: undefined,
                      templateString: undefined,
                    };
                    if (onUpdateContent) {
                      onUpdateContent({ dataBinding: newDataBinding });
                    }
                  }}
                />
              </Group>
            )}
          </Group>
          <Group gap="xs">
            <ActionIcon 
              size="sm" 
              variant="light" 
              onClick={onEdit}
            >
              <IconSettings size={14} />
            </ActionIcon>
            <ActionIcon 
              size="sm" 
              variant="light" 
              color="red"
              onClick={onDelete}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>
      )}
      
      {/* Preview Mode - Show data binding indicator */}
      {editMode === 'preview' && block.content?.dataBinding?.sourceType !== DataSourceType.STATIC && (
        <Badge 
          size="xs" 
          variant="light" 
          color="blue"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
        >
          Preview: {block.content.dataBinding.sourceType}
        </Badge>
      )}
      
      {children}
    </Box>
  );
}

// Block Preview Component (Interactive in Edit Mode)
function BlockPreview({ block, canvasTextColor, editMode, onUpdateContent }: any) {
  const { type, content } = block;
  
  // State for MediaGallery (shared between parent and child)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [previousMediaIndex, setPreviousMediaIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Apply preview data when in preview mode and data binding is enabled
  const effectiveContent = editMode === 'preview' 
    ? applyPreviewData(content, type)
    : content;

  switch (type) {
    case 'text':
      return (
        <TextBlock
          content={effectiveContent}
          canvasTextColor={canvasTextColor}
          editMode={editMode}
          onUpdateContent={onUpdateContent}
        />
      );

    case 'image':
      return (
        <ImageBlock
          content={effectiveContent}
          canvasTextColor={canvasTextColor}
          editMode={editMode}
          onUpdateContent={onUpdateContent}
        />
      );

    case 'button':
      return (
        <ButtonBlock
          content={effectiveContent}
          editMode={editMode}
          onUpdateContent={onUpdateContent}
        />
      );

    case 'video':
      return (
        <VideoBlock
          content={effectiveContent}
          canvasTextColor={canvasTextColor}
          editMode={editMode}
          onUpdateContent={onUpdateContent}
        />
      );

    case 'mediaGallery':
      return (
        <MediaGalleryBlock
          content={effectiveContent}
          canvasTextColor={canvasTextColor}
          editMode={editMode}
          onUpdateContent={onUpdateContent}
          currentMediaIndex={currentMediaIndex}
          setCurrentMediaIndex={setCurrentMediaIndex}
          previousMediaIndex={previousMediaIndex}
          setPreviousMediaIndex={setPreviousMediaIndex}
          slideDirection={slideDirection}
          setSlideDirection={setSlideDirection}
        />
      );

    case 'productList':
      return (
        <Box p="md" style={{ border: `1px solid ${canvasTextColor}30`, borderRadius: '8px', width: content.width || '100%' }}>
          <Text fw={500} mb="sm" style={{ color: canvasTextColor }}>
            Product List
          </Text>
          <Text size="sm" style={{ color: canvasTextColor, opacity: 0.7 }}>
            Filter: {content.productFilter?.filterType || 'All'} | Display: {content.displayStyle || 'Grid'} | Columns: {content.columns || 4}
          </Text>
        </Box>
      );

    case 'productAttributeSelector':
      // Show a preview with sample product data
      const sampleProduct = {
        name: 'Sample Product',
        price: 99.99,
        attributeDefinitions: {
          Color: ['Black', 'White', 'Gray'],
          Size: ['S', 'M', 'L']
        },
        variants: [
          { 
            attributeCombination: { Color: 'Black', Size: 'S' }, 
            price: 99.99, 
            stockQuantity: 10,
            isActive: true,
            images: []
          }
        ],
        hasVariants: true
      };
      return (
        <ProductAttributeSelector
          content={content}
          productData={sampleProduct}
          onVariantChange={() => {}}
          editMode={editMode}
        />
      );

    default:
      return (
        <Text ta="center" style={{ color: canvasTextColor, opacity: 0.6 }}>
          {type} block
        </Text>
      );
  }
}

// Segment Editor Modal
function SegmentEditorModal({ opened, segment, onClose, onSave }: any) {
  const [editData, setEditData] = useState(segment);

  useEffect(() => {
    setEditData(segment);
  }, [segment]);

  if (!editData) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Edit Segment" size="xl">
      <Stack>
        <Tabs defaultValue="layout">
          <Tabs.List>
            <Tabs.Tab value="layout">Layout & Size</Tabs.Tab>
            <Tabs.Tab value="style">Style & Spacing</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="layout" pt="md">
            <Stack>
              <TextInput label="Segment Name" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              
              <Select
                label="Layout"
                value={editData.layout}
                onChange={(value) => setEditData({ ...editData, layout: value })}
                data={[
                  { value: 'fullWidth', label: 'Full Width' },
                  { value: 'contained', label: 'Contained' },
                  { value: 'twoColumn', label: 'Two Column' },
                  { value: 'threeColumn', label: 'Three Column' },
                ]}
              />

              <Divider label="Size & Position" />

              <Group grow>
                <TextInput 
                  label="Width" 
                  value={editData.width || '100%'} 
                  onChange={(e) => setEditData({ ...editData, width: e.target.value })} 
                  placeholder="100% or 1200px"
                  description="Can use %, px, vw, etc."
                />
                <TextInput 
                  label="Height" 
                  value={editData.height || 'auto'} 
                  onChange={(e) => setEditData({ ...editData, height: e.target.value })} 
                  placeholder="auto or 500px"
                  description="auto or custom height"
                />
              </Group>

              <Select
                label="Horizontal Position"
                value={editData.position || 'center'}
                onChange={(value) => setEditData({ ...editData, position: value })}
                data={[
                  { value: 'left', label: 'Align Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Align Right' },
                ]}
                description="How the segment aligns within the page"
              />

              <TextInput 
                label="Max Width" 
                value={editData.maxWidth} 
                onChange={(e) => setEditData({ ...editData, maxWidth: e.target.value })} 
                placeholder="1200px"
                description="Maximum width constraint"
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="style" pt="md">
            <Stack>
              <ColorInput label="Background Color" value={editData.backgroundColor} onChange={(value) => setEditData({ ...editData, backgroundColor: value })} />
              <Group grow>
                <NumberInput 
                  label="Padding Top" 
                  value={typeof editData.paddingTop === 'number' ? editData.paddingTop : parseInt(editData.paddingTop) || 60} 
                  onChange={(value) => setEditData({ ...editData, paddingTop: value })} 
                  suffix=" px"
                  min={0}
                />
                <NumberInput 
                  label="Padding Bottom" 
                  value={typeof editData.paddingBottom === 'number' ? editData.paddingBottom : parseInt(editData.paddingBottom) || 60} 
                  onChange={(value) => setEditData({ ...editData, paddingBottom: value })} 
                  suffix=" px"
                  min={0}
                />
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Button onClick={() => onSave(editData)} mt="md">Save Segment</Button>
      </Stack>
    </Modal>
  );
}

// Block Editor Modal
function BlockEditorModal({ opened, block, onClose, onSave }: any) {
  const [editData, setEditData] = useState(block);

  useEffect(() => {
    setEditData(block);
  }, [block]);

  if (!editData) return null;

  // ProductAttributeSelector is always dynamic and doesn't need data binding toggle
  const isLogicBlock = editData.type === 'productAttributeSelector';

  return (
    <Modal opened={opened} onClose={onClose} title={`Edit ${editData.type} Block`} size="lg">
      <Stack>
        <Tabs defaultValue="content">
          <Tabs.List>
            <Tabs.Tab value="content">Content</Tabs.Tab>
            {!isLogicBlock && <Tabs.Tab value="databinding">Data Binding</Tabs.Tab>}
            <Tabs.Tab value="style">Style</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="content" pt="md">
            {isLogicBlock ? (
              <Paper withBorder p="md">
                <Text size="sm" fw={500} mb="xs">Product Attribute Selector</Text>
                <Text size="sm" c="dimmed">
                  This block automatically displays variant selection buttons on product pages.
                  It handles attribute combinations, price updates, and image switching dynamically.
                  No configuration needed - just add it to your product template!
                </Text>
              </Paper>
            ) : (
              <Paper withBorder p="md">
                <Text size="sm" c="dimmed">
                  Content editing is available directly in the block. Click on the block in the canvas to edit its content inline.
                  For text blocks, use the rich text editor toolbar. For other blocks, click to configure.
                </Text>
              </Paper>
            )}
          </Tabs.Panel>

          {!isLogicBlock && (
            <Tabs.Panel value="databinding" pt="md">
              <DataBindingEditor block={editData} onChange={setEditData} />
            </Tabs.Panel>
          )}

          <Tabs.Panel value="style" pt="md">
            <Stack>
              <ColorInput label="Background Color" value={editData.backgroundColor} onChange={(value) => setEditData({ ...editData, backgroundColor: value })} />
              <NumberInput 
                label="Padding" 
                value={typeof editData.padding === 'number' ? editData.padding : parseInt(editData.padding) || 20} 
                onChange={(value) => setEditData({ ...editData, padding: value })} 
                suffix=" px"
                min={0}
              />
              <Select
                label="Width"
                value={editData.width}
                onChange={(value) => setEditData({ ...editData, width: value })}
                data={[
                  { value: '100%', label: 'Full Width' },
                  { value: '75%', label: '75%' },
                  { value: '50%', label: '50%' },
                  { value: '25%', label: '25%' },
                ]}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Button onClick={() => onSave(editData)} mt="md">
          Save Block
        </Button>
      </Stack>
    </Modal>
  );
}

// Data Binding Editor
function DataBindingEditor({ block, onChange }: any) {
  const { type, content } = block;
  const dataBinding = content?.dataBinding || {
    sourceType: DataSourceType.STATIC,
    fieldPath: undefined,
    fallbackValue: undefined,
    templateString: undefined,
  };

  // Check if data binding is enabled (not static)
  const isDataBindingEnabled = dataBinding.sourceType !== DataSourceType.STATIC;

  const toggleDataBinding = (enabled: boolean) => {
    const newDataBinding = {
      sourceType: enabled ? DataSourceType.PRODUCT : DataSourceType.STATIC,
      fieldPath: undefined,
      fallbackValue: undefined,
      templateString: undefined,
    };
    onChange({
      ...block,
      content: { 
        ...content, 
        dataBinding: newDataBinding,
      },
    });
  };

  const updateDataBinding = (field: string, value: any) => {
    const newDataBinding = { ...dataBinding, [field]: value };
    onChange({
      ...block,
      content: { 
        ...content, 
        dataBinding: newDataBinding,
      },
    });
  };

  const dataSourceOptions = [
    { value: DataSourceType.PRODUCT, label: 'Product Data' },
    { value: DataSourceType.CATEGORY, label: 'Category Data' },
    { value: DataSourceType.COLLECTION, label: 'Collection Data' },
    { value: DataSourceType.CUSTOMER, label: 'Customer Data' },
  ];

  const fieldOptions = getDataSourceFieldOptions(dataBinding.sourceType, type);
  const showTemplateInput = (type === 'text' || type === 'button') && isDataBindingEnabled;

  return (
    <Stack>
      <Paper withBorder p="md">
        <Group justify="space-between" align="center">
          <Box style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Enable Data Binding</Text>
            <Text size="xs" c="dimmed">
              {isDataBindingEnabled 
                ? 'This block will display dynamic content from a data source'
                : 'This block will display static content you configure manually'
              }
            </Text>
          </Box>
          <Switch
            size="lg"
            checked={isDataBindingEnabled}
            onChange={(e) => toggleDataBinding(e.currentTarget.checked)}
          />
        </Group>
      </Paper>

      {isDataBindingEnabled ? (
        <Stack gap="md">
          <Paper withBorder p="md" style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
            <Group gap="xs">
              <IconLink size={16} />
              <Text size="sm" fw={500} c="blue">Dynamic Content Mode</Text>
            </Group>
          </Paper>

          <Select
            label="Data Source"
            description="Choose which type of data to bind to"
            value={dataBinding.sourceType}
            onChange={(value) => {
              updateDataBinding('sourceType', value);
              // Reset field path when changing source type
              updateDataBinding('fieldPath', undefined);
            }}
            data={dataSourceOptions}
            required
          />

          {fieldOptions.length > 0 && (
            <Select
              label="Data Field"
              description="Select which field to display"
              value={dataBinding.fieldPath || ''}
              onChange={(value) => updateDataBinding('fieldPath', value)}
              data={fieldOptions}
              searchable
              clearable
              required
              placeholder="Select a field..."
            />
          )}

          {showTemplateInput && (
            <Textarea
              label="Template (Optional)"
              description="Use {{field}} syntax. Example: 'Buy {{product.name}} for ${{product.price}}'"
              placeholder="Enter template..."
              value={dataBinding.templateString || ''}
              onChange={(e) => updateDataBinding('templateString', e.target.value)}
              minRows={2}
            />
          )}

          <TextInput
            label="Fallback Value (Optional)"
            description="Value to show if data is not available"
            placeholder="Enter fallback value..."
            value={dataBinding.fallbackValue || ''}
            onChange={(e) => updateDataBinding('fallbackValue', e.target.value)}
          />

          {!dataBinding.fieldPath && (
            <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-orange-5)', backgroundColor: 'var(--mantine-color-orange-0)' }}>
              <Group gap="xs">
                <IconAlertCircle size={16} color="var(--mantine-color-orange-6)" />
                <Text size="sm" fw={500} c="orange">Select a Data Field</Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                Choose which {dataBinding.sourceType} field you want to display in this block.
              </Text>
            </Paper>
          )}

          {dataBinding.fieldPath && (
            <Paper withBorder p="md" style={{ backgroundColor: 'var(--mantine-color-green-0)' }}>
              <Group gap="xs">
                <IconCheck size={16} color="var(--mantine-color-green-7)" />
                <Text size="sm" fw={500} c="green">Binding Configured</Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                This block will display: <strong>{dataBinding.fieldPath}</strong>
                {dataBinding.templateString && (
                  <>
                    <br />
                    Using template: <strong>{dataBinding.templateString}</strong>
                  </>
                )}
              </Text>
            </Paper>
          )}
        </Stack>
      ) : (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>Static Content Mode</Text>
            <Text size="xs" c="dimmed">
              This block will show the manual content you configure in the "Content" tab.
              Enable data binding above to automatically display content from products, categories, or other data sources.
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// Block Editor Component
function BlockEditor({ block, onUpdate, onClose }: any) {
  const [editData, setEditData] = useState(block);
  const [backgroundMode, setBackgroundMode] = useState<'inherit' | 'single' | 'dual'>(
    block.backgroundColorLight || block.backgroundColorDark ? 'dual' : 
    block.backgroundColor ? 'single' : 'inherit'
  );

  // ProductAttributeSelector is always dynamic and doesn't need data binding toggle
  const isLogicBlock = editData.type === 'productAttributeSelector';

  useEffect(() => {
    setEditData(block);
    setBackgroundMode(
      block.backgroundColorLight || block.backgroundColorDark ? 'dual' : 
      block.backgroundColor ? 'single' : 'inherit'
    );
  }, [block]);

  const handleSave = () => {
    onUpdate(editData);
  };

  return (
    <Stack gap="md">
      {editData.type === 'text' ? (
        // For text blocks, only show style settings (no tabs)
        <Stack gap="md">
          <NumberInput
            label="Padding"
            value={editData.padding || 20}
            onChange={(value) => setEditData({ ...editData, padding: value })}
            suffix=" px"
            min={0}
          />
          
          <Select
            label="Background Color Mode"
            value={backgroundMode}
            onChange={(value: any) => {
              setBackgroundMode(value);
              if (value === 'inherit') {
                setEditData({ 
                  ...editData, 
                  backgroundColor: '', 
                  backgroundColorLight: '', 
                  backgroundColorDark: '' 
                });
              } else if (value === 'single') {
                setEditData({ 
                  ...editData, 
                  backgroundColorLight: '', 
                  backgroundColorDark: '' 
                });
              } else if (value === 'dual') {
                setEditData({ 
                  ...editData, 
                  backgroundColor: '' 
                });
              }
            }}
            data={[
              { value: 'inherit', label: 'Inherit from Page' },
              { value: 'single', label: 'Single Color' },
              { value: 'dual', label: 'Light/Dark Mode Colors' },
            ]}
          />

          {backgroundMode === 'single' && (
            <ColorInput
              label="Background Color"
              value={editData.backgroundColor || ''}
              onChange={(value) => setEditData({ ...editData, backgroundColor: value })}
              placeholder="Select color"
            />
          )}

          {backgroundMode === 'dual' && (
            <>
              <ColorInput
                label="Background Color (Light Mode)"
                value={editData.backgroundColorLight || ''}
                onChange={(value) => setEditData({ ...editData, backgroundColorLight: value })}
                placeholder="Color for light mode"
              />
              <ColorInput
                label="Background Color (Dark Mode)"
                value={editData.backgroundColorDark || ''}
                onChange={(value) => setEditData({ ...editData, backgroundColorDark: value })}
                placeholder="Color for dark mode"
              />
            </>
          )}
        </Stack>
      ) : isLogicBlock ? (
        // For logic blocks like ProductAttributeSelector, only show info (no data binding)
        <Stack gap="md">
          <Paper withBorder p="md">
            <Text size="sm" fw={500} mb="xs">Product Attribute Selector</Text>
            <Text size="sm" c="dimmed">
              This block automatically displays variant selection buttons on product pages.
              It handles attribute combinations, price updates, and image switching dynamically.
              No configuration needed - just add it to your product template!
            </Text>
          </Paper>

          <Divider label="Style Settings" />

          <NumberInput
            label="Padding"
            value={editData.padding || 20}
            onChange={(value) => setEditData({ ...editData, padding: value })}
            suffix=" px"
            min={0}
          />
          
          <Select
            label="Background Color Mode"
            value={backgroundMode}
            onChange={(value: any) => {
              setBackgroundMode(value);
              if (value === 'inherit') {
                setEditData({ 
                  ...editData, 
                  backgroundColor: '', 
                  backgroundColorLight: '', 
                  backgroundColorDark: '' 
                });
              } else if (value === 'single') {
                setEditData({ 
                  ...editData, 
                  backgroundColorLight: '', 
                  backgroundColorDark: '' 
                });
              } else if (value === 'dual') {
                setEditData({ 
                  ...editData, 
                  backgroundColor: '' 
                });
              }
            }}
            data={[
              { value: 'inherit', label: 'Inherit from Page' },
              { value: 'single', label: 'Single Color' },
              { value: 'dual', label: 'Light/Dark Mode Colors' },
            ]}
          />

          {backgroundMode === 'single' && (
            <ColorInput
              label="Background Color"
              value={editData.backgroundColor || ''}
              onChange={(value) => setEditData({ ...editData, backgroundColor: value })}
              placeholder="Select color"
            />
          )}

          {backgroundMode === 'dual' && (
            <>
              <ColorInput
                label="Background Color (Light Mode)"
                value={editData.backgroundColorLight || ''}
                onChange={(value) => setEditData({ ...editData, backgroundColorLight: value })}
                placeholder="Color for light mode"
              />
              <ColorInput
                label="Background Color (Dark Mode)"
                value={editData.backgroundColorDark || ''}
                onChange={(value) => setEditData({ ...editData, backgroundColorDark: value })}
                placeholder="Color for dark mode"
              />
            </>
          )}
        </Stack>
      ) : (
        // For other block types, show simplified editor with data binding and style
        <Tabs defaultValue="databinding">
          <Tabs.List>
            <Tabs.Tab value="databinding">Data Binding</Tabs.Tab>
            <Tabs.Tab value="style">Style</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="databinding" pt="md">
            <DataBindingEditor block={editData} onChange={setEditData} />
          </Tabs.Panel>

          <Tabs.Panel value="style" pt="md">
            <Stack gap="md">
              <NumberInput
                label="Padding"
                value={editData.padding || 20}
                onChange={(value) => setEditData({ ...editData, padding: value })}
                suffix=" px"
                min={0}
              />
              
              <Select
                label="Background Color Mode"
                value={backgroundMode}
                onChange={(value: any) => {
                  setBackgroundMode(value);
                  if (value === 'inherit') {
                    setEditData({ 
                      ...editData, 
                      backgroundColor: '', 
                      backgroundColorLight: '', 
                      backgroundColorDark: '' 
                    });
                  } else if (value === 'single') {
                    setEditData({ 
                      ...editData, 
                      backgroundColorLight: '', 
                      backgroundColorDark: '' 
                    });
                  } else if (value === 'dual') {
                    setEditData({ 
                      ...editData, 
                      backgroundColor: '' 
                    });
                  }
                }}
                data={[
                  { value: 'inherit', label: 'Inherit from Page' },
                  { value: 'single', label: 'Single Color' },
                  { value: 'dual', label: 'Light/Dark Mode Colors' },
                ]}
              />

              {backgroundMode === 'single' && (
                <ColorInput
                  label="Background Color"
                  value={editData.backgroundColor || ''}
                  onChange={(value) => setEditData({ ...editData, backgroundColor: value })}
                  placeholder="Select color"
                />
              )}

              {backgroundMode === 'dual' && (
                <>
                  <ColorInput
                    label="Background Color (Light Mode)"
                    value={editData.backgroundColorLight || ''}
                    onChange={(value) => setEditData({ ...editData, backgroundColorLight: value })}
                    placeholder="Color for light mode"
                  />
                  <ColorInput
                    label="Background Color (Dark Mode)"
                    value={editData.backgroundColorDark || ''}
                    onChange={(value) => setEditData({ ...editData, backgroundColorDark: value })}
                    placeholder="Color for dark mode"
                  />
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}

// Helper function to get background color based on mode
function getBlockBackgroundColor(block: any, colorScheme: 'light' | 'dark'): string {
  // If dual mode colors are set, use them
  if (block.backgroundColorLight || block.backgroundColorDark) {
    return colorScheme === 'light' 
      ? (block.backgroundColorLight || 'transparent')
      : (block.backgroundColorDark || 'transparent');
  }
  // Otherwise use single color or transparent
  return block.backgroundColor || 'transparent';
}

// Helper function
function getDefaultBlockContent(blockType: string): any {
  const defaults: Record<string, any> = {
    text: { 
      text: '', 
      textAlign: 'left', 
      fontSize: '16px', 
      color: 'inherit',
      width: '100%', // Full width, auto, or specific px/%
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: undefined,
        templateString: undefined,
      },
    },
    image: { 
      imageUrl: '', 
      imageAlt: '', 
      imageFit: 'cover',
      imageLink: '',
      width: '100%',
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: '',
      },
    },
    video: { 
      videoUrl: '', 
      videoType: 'youtube', 
      controls: true, 
      autoplay: false,
      width: '100%',
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: '',
      },
    },
    button: { 
      buttonText: 'Click Me', 
      buttonLink: '#', 
      buttonStyle: 'primary', 
      buttonSize: 'md',
      width: 'auto',
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: undefined,
        templateString: undefined,
      },
    },
    mediaGallery: {
      items: [], // Array of { type: 'image'|'video', url: string, alt?: string, thumbnail?: string, link?: string }
      displayMode: 'carousel1', // carousel1, carousel2, slideshow1, slideshow2, grid, thumbnails
      itemsPerView: 1, // For grid/carousel
      autoPlay: false,
      autoPlayInterval: 3000, // milliseconds
      showThumbnails: true,
      thumbnailPosition: 'bottom', // bottom, right, left
      transitionAnimation: 'slide', // slide, fade, zoom, flip, cube, coverflow
      transitionSpeed: 500,
      aspectRatio: '16:9', // 16:9, 4:3, 1:1, auto
      width: '100%',
      showDots: true,
      showArrows: true,
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: [],
      },
    },
    productList: { 
      productFilter: { filterType: 'all', limit: 12 }, 
      displayStyle: 'grid', 
      columns: 4,
      width: '100%',
      // Data binding
      dataBinding: {
        sourceType: DataSourceType.STATIC,
        fieldPath: undefined,
        fallbackValue: undefined,
      },
    },
  };
  return defaults[blockType] || { 
    width: '100%',
    dataBinding: {
      sourceType: DataSourceType.STATIC,
      fieldPath: undefined,
      fallbackValue: undefined,
    },
  };
}
