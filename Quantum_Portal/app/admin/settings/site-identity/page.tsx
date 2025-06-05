'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Space, ColorInput, SimpleGrid, Divider, ThemeIcon, Grid } from '@mantine/core'; // Added ThemeIcon
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconPalette, IconWorld } from '@tabler/icons-react';

interface ThemeColors {
  primaryColor: string;
  accentColor: string;
}
interface SiteConfigData {
  _id?: string;
  siteName: string;
  logoUrl?: string | null; // Allow null from API
  faviconUrl?: string | null; // Allow null from API
  themeSettings: {
    lightMode: ThemeColors;
    darkMode: ThemeColors;
  };
}

const hexColorValidation = Yup.string()
    .matches(/^#(?:[0-9a-fA-F]{3,4}){1,2}$/, 'Must be a valid hex color (e.g., #RRGGBB, #RGB, #RRGGBBAA, #RGBA)')
    .required('Color is required');
const urlValidation = Yup.string().url('Must be a valid URL').nullable().transform(value => value === "" ? null : value);

const schema = Yup.object().shape({
  siteName: Yup.string().required('Site name is required'),
  logoUrl: urlValidation,
  faviconUrl: urlValidation,
  themeSettings: Yup.object().shape({
    lightMode: Yup.object().shape({
      primaryColor: hexColorValidation,
      accentColor: hexColorValidation,
    }),
    darkMode: Yup.object().shape({
      primaryColor: hexColorValidation,
      accentColor: hexColorValidation,
    }),
  }),
});

export default function SiteIdentitySettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<SiteConfigData>({
    initialValues: {
      siteName: '',
      logoUrl: '',
      faviconUrl: '',
      themeSettings: {
        lightMode: { primaryColor: '#FFFFFF', accentColor: '#228be6' }, // Default Mantine blue
        darkMode: { primaryColor: '#1A1B1E', accentColor: '#228be6' }, // Default Mantine dark and blue
      },
    },
    validate: yupResolver(schema),
  });

  const fetchSiteConfig = useCallback(async () => {
    setIsFetching(true);
    setApiError(null);
    try {
      const response = await fetch('/api/admin/site-config');
      if (!response.ok) {
        const errorData = await response.json();
        // If config doesn't exist, API creates default, so this might not be an "error"
        // but rather initial setup. The form will have initialValues.
        if (response.status === 404 && errorData.message?.includes("No configuration found")) {
            notifications.show({ title: 'Initial Setup', message: 'No existing configuration. Using default values.', color: 'blue' });
            // form already has initialValues, so no need to set them again unless API returns defaults
        } else {
            throw new Error(errorData.message || 'Failed to fetch site configuration.');
        }
      }
      const data: SiteConfigData = await response.json();
      // Ensure form values are updated correctly, especially for potentially null URLs
      form.setValues({
        ...data,
        logoUrl: data.logoUrl || '',
        faviconUrl: data.faviconUrl || '',
        themeSettings: data.themeSettings || {
          lightMode: { primaryColor: '#228be6', accentColor: '#fd7e14' },
          darkMode: { primaryColor: '#339af0', accentColor: '#ffa94d' }
        }, // Ensure themeSettings exist
      });
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Loading Configuration', message: err.message, color: 'red' });
    } finally {
      setIsFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // form.setValues should not be a dependency here

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    if (authStatus === 'authenticated') fetchSiteConfig();
  }, [authStatus, router, fetchSiteConfig]);

  const handleSubmit = async (values: SiteConfigData) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const payload = {
         ...values,
         logoUrl: values.logoUrl || null, // Send null if empty string
         faviconUrl: values.faviconUrl || null, // Send null if empty string
      };

      const response = await fetch('/api/admin/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update site configuration.');

      notifications.show({
         title: 'Configuration Saved',
         message: 'Site identity and theme settings have been updated.',
         color: 'green',
         icon: <IconDeviceFloppy />,
      });
      // Re-set form with potentially processed data from API to ensure consistency
      form.setValues({
        ...data,
        logoUrl: data.logoUrl || '',
        faviconUrl: data.faviconUrl || '',
      });
      form.resetDirty(); // Reset dirty state after successful save

    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Save Error', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || (isFetching && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm',blur:2, fixed:true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Site Identity & Theme Settings</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative"> {/* Increased padding */}
        <LoadingOverlay visible={isLoading || (isFetching && authStatus === 'authenticated')} overlayProps={{ radius: 'sm', blur: 1 }} />
        {apiError && (
          <Alert icon={<IconAlertCircle size="1rem"/>} title="Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">
            {apiError}
          </Alert>
        )}

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 6 }}>
             <Paper p="lg" withBorder radius="md" h="100%"> {/* Changed style to h="100%" for equal height */}
                <Group gap="sm" mb="lg"> {/* Increased mb */}
                    <ThemeIcon variant="light" size="xl"><IconWorld size="1.5rem" /></ThemeIcon>
                    <Title order={3}>Site Identity</Title>
                </Group>
                <TextInput label="Site Name" placeholder="Your Awesome Store" required {...form.getInputProps('siteName')} mb="md" />
                <TextInput label="Logo URL" placeholder="https://example.com/logo.png" {...form.getInputProps('logoUrl')} mb="md" />
                <TextInput label="Favicon URL" placeholder="https://example.com/favicon.ico" {...form.getInputProps('faviconUrl')} />
             </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
             <Paper p="lg" withBorder radius="md" h="100%">
                <Group gap="sm" mb="lg">
                    <ThemeIcon variant="light" size="xl"><IconPalette size="1.5rem" /></ThemeIcon>
                    <Title order={3}>Theme Colors</Title>
                </Group>
                <Text size="sm" fw={500} mb="xs">Light Mode</Text>
                <SimpleGrid cols={2} mb="md">
                    <ColorInput label="Primary Color" placeholder="#FFFFFF" required {...form.getInputProps('themeSettings.lightMode.primaryColor')} />
                    <ColorInput label="Accent Color" placeholder="#228be6" required {...form.getInputProps('themeSettings.lightMode.accentColor')} />
                </SimpleGrid>
                <Divider my="md" />
                <Text size="sm" fw={500} mb="xs">Dark Mode</Text>
                <SimpleGrid cols={2} mb="sm">
                    <ColorInput label="Primary Color" placeholder="#1A1B1E" required {...form.getInputProps('themeSettings.darkMode.primaryColor')} />
                    <ColorInput label="Accent Color" placeholder="#228be6" required {...form.getInputProps('themeSettings.darkMode.accentColor')} />
                </SimpleGrid>
             </Paper>
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="xl">
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetching || isLoading || !form.isDirty()}>
             Save Settings
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
