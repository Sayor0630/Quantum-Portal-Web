'use client';

import { TextInput, PasswordInput, Button, Paper, Title, Container, Group, Alert, LoadingOverlay, Space, Anchor } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Using App Router's navigation
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link'; // For Next.js style links

// Yup validation schema
const schema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'), // Increased min length
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

export default function AdminRegistrationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: yupResolver(schema),
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // The /api/admin/register endpoint (created in Subtask 4, Turn 34)
      // expects email, password, and optionally role (defaults to 'admin').
      const response = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
        // Role will be defaulted to 'admin' by the API if not sent.
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      setSuccess('Registration successful! You can now log in.');
      form.reset();
      // Consider redirecting to login after a short delay or providing a button
      // setTimeout(() => router.push('/admin/login'), 3000);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" style={{ marginBottom: '1.5rem' }}>
        Admin Registration
      </Title>
      <Paper withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: "sm", blur: 2 }} />

        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Registration Error"
            color="red"
            withCloseButton
            onClose={() => setError(null)}
            mb="md"
          >
            {error}
          </Alert>
        )}
        {success && (
           <Alert
             title="Success!"
             color="green"
             withCloseButton
             onClose={() => setSuccess(null)}
             mb="md"
           >
             {success}
           </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password (min. 8 characters)"
            required
            mt="md"
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm Password"
            placeholder="Confirm your password"
            required
            mt="md"
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" fullWidth mt="xl" disabled={isLoading}>
            Register
          </Button>
        </form>
        <Group mt="md" justify="center">
          <Anchor component={Link} href="/admin/login" size="sm">
            Already have an account? Login
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}
