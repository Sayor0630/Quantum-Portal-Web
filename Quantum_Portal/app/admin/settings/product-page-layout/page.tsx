'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Button, Group, LoadingOverlay, Alert, Space, Switch, ThemeIcon, Box, ActionIcon } from '@mantine/core'; // Added ActionIcon
import { useForm } from '@mantine/form';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconSettings, IconGripVertical, IconEye, IconEyeOff } from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay, // For smoother dragging visuals if needed
  TouchSensor, // For touch devices
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PageSection {
  sectionId: string;
  name: string;
  isVisible: boolean;
  order: number;
  // Add _id if your API uses it and it's different from sectionId for DND keying
  // For this example, sectionId is assumed to be the unique key for DND items.
}

// SortableItem component for DND Kit
function SortableSectionItem({ id, section, onVisibilityToggle }: { id: string, section: PageSection, onVisibilityToggle: (sectionId: string, isVisible: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id }); // Use the passed 'id' prop for useSortable

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.7 : 1, // Slightly transparent when dragging
    cursor: 'grab', // Indicate draggable
  };

  return (
    <Paper ref={setNodeRef} style={style} withBorder p="md" mb="sm" shadow={isDragging ? 'xl' : 'xs'}>
      <Group justify="space-between">
        <Group>
          <ActionIcon {...listeners} {...attributes} variant="transparent" c="dimmed" title="Drag to reorder" style={{ cursor: 'grab' }}>
             <IconGripVertical size={20} stroke={1.5} />
          </ActionIcon>
          <Text fw={500}>{section.name}</Text>
        </Group>
        <Switch
          // label={section.isVisible ? 'Visible' : 'Hidden'} // Label might be redundant with icon
          checked={section.isVisible}
          onChange={(event) => onVisibilityToggle(section.sectionId, event.currentTarget.checked)}
          onLabel={<IconEye size={14} />}
          offLabel={<IconEyeOff size={14} />}
          size="md"
        />
      </Group>
    </Paper>
  );
}


export default function ProductPageLayoutSettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [sections, setSections] = useState<PageSection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null); // For DragOverlay item styling

  const sensors = useSensors(
     useSensor(PointerSensor),
     useSensor(TouchSensor), // Added TouchSensor for mobile
     useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchLayoutConfig = useCallback(async () => {
    setIsFetching(true); setApiError(null);
    try {
      const response = await fetch('/api/admin/product-page-layout');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch layout configuration.');
      }
      const data: { sections: PageSection[] } = await response.json();
      setSections(data.sections.sort((a, b) => a.order - b.order));
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Loading Layout', message: err.message, color: 'red' });
      setSections([]); // Set to empty or default on error
    } finally { setIsFetching(false); }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    if (authStatus === 'authenticated') fetchLayoutConfig();
  }, [authStatus, router, fetchLayoutConfig]);

  const handleVisibilityToggle = (sectionId: string, isVisible: boolean) => {
     setSections((currentSections) =>
         currentSections.map((s) => (s.sectionId === sectionId ? { ...s, isVisible } : s))
     );
  };

  function handleDragStart(event: any) { // Using any for event for simplicity with DragOverlay
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
     setActiveId(null);
     const { active, over } = event;
     if (over && active.id !== over.id) {
         setSections((items) => {
             const oldIndex = items.findIndex((item) => item.sectionId === active.id);
             const newIndex = items.findIndex((item) => item.sectionId === over.id);
             const newOrderedItems = arrayMove(items, oldIndex, newIndex);
             return newOrderedItems.map((item, index) => ({ ...item, order: index }));
         });
     }
  }

  const handleSubmit = async () => {
    setIsLoading(true); setApiError(null);
    const sectionsToSave = sections.map(({ sectionId, name, isVisible, order }) => ({ sectionId, name, isVisible, order }));

    try {
      const response = await fetch('/api/admin/product-page-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: sectionsToSave }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update layout.');

      notifications.show({
         title: 'Layout Saved', message: 'Product page layout updated successfully.', color: 'green', icon: <IconDeviceFloppy />,
      });
      setSections(data.sections.sort((a: PageSection,b: PageSection) => a.order - b.order));
      form.resetDirty(); // If using useForm, reset dirty state
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Save Error', message: err.message, color: 'red' });
    } finally { setIsLoading(false); }
  };
   // Dummy form for form.resetDirty() - not actually used for inputs here
   const form = useForm();

  if (authStatus === 'loading' || (isFetching && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm',blur:2, fixed: true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  const activeSection = activeId ? sections.find(s => s.sectionId === activeId) : null;

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
         <Title order={2}>Product Page Layout</Title>
         <Button onClick={handleSubmit} leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetching || !form.isDirty() && sections === form.values.initialSectionsSnapshot}> {/* Disable if no changes */}
             Save Layout
         </Button>
      </Group>
      <Text c="dimmed" mb="md">
         Organize and toggle visibility of sections on the product detail page. Drag and drop to reorder.
      </Text>

      {apiError && <Alert title="Error" color="red" icon={<IconAlertCircle/>} withCloseButton onClose={() => setApiError(null)} mb="lg">{apiError}</Alert>}

      <Paper withBorder shadow="sm" radius="md" p="md" pos="relative">
         <LoadingOverlay visible={isLoading || (isFetching && sections.length === 0)} overlayProps={{blur:1}} /> {/* Show overlay if fetching and no sections yet */}
         {!isFetching && sections.length === 0 && !apiError && (
             <Text p="xl" ta="center" c="dimmed">No layout sections found. Default layout might be applied by API on save.</Text>
         )}
         {sections.length > 0 && (
             <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
             >
                 <SortableContext items={sections.map(s => s.sectionId)} strategy={verticalListSortingStrategy}>
                     <Box>
                         {sections.map((section) => (
                             <SortableSectionItem
                                 key={section.sectionId}
                                 id={section.sectionId} // Pass sectionId as id to useSortable
                                 section={section}
                                 onVisibilityToggle={handleVisibilityToggle}
                             />
                         ))}
                     </Box>
                 </SortableContext>
                 <DragOverlay>
                    {activeSection ? <SortableSectionItem id={activeSection.sectionId} section={activeSection} onVisibilityToggle={() => {}} /> : null}
                 </DragOverlay>
             </DndContext>
         )}
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
