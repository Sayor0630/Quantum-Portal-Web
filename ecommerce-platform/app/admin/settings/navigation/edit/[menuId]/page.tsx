'use client';
import AdminLayout from '../../../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Button, Group, LoadingOverlay, Alert, Modal, TextInput, ActionIcon, Menu, Divider, Box, Tooltip as MantineTooltip, Space, Skeleton } from '@mantine/core';
import { useDisclosure, useListState } from '@mantine/hooks';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { modals as confirmModals } from '@mantine/modals';
import { IconDeviceFloppy, IconPlus, IconPencil, IconTrash, IconLink, IconGripVertical, IconChevronDown, IconChevronRight, IconAlertCircle, IconArrowLeft, IconArrowsMove } from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { useSession } from 'next-auth/react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

interface MenuItem {
  _id?: string;
  clientId: string;
  title: string;
  url: string;
  order: number;
  children: MenuItem[];
  parentId: string | null;
}
interface NavigationMenu { _id: string; name: string; items: MenuItem[]; }

const itemSchema = Yup.object().shape({
  title: Yup.string().required('Title is required'),
  url: Yup.string().matches(/^(https?:\/\/|tel:|mailto:|\/|#)/, 'URL must be a valid link (e.g., /about, #contact, https://example.com)').required('URL is required'),
});

// Sortable Item Component (Recursive)
function SortableMenuItem({ item, onEdit, onDelete, onAddChild, level = 0, isOverlay = false, activeId }: {
    item: MenuItem,
    onEdit: (item: MenuItem) => void,
    onDelete: (item: MenuItem) => void,
    onAddChild: (parentId: string) => void,
    level?: number,
    isOverlay?: boolean,
    activeId?: string | null,
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.clientId, data: { type: 'menuItem', parentId: item.parentId, itemData: item } }); // Add item data for onDragEnd

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging && !isOverlay ? 'none' : transition,
        zIndex: isDragging ? 100 : 'auto',
        opacity: isDragging && !isOverlay ? 0.5 : 1,
        marginLeft: level * 25,
        cursor: isOverlay ? 'grabbing' : (listeners ? 'grab' : 'default'),
        border: isDragging && isOverlay ? '1px dashed #228be6' : undefined, // Style for dragged overlay
        backgroundColor: isDragging && isOverlay ? 'rgba(222, 237, 255, 0.7)' : undefined,
    };

    return (
        <Paper ref={setNodeRef} style={style} p="xs" mb="xs" withBorder radius="sm" shadow={isDragging && !isOverlay ? "xl" : "xs"}>
            <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                    <ActionIcon {...listeners} {...attributes} variant="transparent" c="dimmed" title="Drag to reorder" style={{ cursor: 'grab' }}>
                        <IconGripVertical size={18} />
                    </ActionIcon>
                    {item.children?.length > 0 ? <IconChevronDown size={16} /> : <IconLink size={16} style={{marginLeft: 4, marginRight: 4}}/>}
                    <Text>{item.title} (<Text span c="dimmed" size="xs"truncate>{item.url}</Text>)</Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                    <Button size="xs" variant="light" onClick={() => onAddChild(item.clientId)} leftSection={<IconPlus size={14}/>}>Sub-item</Button>
                    <ActionIcon variant="subtle" color="blue" onClick={() => onEdit(item)} aria-label="Edit item"><IconPencil size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => onDelete(item)} aria-label="Delete item"><IconTrash size={16} /></ActionIcon>
                </Group>
            </Group>
            {item.children && item.children.length > 0 && !isDragging && item.clientId !== activeId && (
                 <SortableContext items={item.children.map(c => c.clientId)} strategy={verticalListSortingStrategy}>
                    <Box mt="xs" style={{paddingLeft: 0}}>
                        {item.children.map(child => (
                            <SortableMenuItem
                                key={child.clientId}
                                item={child}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                level={level + 1}
                                activeId={activeId}
                            />
                        ))}
                    </Box>
                 </SortableContext>
            )}
        </Paper>
    );
}

