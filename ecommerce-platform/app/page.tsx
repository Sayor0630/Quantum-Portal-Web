import { Title, Text, Container, Space, Paper, Group, Button } from '@mantine/core';
import Link from 'next/link'; // For linking to admin if desired

// This page should use the root layout (app/layout.tsx) which includes MantineProvider.

export default function HomePage() {
  return (
    <Container size="md" py="xl" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Paper p="xl" shadow="xs" withBorder radius="md">
        <Title order={1} ta="center" mb="lg">
          Welcome to Our Store!
        </Title>
        <Text ta="center" size="lg" c="dimmed">
          Our full customer-facing experience is launching soon.
        </Text>
        <Text ta="center" mt="md">
          Stay tuned for exciting products and offers!
        </Text>
        <Space h="xl" />
        <Text size="xs" ta="center" c="dimmed">
           (This is the public-facing homepage placeholder)
        </Text>

        {/*
          A discreet link to the admin panel for convenience during development/admin access.
          This would typically not be on a live customer-facing homepage.
          Consider removing or placing under an environment variable for production.
        */}
        <Group justify="center" mt="xl">
            <Button component={Link} href="/admin" variant="light" size="xs">
                Admin Panel
            </Button>
        </Group>
      </Paper>
    </Container>
  );
}
