'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Button, Group, LoadingOverlay, Alert, Space, Switch, ThemeIcon, ActionIcon, Badge, Box } from '@mantine/core'; // Added Box
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconSettings, IconGripVertical, IconEye, IconEyeOff, IconPlus, IconPencil, IconTrash, IconLayoutDashboard } from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
  DragOverlay, // For better visual feedback while dragging
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { modals } from '@mantine/modals';


interface HomepageSection {
  _id: string;
  name: string;
  type: 'hero' | 'banner' | 'productCarousel' | 'categoryList' | 'promotionalBlock' | 'customHtml' | 'featuredProducts';
  order: number;
  isVisible: boolean;
  // content might not be fully needed here, but API might return it
}

// SortableItem component for DND Kit
function SortableSectionItem({
     section,
     onVisibilityToggle,
     onEdit, // Passed to component, but Link handles navigation
     onDelete,
     isSavingVisibility,
     isDeleting // for delete button loading
 }: {
     section: HomepageSection,
     onVisibilityToggle: (sectionId: string, isVisible: boolean) => void,
     onEdit: (sectionId: string) => void, // Kept for consistency if direct function needed
     onDelete: (sectionId: string, sectionName: string) => void,
     isSavingVisibility: boolean,
     isDeleting: boolean
 }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.6 : 1, // More pronounced opacity when dragging
  };

  return (
    <Paper ref={setNodeRef} style={style} {...attributes} withBorder p="md" mb="sm" shadow={isDragging ? 'xl' : 'xs'}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap"> {/* Ensure drag handle and text are close */}
          <ActionIcon {...listeners} variant="transparent" c="dimmed" title="Drag to reorder" style={{ cursor: 'grab' }} disabled={isSavingVisibility || isDeleting}>
             <IconGripVertical size={20} stroke={1.5} />
          </ActionIcon>
          <div>
             <Text fw={500}>{section.name}</Text>
             <Badge variant="outline" size="sm" color="gray">{section.type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Badge>
          </div>
        </Group>
        <Group gap="xs" wrap="nowrap">
             <Switch
                 // label={section.isVisible ? 'Visible' : 'Hidden'}
                 checked={section.isVisible}
                 onChange={(event) => onVisibilityToggle(section._id, event.currentTarget.checked)}
                 onLabel={<IconEye size={14} />}
                 offLabel={<IconEyeOff size={14} />}
                 disabled={isSavingVisibility || isDeleting}
                 size="md"
             />
             <Button size="xs" variant="light" leftSection={<IconPencil size={14}/>} component={Link} href={`/admin/homepage-builder/edit/${section._id}`} disabled={isSavingVisibility || isDeleting}>Edit Content</Button>
             <ActionIcon variant="light" color="red" size="lg" onClick={() => onDelete(section._id, section.name)} loading={isDeleting} disabled={isSavingVisibility || isDeleting}><IconTrash size={16}/></ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}


export default function HomepageBuilderPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [isLoading, setIsLoading] = useState(false); // For saving order
  const [isFetching, setIsFetching] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null); // For delete button on row
  const [activeDragId, setActiveDragId] = useState<string | null>(null); // For DragOverlay


  const sensors = useSensors(
     useSensor(PointerSensor), 
     useSensor(TouchSensor),
     useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchHomepageSections = useCallback(async () => {
    setIsFetching(true); setApiError(null);
    try {
      const response = await fetch('/api/admin/homepage-sections');
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch sections.');
      const data: HomepageSection[] = await response.json();
      setSections(data.sort((a, b) => a.order - b.order));
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Loading Sections', message: err.message, color: 'red' });
    } finally { setIsFetching(false); }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    if (authStatus === 'authenticated') fetchHomepageSections();
  }, [authStatus, router, fetchHomepageSections]);

  const handleVisibilityToggle = async (sectionId: string, isVisible: boolean) => {
     setSavingVisibilityId(sectionId);
     const originalSections = sections.map(s => ({...s}));
     setSections((currentSections) =>
         currentSections.map((s) => (s._id === sectionId ? { ...s, isVisible } : s))
     );
     try {
         const sectionToUpdate = originalSections.find(s => s._id === sectionId);
         if (!sectionToUpdate) throw new Error("Section not found for visibility update.");
         // API for individual section update expects the whole section or specific fields
         // Current API PUT /api/admin/homepage-sections/:id takes { name, type, order, isVisible, content }
         // So we send the relevant parts or ensure API handles partials correctly.
         const payload = { ...sectionToUpdate, isVisible };

         const response = await fetch(`/api/admin/homepage-sections/${sectionId}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload),
         });
         const data = await response.json();
         if (!response.ok) throw new Error(data.message || 'Failed to update visibility.');
         notifications.show({ title: 'Visibility Updated', message: `Section "${data.name}" visibility updated.`, color: 'blue', icon: isVisible ? <IconEye/> : <IconEyeOff/> });
         setSections((currentSections) => // Update with response for consistency
             currentSections.map((s) => (s._id === sectionId ? data : s)).sort((a,b) => a.order - b.order)
         );
     } catch (err: any) {
         notifications.show({ title: 'Error Updating Visibility', message: err.message, color: 'red' });
         setSections(originalSections);
     } finally {
         setSavingVisibilityId(null);
     }
  };

  function handleDragStart(event: DragEndEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
     setActiveDragId(null);
     const { active, over } = event;
     if (over && active.id !== over.id) {
         setSections((items) => {
             const oldIndex = items.findIndex((item) => item._id === active.id);
             const newIndex = items.findIndex((item) => item._id === over.id);
             // No need to update 'order' property here if it's only for display and save takes array index
             return arrayMove(items, oldIndex, newIndex);
         });
         notifications.show({title: "Order Changed", message: "Remember to save the new section order.", color: "orange"});
     }
  }

  const handleSaveOrder = async () => {
    setIsLoading(true); setApiError(null);
    // Update order property based on current array index before saving
    const sectionsToSave = sections.map((section, index) => ({ ...section, order: index }));

    try {
      // API for bulk reorder expects array of {_id, order}
      const payloadForApi = sectionsToSave.map(s => ({_id: s._id, order: s.order}));
      const response = await fetch(`/api/admin/homepage-sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForApi), // Send only _id and new order
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update sections order.');

      notifications.show({ title: 'Layout Order Saved', message: 'Homepage sections order updated successfully.', color: 'green', icon: <IconDeviceFloppy /> });
      setSections(sectionsToSave); // Update local state with new order numbers
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Save Order Error', message: err.message, color: 'red' });
    } finally { setIsLoading(false); }
  };

  const handleDeleteSection = (sectionId: string, sectionName: string) => {
     modals.openConfirmModal({
         title: 'Delete Homepage Section', centered: true,
         children: (<Text size="sm">Are you sure you want to delete the section "<strong>{sectionName}</strong>"? This action is permanent.</Text>),
         labels: { confirm: 'Delete Section', cancel: 'Cancel' }, confirmProps: { color: 'red' },
         onConfirm: async () => {
             setDeletingSectionId(sectionId);
             try {
                 const response = await fetch(`/api/admin/homepage-sections/${sectionId}`, { method: 'DELETE' });
                 if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || 'Failed to delete section.');
                 }
                 setSections(prev => prev.filter(s => s._id !== sectionId));
                 notifications.show({ title: 'Section Deleted', message: `Section "${sectionName}" deleted.`, color: 'green', icon: <IconTrash /> });
             } catch (err: any) {
                 notifications.show({ title: 'Error Deleting Section', message: err.message, color: 'red', icon: <IconAlertCircle /> });
             } finally {
                 setDeletingSectionId(null);
             }
         },
     });
  };

  if (authStatus === 'loading' || (isFetching && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed: true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  const draggedSection = activeDragId ? sections.find(s => s._id === activeDragId) : null;

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
         <Title order={2}><Group gap="xs"><IconLayoutDashboard />Homepage Builder</Group></Title>
         <Group>
             <Button component={Link} href="/admin/homepage-builder/new" leftSection={<IconPlus size={16}/>} variant="outline">Add New Section</Button>
             <Button onClick={handleSaveOrder} leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetching || sections.length === 0}>
                 Save Section Order
             </Button>
         </Group>
      </Group>
      <Text c="dimmed" mb="md">
         Manage sections displayed on your homepage. Drag and drop to reorder. Toggle visibility using the switch.
      </Text>

      {apiError && <Alert title="Error" color="red" icon={<IconAlertCircle/>} withCloseButton onClose={() => setApiError(null)} mb="lg">{apiError}</Alert>}

      <Paper withBorder shadow="sm" radius="md" p={sections.length > 0 ? "md" : 0} pos="relative"> {/* No padding if empty to center text */}
         <LoadingOverlay visible={isFetching && sections.length > 0} overlayProps={{blur:1}} />
         {!isFetching && sections.length === 0 && !apiError && (
             <Text p="xl" ta="center" c="dimmed">No homepage sections defined yet. Click "Add New Section" to start.</Text>
         )}
         {sections.length > 0 && (
             <DndContext
                 sensors={sensors}
                 collisionDetection={closestCenter}
                 onDragStart={handleDragStart}
                 onDragEnd={handleDragEnd}
             >
                 <SortableContext items={sections.map(s => s._id)} strategy={verticalListSortingStrategy}>
                     <Box>
                         {sections.map((section) => (
                             <SortableSectionItem
                                 key={section._id}
                                 section={section}
                                 onVisibilityToggle={handleVisibilityToggle}
                                 onEdit={() => router.push(`/admin/homepage-builder/edit/${section._id}`)}
                                 onDelete={handleDeleteSection}
                                 isSavingVisibility={savingVisibilityId === section._id}
                                 isDeleting={deletingSectionId === section._id}
                             />
                         ))}
                     </Box>
                 </SortableContext>
                 <DragOverlay dropAnimation={null}>
                    {draggedSection ? <SortableSectionItem section={draggedSection} onVisibilityToggle={() => {}} onEdit={() => {}} onDelete={() => {}} isSavingVisibility={false} isDeleting={false} /> : null}
                 </DragOverlay>
             </DndContext>
         )}
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
