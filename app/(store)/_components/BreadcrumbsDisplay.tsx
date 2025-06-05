'use client';
// Marking as client component because it uses next/link for client-side navigation
// and Mantine components that might have client-side interactivity.

import { Group, Text, Anchor } from '@mantine/core';
import Link from 'next/link';
import React from 'react';

export interface BreadcrumbItem {
  title: React.ReactNode; // Allow ReactNode for icons like Home icon
  href?: string;
}

interface BreadcrumbsDisplayProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode; // Allow custom separator
  className?: string; // For additional styling
}

export default function BreadcrumbsDisplay({ items, separator = '/', className }: BreadcrumbsDisplayProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Group gap="xs" mb="lg" className={className} wrap="wrap"> {/* Added wrap */}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.href ? (
            <Anchor component={Link} href={item.href} size="sm" c="blue.6">
              {item.title}
            </Anchor>
          ) : (
            <Text size="sm" span c="dimmed"> {/* Use span for last item if it's text */}
              {item.title}
            </Text>
          )}
          {index < items.length - 1 && (
            <Text size="sm" c="dimmed" span> {separator} </Text> // span for separator
          )}
        </React.Fragment>
      ))}
    </Group>
  );
}