// Main Page Component
export default function EditMenuPage() {
  const router = useRouter();
  const params = useParams();
  const menuId = params.menuId as string;
  const { data: session, status: authStatus } = useSession();

  const [menuName, setMenuName] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]); // Using useState for complex tree updates

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [parentClientIdForNewItem, setParentClientIdForNewItem] = useState<string | null>(null);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDraggedItemData, setActiveDraggedItemData] = useState<MenuItem | null>(null); // Store full item data

  const itemForm = useForm({ initialValues: { title: '', url: '' }, validate: yupResolver(itemSchema) });

  const sensors = useSensors(
    useSensor(PointerSensor), TouchSensor,
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const assignClientIdsAndParent = useCallback((menuItems: any[], parentId: string | null = null): MenuItem[] => {
     return menuItems.map((item, index) => {
        const clientId = item.clientId || item._id || uuidv4();
        return {
         ...item,
         _id: item._id || undefined,
         clientId: clientId,
         order: item.order !== undefined ? item.order : index,
         parentId: parentId,
         children: item.children ? assignClientIdsAndParent(item.children, clientId) : [],
        };
     });
  }, []);

  const fetchMenuData = useCallback(async () => {
    if (!menuId || authStatus !== 'authenticated') return;
    setIsFetching(true); setApiError(null);
    try {
      const response = await fetch(`/api/admin/navigation/${menuId}`);
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to fetch menu.'); }
      const data: NavigationMenu = await response.json();
      setMenuName(data.name);
      setItems(assignClientIdsAndParent(data.items || []));
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Loading Menu', message: err.message, color: 'red' });
    } finally { setIsFetching(false); }
  }, [menuId, authStatus, assignClientIdsAndParent]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    else if (menuId) fetchMenuData();
  }, [authStatus, menuId, router, fetchMenuData]);

  // --- CRUD Helper Functions ---
  const findItemRecursive = (itemsArray: MenuItem[], itemId: string): {item: MenuItem, parent: MenuItem[] | null, index: number} | null => {
    for (let i = 0; i < itemsArray.length; i++) {
        const item = itemsArray[i];
        if (item.clientId === itemId) return {item, parent: itemsArray, index: i};
        if (item.children) {
            const found = findItemRecursive(item.children, itemId);
            if (found) return found;
        }
    }
    return null;
  };

  const addItemToTree = (currentItems: MenuItem[], targetParentId: string | null, newItem: MenuItem, targetIndex?: number): MenuItem[] => {
    let newItems = [...currentItems];
    if (targetParentId === null) { // Add to root
        const finalIndex = targetIndex !== undefined ? targetIndex : newItems.length;
        newItems.splice(finalIndex, 0, { ...newItem, parentId: null });
    } else {
        newItems = newItems.map(item => {
            if (item.clientId === targetParentId) {
                const newChildren = item.children ? [...item.children] : [];
                const finalIndex = targetIndex !== undefined ? targetIndex : newChildren.length;
                newChildren.splice(finalIndex, 0, { ...newItem, parentId: item.clientId });
                return { ...item, children: newChildren };
            }
            if (item.children) {
                return { ...item, children: addItemToTree(item.children, targetParentId, newItem, targetIndex) };
            }
            return item;
        });
    }
    return assignOrderRecursively(newItems); // Ensure order is always updated after add
  };

  const updateItemInTree = (currentItems: MenuItem[], updatedItemPartial: Partial<MenuItem> & { clientId: string }): MenuItem[] => {
    return currentItems.map(item => {
        if (item.clientId === updatedItemPartial.clientId) {
            return { ...item, ...updatedItemPartial };
        }
        return { ...item, children: item.children ? updateItemInTree(item.children, updatedItemPartial) : [] };
    });
  };

  const removeItemFromTree = (currentItems: MenuItem[], itemClientIdToDelete: string): { newItems: MenuItem[], removedItem: MenuItem | null } => {
    let removed: MenuItem | null = null;
    const filterRecursive = (itemsArr: MenuItem[]): MenuItem[] => {
        return itemsArr.filter(item => {
            if (item.clientId === itemClientIdToDelete) {
                removed = item;
                return false;
            }
            if (item.children) {
                item.children = filterRecursive(item.children);
            }
            return true;
        });
    };
    const newItems = filterRecursive(currentItems);
    return { newItems, removedItem: removed };
  };

  // --- Modal & Form Handlers ---
  const handleOpenModal = (itemToEdit?: MenuItem, parentIdToSet?: string | null) => {
    setEditingItem(itemToEdit || null);
    setParentClientIdForNewItem(parentIdToSet === undefined ? null : parentIdToSet);
    itemForm.reset();
    if (itemToEdit) itemForm.setValues({ title: itemToEdit.title, url: itemToEdit.url });
    openModal();
  };

  const handleItemFormSubmit = (values: { title: string, url: string }) => {
    if (editingItem) {
      setItems(prevItems => updateItemInTree(prevItems, { ...editingItem, ...values, clientId: editingItem.clientId }));
    } else {
      const newItem: MenuItem = {
         clientId: uuidv4(), title: values.title, url: values.url, order: 0, children: [], parentId: parentClientIdForNewItem
      };
      setItems(prevItems => addItemToTree(prevItems, parentClientIdForNewItem, newItem));
    }
    closeModal();
  };

  const handleDeleteItem = (itemToDelete: MenuItem) => {
    confirmModals.openConfirmModal({
      title: 'Delete Menu Item', centered: true,
      children: <Text size="sm">Delete &quot;<strong>{itemToDelete.title}</strong>&quot;? If it has sub-items, they will also be deleted.</Text>,
      labels: { confirm: 'Delete Item', cancel: 'Cancel' }, confirmProps: { color: 'red' },
      onConfirm: () => setItems(prevItems => removeItemFromTree(prevItems, itemToDelete.clientId).newItems),
    });
  };

  // --- Save Handlers ---
  const stripClientData = (menuItems: MenuItem[]): any[] => {
      return menuItems.map(({ clientId, parentId, children, ...item }) => ({
          ...item,
          children: children ? stripClientData(children) : [],
      }));
  };
  const assignOrderRecursively = (menuItems: MenuItem[]): MenuItem[] => {
      return menuItems.map((item, index) => ({
          ...item,
          order: index,
          children: item.children ? assignOrderRecursively(item.children) : []
      }));
  };
  const handleSaveMenu = async () => {
    setIsLoading(true); setApiError(null);
    const finalItemsToSave = assignOrderRecursively(items); // Ensure order is set based on current array structure
    const itemsToSaveForAPI = stripClientData(finalItemsToSave);

    try {
      const response = await fetch(`/api/admin/navigation/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: menuName, items: itemsToSaveForAPI }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save menu structure.');
      notifications.show({ title: 'Menu Saved', message: 'Menu structure saved successfully.', color: 'green', icon: <IconDeviceFloppy /> });
      setItems(assignClientIdsAndParent(data.items || []));
      setMenuName(data.name);
      // form.resetDirty(); // No global form here, dirtiness is implicit by DND or item edits
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Saving Menu', message: err.message, color: 'red', icon: <IconAlertCircle /> });
    } finally { setIsLoading(false); }
  };

  // --- DND Handlers ---
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveDragId(active.id as string);
    setActiveDraggedItem(findItemRecursive(items, active.id as string)?.item || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null); setActiveDraggedItem(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string; // This is clientId of item hovered over, or a dropzone id

    setItems(currentItems => {
        let newTree = JSON.parse(JSON.stringify(currentItems));

        const removalResult = removeItemFromTree(newTree, activeId);
        newTree = removalResult.newItems;
        let draggedItem = removalResult.removedItem;

        if (!draggedItem) return currentItems; // Should not happen

        // Determine where to drop
        const overItemData = findItemRecursive(newTree, overId); // Is 'over' an item?

        let targetParentId: string | null = null;
        let targetIndex: number | undefined = undefined;

        if (overItemData) { // Dropped on or near an existing item
            // For this iteration, assume dropping "onto" an item makes it a child (last child)
            // And dropping "near" (which DND kit might resolve as closest item) means reordering as sibling
            // This needs refinement with `over.data.current` for specific drop zones or indicators

            // Simple case: If `over.id` is an item, make dragged item its last child.
            // This is a common pattern for re-parenting.
            // More advanced: check if dropping on top half (sibling before) or bottom half (sibling after) or center (child)
            targetParentId = overItemData.item.clientId; // Target item becomes the parent
            targetIndex = overItemData.item.children.length; // Add as last child
            draggedItem.parentId = targetParentId;
            newTree = addItemToTree(newTree, targetParentId, draggedItem, targetIndex);

        } else { // Dropped on a root area (or an area not identified as an item)
            // This could also be a specific dropzone for a sublist if `over.id` was a containerId
            // For now, assume dropping on root if not on an item
            draggedItem.parentId = null;
            // Try to find index if `over.id` was a placeholder for root or a list context
            // For simplicity, add to end of root for now if not dropped on an item
            newTree = addItemToTree(newTree, null, draggedItem, newTree.length);
        }
        return assignOrderRecursively(newTree);
    });
    notifications.show({title: 'Structure Changed', message: "Remember to save your changes.", color: "orange", autoClose: 3000});
  }

  const allClientIds = useCallback(() => { // Memoize to prevent re-renders of SortableContext
    const ids: string[] = [];
    const collectIds = (menuItems: MenuItem[]) => {
        for (const item of menuItems) {
            ids.push(item.clientId);
            if (item.children) collectIds(item.children);
        }
    };
    collectIds(items);
    return ids;
  }, [items]);


  if (authStatus === 'loading' || (isFetching && authStatus === 'authenticated')) {
    return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Menu: {menuName || "Loading..."}</Title>
             <Paper withBorder shadow="md" p="lg" radius="md">
                 <Skeleton height={30} width="70%" mb="xl" />
                 <Group justify="space-between" mb="lg"> <Skeleton height={20} width="30%" /> <Skeleton height={36} width={150} /> </Group>
                 <Paper p="xs" mb="xs" withBorder><Group justify="space-between"><Skeleton height={20} width="60%" /><Group gap="xs"><Skeleton height={30} width={100}/><Skeleton circle height={30}/><Skeleton circle height={30}/></Group></Group></Paper>
                 <Paper p="xs" mb="xs" withBorder><Group justify="space-between"><Skeleton height={20} width="50%" /><Group gap="xs"><Skeleton height={30} width={100}/><Skeleton circle height={30}/><Skeleton circle height={30}/></Group></Group></Paper>
                 <Group justify="flex-end" mt="xl"><Skeleton height={36} width={180}/></Group>
             </Paper>
        </AdminLayout>
    );
  }
  // ... (rest of component as before)

  return (
    <AdminLayout>
      <Group justify="space-between" align="center" mb="xl">
        <Title order={2}>Edit Menu: {menuName || "Loading..."}</Title>
        <Button variant="outline" component={Link} href="/admin/settings/navigation" leftSection={<IconArrowLeft size={16}/>}>Back to Menus</Button>
      </Group>
      <Paper withBorder shadow="md" p="lg" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || isFetching} overlayProps={{ radius: 'sm', blur: 1 }}/>
        {apiError && !isLoading && <Alert title="Error" color="red" mb="md" icon={<IconAlertCircle />} withCloseButton onClose={() => setApiError(null)}>{apiError}</Alert>}

        <Group justify="space-between" mb="lg">
          <Text fw={500} size="lg">Menu Items Structure</Text>
          <Button onClick={() => handleOpenModal(undefined, null)} leftSection={<IconPlus size={16}/>} variant="light">Add Root Item</Button>
        </Group>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={allClientIds()} strategy={verticalListSortingStrategy}>
                {items.length === 0 && !isFetching ? (
                  <Text c="dimmed" ta="center" p="xl">No items in this menu yet. Click "Add Root Item" to start.</Text>
                ) : (
                  items.map(item => ( // Render only root items; SortableMenuItem handles children
                    <SortableMenuItem
                        key={item.clientId}
                        item={item}
                        onEdit={handleOpenModal}
                        onDelete={handleDeleteItem}
                        onAddChild={(parentId) => handleOpenModal(undefined, parentId)}
                        level={0}
                        activeId={activeDragId}
                    />
                  ))
                )}
            </SortableContext>
            <DragOverlay dropAnimation={null}>
                {activeDraggedItem ? <SortableMenuItem item={activeDraggedItem} onEdit={()=>{}} onDelete={()=>{}} onAddChild={()=>{}} isOverlay={true} level={activeDraggedItem.parentId === null ? 0 : 1 /* Approximate level for overlay */} /> : null}
            </DragOverlay>
        </DndContext>

        <Group justify="flex-end" mt="xl">
          <Button onClick={handleSaveMenu} leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetching}>Save Menu Structure</Button>
        </Group>
      </Paper>

      <Modal opened={modalOpened} onClose={closeModal} title={editingItem ? 'Edit Menu Item' : (parentClientIdForNewItem ? 'Add Sub-item' : 'Add Root Item')} centered>
        <form onSubmit={itemForm.onSubmit(handleItemFormSubmit)}>
          <TextInput label="Title" placeholder="e.g., Home, About Us" required {...itemForm.getInputProps('title')} mb="sm" />
          <TextInput label="URL" placeholder="e.g., / or /about or #contact" required {...itemForm.getInputProps('url')} mb="md" />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button type="submit">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
          </Group>
        </form>
      </Modal>
      <Space h="xl" />
    </AdminLayout>
  );
}
