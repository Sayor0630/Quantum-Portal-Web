'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Switch, Textarea, Space, Text } from '@mantine/core'; // Added Text
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { IconDeviceFloppy, IconAlertCircle, IconX } from '@tabler/icons-react'; // Removed IconPlus as not used

import { RichTextEditor, Link } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

const generateSlug = (name: string) => {
    if (!name) return '';
    return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const schema = Yup.object().shape({
  title: Yup.string().required('Page title is required'),
  slug: Yup.string().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens and no leading/trailing/multiple hyphens.').required('Slug is required'),
  content: Yup.string().ensure(),
  isPublished: Yup.boolean(),
  seoTitle: Yup.string().optional().trim().max(70, 'SEO Title should be 70 characters or less'),
  seoDescription: Yup.string().optional().trim().max(160, 'SEO Description should be 160 characters or less'),
});

export default function NewStaticPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
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
    extensions: [
      StarterKit,
      Link,
      Placeholder.configure({ placeholder: 'Start writing your page content here...' }),
    ],
    content: form.values.content,
    onUpdate: ({ editor: currentEditor }) => {
      form.setFieldValue('content', currentEditor.getHTML());
    },
  });

  const [isSlugManuallySet, setIsSlugManuallySet] = useState(false);

  // Slug auto-generation logic using product pattern
  const pageTitle = form.values.title;

  useEffect(() => {
    if (pageTitle && (!form.values.slug || !isSlugManuallySet)) {
      form.setFieldValue('slug', generateSlug(pageTitle));
    }
  }, [pageTitle, isSlugManuallySet]);

  useEffect(() => {
     if (authStatus === 'unauthenticated') router.replace('/admin/login');
  }, [authStatus, router]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);
    const currentContent = editor?.getHTML() || ''; // Ensure latest content
    const payload = { ...values, content: currentContent };

    try {
      const response = await fetch('/api/admin/static-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);

      notifications.show({
         title: 'Page Created',
         message: `Page "${data.title}" created successfully.`,
         color: 'green', icon: <IconDeviceFloppy />, // Changed icon
      });
      router.push('/admin/content/static-pages');
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Creating Page', message: err.message, color: 'red', icon: <IconAlertCircle /> });
    } finally {
      setIsLoading(false);
    }
  };

  // Sync form value back to editor if form value changes externally (e.g. reset, though not used here yet)
  useEffect(() => {
     if (editor && form.values.content !== editor.getHTML()) {
         editor.commands.setContent(form.values.content, false); // false to avoid re-triggering onUpdate
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.content]); // editor removed from deps to avoid loop on init


  if (authStatus === 'loading') {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed: true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Add New Static Page</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{radius:'sm', blur:2}} />
        {apiError && <Alert icon={<IconAlertCircle size="1rem" />} title="API Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Page Title" placeholder="e.g., About Us, FAQ" required {...form.getInputProps('title')} mb="sm" />
        <TextInput
            label="Slug"
            placeholder="e.g., about-us (auto-generated)"
            required
            description="URL-friendly identifier. Auto-generated from title, or customize it."
            {...form.getInputProps('slug')}
            onChange={(event) => {
                form.setFieldValue('slug', generateSlug(event.currentTarget.value));
                if (document.activeElement === event.currentTarget) setIsSlugManuallySet(true);
            }}
            mb="md"
        />

        <Text fw={500} size="sm" mt="md">Content</Text>
        <RichTextEditor editor={editor} mb="md" style={{ minHeight: 250 }}>
          <RichTextEditor.Toolbar sticky stickyOffset={60}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold /> <RichTextEditor.Italic /> <RichTextEditor.Underline /> <RichTextEditor.Strikethrough /> <RichTextEditor.ClearFormatting /> <RichTextEditor.Code />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H1 /> <RichTextEditor.H2 /> <RichTextEditor.H3 /> <RichTextEditor.H4 />
            </RichTextEditor.ControlsGroup>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote /> <RichTextEditor.Hr /> <RichTextEditor.BulletList /> <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>
             <RichTextEditor.ControlsGroup>
                 <RichTextEditor.Link /> <RichTextEditor.Unlink />
             </RichTextEditor.ControlsGroup>
             {/* Add more controls as needed, e.g., Align, Subscript, Superscript */}
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content />
        </RichTextEditor>

        <Switch label="Publish Page" {...form.getInputProps('isPublished', { type: 'checkbox' })} mb="md" />

        <Title order={4} mt="lg" mb="sm">SEO Settings (Optional)</Title>
        <TextInput label="SEO Title" placeholder="Custom title for search engines (max 70 chars)" {...form.getInputProps('seoTitle')} mb="sm" />
        <Textarea label="SEO Description" placeholder="Brief description for search engines (max 160 chars)" autosize minRows={2} {...form.getInputProps('seoDescription')} mb="xl" />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/content/static-pages')} leftSection={<IconX size={16} />} disabled={isLoading}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading}>Save Page</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
