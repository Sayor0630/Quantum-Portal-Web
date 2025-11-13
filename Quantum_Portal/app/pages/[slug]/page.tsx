'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Box, Container, Title, Text, LoadingOverlay, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { SegmentRenderer } from '../../../components/frontend/SegmentRenderer';
import Head from 'next/head';

interface DynamicPageData {
  title: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  segments: any[];
  pageSettings: {
    headerVisible: boolean;
    footerVisible: boolean;
  };
}

export default function DynamicPageView() {
  const params = useParams();
  const slug = params?.slug as string;

  const [pageData, setPageData] = useState<DynamicPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/public/dynamic-pages/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Page not found');
          }
          throw new Error('Failed to load page');
        }

        const data = await response.json();
        setPageData(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  if (isLoading) {
    return (
      <Box style={{ minHeight: '100vh', position: 'relative' }}>
        <LoadingOverlay visible={true} />
      </Box>
    );
  }

  if (error || !pageData) {
    return (
      <Container size="md" py="xl">
        <Alert title="Error" color="red" icon={<IconAlertCircle />}>
          {error || 'Page not found'}
        </Alert>
      </Container>
    );
  }

  // Sort segments by order
  const sortedSegments = [...pageData.segments].sort((a, b) => a.order - b.order);

  return (
    <>
      <Head>
        <title>{pageData.seoTitle || pageData.title}</title>
        {pageData.seoDescription && <meta name="description" content={pageData.seoDescription} />}
        {pageData.ogImage && <meta property="og:image" content={pageData.ogImage} />}
      </Head>

      <Box>
        {sortedSegments.map((segment) => (
          <SegmentRenderer key={segment.segmentId || segment._id} segment={segment} />
        ))}
      </Box>
    </>
  );
}
