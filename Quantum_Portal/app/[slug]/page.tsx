'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Alert, Box } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { GridRenderer } from '../../components/frontend/GridRenderer';
import { applyBindingsToPage, BindingContext } from '../../utils/dataBindingResolver';
import Head from 'next/head';

export default function DynamicSlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<any>(null);
  const [pageContent, setPageContent] = useState<any>(null);

  useEffect(() => {
    const fetchProductAndPage = async () => {
      if (!slug) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching product with slug:', slug);
        
        // Check if this slug is a product
        const productRes = await fetch(`/api/public/products/by-slug/${slug}`);
        
        console.log('Product response status:', productRes.status);
        
        if (productRes.ok) {
          const product = await productRes.json();
          console.log('Product data:', product);
          setProductData(product);
          
          // Fetch the page template (custom or default)
          const pageTemplateId = product.customPageId || product.defaultProductPageId;
          
          console.log('Page template ID:', pageTemplateId);
          
          if (pageTemplateId) {
            const pageRes = await fetch(`/api/public/pages/${pageTemplateId}`);
            console.log('Page response status:', pageRes.status);
            
            if (pageRes.ok) {
              const page = await pageRes.json();
              console.log('Page content:', page);
              setPageContent(page);
            } else {
              setError('Product page template not found');
            }
          } else {
            setError('No product page template configured. Please set a default product page in admin settings.');
          }
        } else if (productRes.status === 404) {
          setError('Product not found');
        } else {
          const errorData = await productRes.json().catch(() => ({ error: 'Unknown error' }));
          setError(errorData.error || 'Failed to load product');
        }
      } catch (err: any) {
        console.error('Error fetching product and page:', err);
        setError(err.message || 'Failed to load page');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProductAndPage();
  }, [slug]);

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible overlayProps={{ radius: 'sm', blur: 2 }} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<IconAlertCircle />} title="Error" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!productData || !pageContent) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<IconAlertCircle />} title="Not Found" color="yellow">
          The page you're looking for doesn't exist.
        </Alert>
      </Container>
    );
  }

  // Create binding context with product data
  const bindingContext: BindingContext = {
    product: {
      ...productData,
      // Ensure nested objects are accessible
      brand: productData.brand || {},
      category: productData.category || {},
    },
  };

  console.log('Binding context:', bindingContext);

  // Apply data bindings to the page content for initial render
  const resolvedPageContent = applyBindingsToPage(pageContent, bindingContext);

  console.log('Resolved page content:', resolvedPageContent);
  console.log('Has gridCells?', resolvedPageContent.gridCells);
  
  // Log the first cell's blocks to see if bindings were applied
  if (resolvedPageContent.gridCells && resolvedPageContent.gridCells.length > 0) {
    const firstCell = resolvedPageContent.gridCells.find((c: any) => c.blocks && c.blocks.length > 0);
    if (firstCell) {
      console.log('First cell with blocks:', firstCell);
      console.log('First block content:', firstCell.blocks[0]?.content);
    }
  }

  return (
    <>
      <Head>
        <title>{resolvedPageContent.seoTitle || resolvedPageContent.title || productData.name}</title>
        {resolvedPageContent.seoDescription && (
          <meta name="description" content={resolvedPageContent.seoDescription} />
        )}
        {resolvedPageContent.ogImage && (
          <meta property="og:image" content={resolvedPageContent.ogImage} />
        )}
      </Head>

      <Box>
        {pageContent.gridCells && pageContent.gridCells.length > 0 ? (
          <GridRenderer 
            gridCells={pageContent.gridCells}
            productData={productData}
          />
        ) : (
          <Container size="sm" py="xl">
            <Alert color="yellow" title="No Content">
              This page template has no content yet. Please add content in the page builder.
            </Alert>
          </Container>
        )}
      </Box>
    </>
  );
}
