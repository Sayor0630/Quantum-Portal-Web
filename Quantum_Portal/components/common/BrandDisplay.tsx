import React from 'react';
import { Group, Avatar, Text } from '@mantine/core';

interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
}

interface BrandDisplayProps {
  brand?: Brand;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  compact?: boolean;
}

const BrandDisplay: React.FC<BrandDisplayProps> = ({ 
  brand, 
  size = 'sm', 
  showName = true, 
  compact = false 
}) => {
  if (!brand) {
    return null;
  }

  const avatarSize = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40
  }[size];

  const fontSize = {
    xs: 'xs',
    sm: 'xs',
    md: 'sm',
    lg: 'md',
    xl: 'lg'
  }[size] as 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  return (
    <Group gap={compact ? 4 : 8} align="center">
      <Avatar
        src={brand.logo}
        alt={brand.name}
        size={avatarSize}
        radius="sm"
        style={{
          backgroundColor: brand.logo ? 'transparent' : '#f1f3f4',
          color: '#5f6368',
          fontSize: size === 'xs' ? '8px' : size === 'sm' ? '10px' : '12px',
          fontWeight: 500
        }}
      >
        {!brand.logo && brand.name ? brand.name.charAt(0).toUpperCase() : ''}
      </Avatar>
      {showName && (
        <Text size={fontSize} c="dimmed" style={{ fontWeight: 500 }}>
          {brand.name}
        </Text>
      )}
    </Group>
  );
};

export default BrandDisplay;
