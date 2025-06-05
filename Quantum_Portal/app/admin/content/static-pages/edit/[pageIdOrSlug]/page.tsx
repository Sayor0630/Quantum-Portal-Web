'use client';

import AdminLayout from '../../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Switch, Textarea, Space, Text, Skeleton, Grid } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft

import { RichTextEditor, Link as TiptapLink } from '@mantine/tiptap';
import { useEditor, Editor } from '@tiptap/react'; // Imported Editor type
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface StaticPageData { // For form and fetched data
    _id?: string;
    title: string;
    slug: string;
    content: string;
    isPublished: boolean;
    seoTitle?: string;
    seoDescription?: string;
}

const generateSlug = (name: string) => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

const schema = Yup.object().shape({
  title: Yup.string().required('Page title is required'),
  slug: Yup.string().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.').required('Slug is required'),
  content: Yup.string().ensure(),
  isPublished: Yup.boolean(),
  seoTitle: Yup.string().optional().trim().max(70, 'SEO Title should be 70 characters or less'),
  seoDescription: Yup.string().optional().trim().max(160, 'SEO Description should be 160 characters or less'),
});

export default function EditStaticPage() {
  const router = useRouter();
  const params = useParams();
  const pageIdOrSlug = params?.pageIdOrSlug as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isFetchingPage, setIsFetchingPage] = useState(true); // For initial data load
  const [apiError, setApiError] = useState<string | null>(null);
  const [fetchedPageId, setFetchedPageId] = useState<string | null>(null); // Store actual _id
  const [originalSlug, setOriginalSlug] = useState('');


  const form = useForm<Omit<StaticPageData, '_id'>>({ // Omit _id from form values type if not directly managed by form
    initialValues: {
      title: '',
      slug: '',
      content: '',
      isPublished: false,
      seoTitle: '',
      seoDescription: '',
    },
    validate: yupResolver(schema),
  });

  const editor = useEditor({
    extensions: [ StarterKit, TiptapLink, Placeholder.configure({ placeholder: 'Start writing...' }) ],
    content: form.values.content,
    onUpdate: ({ editor: currentEditor }) => { form.setFieldValue('content', currentEditor.getHTML()); },
  });

  const pageTitle = form.values.title;

  // Simplified slug auto-generation logic for edit page
  // We don't auto-update slug on edit to avoid breaking existing URLs
  // Users can manually update if needed


  useEffect(() => {
     if (authStatus === 'unauthenticated') router.replace('/admin/login');
     if (authStatus === 'authenticated' && pageIdOrSlug && !editor?.isDestroyed) { // Ensure editor exists and not destroyed
        const fetchPageData = async () => {
            setIsFetchingPage(true); setApiError(null);
            try {
                const response = await fetch(`/api/admin/static-pages/${pageIdOrSlug}`);
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Failed to fetch page data.');
                }
                const data: StaticPageData = await response.json();

                form.setValues({
                    title: data.title,
                    slug: data.slug,
                    content: data.content || '',
                    isPublished: data.isPublished,
                    seoTitle: data.seoTitle || '',
                    seoDescription: data.seoDescription || '',
                });
                // Set editor content after form values are set
                if (editor && !editor.isDestroyed) { // Check again before using editor
                    editor.commands.setContent(data.content || '', false); // false to avoid re-triggering onUpdate
                }
                setOriginalSlug(data.slug);
                setFetchedPageId(data._id!); // Store the actual ID
            } catch (err: any) {
                setApiError(err.message);
                notifications.show({ title: 'Error Loading Page', message: err.message, color: 'red' });
            } finally {
                setIsFetchingPage(false);
            }
        };
        fetchPageData();
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdOrSlug, authStatus, editor?.isDestroyed]); // form.setValues removed, editor.isDestroyed added


  const handleSubmit = async (values: Omit<StaticPageData, '_id'>) => {
    if (!fetchedPageId) {
        setApiError("Page ID is missing. Cannot update.");
        notifications.show({ title: 'Error', message: 'Page ID missing.', color: 'red' });
        return;
    }
    setIsLoading(true); setApiError(null);
    const currentContent = editor?.getHTML() || '';
    const payload = { ...values, content: currentContent };

    try {
      const response = await fetch(`/api/admin/static-pages/${fetchedPageId}`, { // Use fetchedPageId
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);

      notifications.show({
         title: 'Page Updated', message: `Page "${data.title}" updated successfully.`,
         color: 'green', icon: <IconDeviceFloppy />,
      });
      form.resetDirty(data); // Reset dirty state with new values
      if (editor && !editor.isDestroyed) editor.commands.setContent(data.content || '', false); // Sync editor
      setOriginalSlug(data.slug); // Update original slug
      // router.push('/admin/content/static-pages'); // Optional: redirect or stay
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Updating Page', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  };

  // Ensure editor content is synced if form.values.content changes from elsewhere (e.g. form.setValues)
  useEffect(() => {
    if (editor && !editor.isDestroyed && form.values.content !== editor.getHTML()) {
        editor.commands.setContent(form.values.content, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.content]); // editor removed


  if (authStatus === 'loading' || (isFetchingPage && authStatus === 'authenticated')) {
     return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Static Page</Title>
            <Paper withBorder shadow="md" p="xl" radius="md">
                <Skeleton height={36} mb="sm" /> <Skeleton height={36} mb="md" /> {/* Title, Slug */}
                <Text fw={500} size="sm">Content</Text><Skeleton height={200} mb="md" /> {/* RTE */}
                <Skeleton height={36} mb="md" width={150}/> {/* Switch */}
                <Title order={4} mt="lg" mb="sm">SEO Settings</Title>
                <Skeleton height={36} mb="sm" /> <Skeleton height={76} mb="xl" /> {/* SEO Title, Desc */}
                <Group justify="flex-end" mt="xl"><Skeleton height={36} width={100}/><Skeleton height={36} width={120}/></Group>
            </Paper>
        </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;
  if (apiError && !isFetchingPage && !isLoading && !form.isDirty()) { // Show critical fetch error
    return (
        <AdminLayout>
             <Group justify="space-between" mb="xl"> <Title order={2}>Edit Static Page</Title> <Button variant="outline" component={Link} href="/admin/content/static-pages" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert icon={<IconAlertCircle size="1rem" />} title="Failed to load page data" color="red">{apiError}</Alert>
        </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Edit Static Page: {form.values.title || "Loading..."}</Title>
        <Button variant="outline" component={Link} href="/admin/content/static-pages" leftSection={<IconArrowLeft size={16}/>}>
            Back to Pages
        </Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{radius:'sm', blur:1}}/>
        {apiError && !isLoading && <Alert icon={<IconAlertCircle />} title="Save Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Page Title" placeholder="e.g., About Us, FAQ" required {...form.getInputProps('title')} mb="sm" />
        <TextInput label="Slug" placeholder="e.g., about-us" required description="URL-friendly identifier. Manually edit or clear to auto-generate from title." {...form.getInputProps('slug')}
            onChange={(event) => {
                form.setFieldValue('slug', generateSlug(event.currentTarget.value));
                form.setDirty({slug: true});
            }}
            mb="md" />

        <Text fw={500} size="sm" mt="md">Content</Text>
        <RichTextEditor editor={editor} mb="md" style={{ minHeight: 300, maxHeight: 600, overflowY: 'auto' }}>
          <RichTextEditor.Toolbar sticky stickyOffset={60}>
            <RichTextEditor.ControlsGroup><RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline /><RichTextEditor.Strikethrough /><RichTextEditor.ClearFormatting /><RichTextEditor.Code /></RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup><RichTextEditor.H1 /><RichTextEditor.H2 /><RichTextEditor.H3 /><RichTextEditor.H4 /></RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup><RichTextEditor.Blockquote /><RichTextEditor.Hr /><RichTextEditor.BulletList /><RichTextEditor.OrderedList /></RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup><RichTextEditor.Link /><RichTextEditor.Unlink /></RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content />
        </RichTextEditor>

        <Switch label="Publish Page" {...form.getInputProps('isPublished', { type: 'checkbox' })} mb="md" />

        <Title order={4} mt="lg" mb="sm">SEO Settings (Optional)</Title>
        <TextInput label="SEO Title" placeholder="Custom title for search engines (max 70 chars)" {...form.getInputProps('seoTitle')} mb="sm" />
        <Textarea label="SEO Description" placeholder="Brief description for search engines (max 160 chars)" autosize minRows={2} {...form.getInputProps('seoDescription')} mb="xl" />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/content/static-pages')} leftSection={<IconX size={16}/>} disabled={isLoading || isFetchingPage}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetchingPage || isLoading || !form.isDirty()}>Save Changes</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
