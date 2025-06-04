'use client';

import { TextInput, PasswordInput, Button, Paper, Title, Container, Alert, LoadingOverlay, Space, Group, Anchor } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react'; // Added useEffect
import { signIn } from 'next-auth/react'; // NextAuth hook for client-side sign-in
import { useRouter, useSearchParams } from 'next/navigation'; // Using App Router's navigation
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link'; // For the registration link

// Yup validation schema
const schema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin'; // Default redirect to admin dashboard
  const initialError = searchParams.get('error'); // Get error from URL params

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialError && !error) { // Display error from URL only once if no form error is set
        if (initialError === 'CredentialsSignin') {
            setError('Invalid email or password. Please try again.');
        } else if (initialError === 'Callback') {
            setError('There was an issue with the login flow. Please try again.');
        }
         else {
            setError('An unexpected error occurred during login.');
        }
    }
  }, [initialError, error]);


  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: yupResolver(schema),
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      const result = await signIn('credentials', {
        redirect: false, // Handle redirect manually to show errors
        email: values.email,
        password: values.password,
        // callbackUrl is implicitly handled by NextAuth if signIn is successful and redirect is true,
        // but here we handle it manually for better UX on error.
      });

      if (result?.error) {
        let errorMessage = 'Login failed. Please check your credentials.';
        if (result.error === 'CredentialsSignin') {
          errorMessage = 'Invalid email or password.';
        } else if (result.error.includes('ECONNREFUSED')) { // This is a generic check
          errorMessage = 'Cannot connect to the authentication server. Please try again later.';
        } else if (result.error === 'Callback'){
            errorMessage = 'Login callback error. Please try again.';
        }
        setError(errorMessage);
      } else if (result?.ok) {
        // Successful login
        router.push(callbackUrl); // Manually redirect to the intended page or admin dashboard
      } else {
        // Should not happen if result.error or result.ok is not set, but as a fallback
        setError('An unexpected error occurred during login.');
      }
    } catch (err: any) {
      // Catch any exception during the signIn process itself (e.g., network issue before request is made)
      setError(err.message || 'An unexpected network error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" style={{ marginBottom: '1.5rem' }}>Admin Login</Title>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: "sm", blur: 2 }} />

        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Login Error!"
            color="red"
            withCloseButton
            onClose={() => {
                setError(null);
                // If the error came from URL, clear it from URL too to prevent re-display on manual refresh
                if (searchParams.get('error')) {
                    router.replace('/admin/login', { scroll: false });
                }
            }}
            mb="md"
          >
            {error}
          </Alert>
        )}
        <Space h={error ? 0 : "md"} /> {/* Adjust space if no error is initially shown */}


        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mt="md"
            {...form.getInputProps('password')}
          />
          <Button type="submit" fullWidth mt="xl" disabled={isLoading}>
            Login
          </Button>
        </form>
        <Group mt="md" justify="center">
          <Anchor component={Link} href="/admin/register" size="sm">
             Don&apos;t have an account? Register
          </Anchor>
        </Group>
      </Paper>
    </Container>
  );
}
