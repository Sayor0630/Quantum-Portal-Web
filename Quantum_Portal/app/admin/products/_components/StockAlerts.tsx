'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper, Title, Text, Group, Stack, Alert, Badge,
  Button, Table, ScrollArea, ActionIcon, Select,
  NumberInput, Modal, Divider, Card
} from '@mantine/core';
import {
  IconAlertTriangle, IconSettings, IconBell, IconCheck,
  IconX, IconEye, IconPackage, IconBoxMultiple, IconEdit, IconCurrency
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';

interface StockAlert {
  productId: string;
  productName: string;
  variantId?: string;
  variantAttributes?: string;
  currentStock: number;
  threshold: number;
  sku?: string;
  price: number;
  isVariant: boolean;
}

interface StockAlertsProps {
  products: any[];
  onEditStock?: (productId: string, variantId: string | undefined, newStock: number, newPrice?: number) => Promise<boolean>;
}

export default function StockAlerts({ products, onEditStock }: StockAlertsProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [outOfStockThreshold, setOutOfStockThreshold] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [editingAlert, setEditingAlert] = useState<StockAlert | null>(null);
  const [editingStock, setEditingStock] = useState<number>(0);
  const [editingPrice, setEditingPrice] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  // Temporary state for settings form (don't update until save is clicked)
  const [tempLowStockThreshold, setTempLowStockThreshold] = useState(10);
  const [tempOutOfStockThreshold, setTempOutOfStockThreshold] = useState(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load settings and dismissed alerts from cookies on component mount
  useEffect(() => {
    const loadSettingsFromCookies = () => {
      try {
        const savedLowStock = document.cookie
          .split('; ')
          .find(row => row.startsWith('stockAlert_lowThreshold='))
          ?.split('=')[1];
        
        const savedOutOfStock = document.cookie
          .split('; ')
          .find(row => row.startsWith('stockAlert_outOfStockThreshold='))
          ?.split('=')[1];

        const savedDismissedAlerts = document.cookie
          .split('; ')
          .find(row => row.startsWith('stockAlert_dismissedAlerts='))
          ?.split('=')[1];

        if (savedLowStock) {
          const lowValue = parseInt(savedLowStock, 10);
          if (!isNaN(lowValue) && lowValue >= 1 && lowValue <= 100) {
            setLowStockThreshold(lowValue);
            setTempLowStockThreshold(lowValue);
          }
        }

        if (savedOutOfStock) {
          const outValue = parseInt(savedOutOfStock, 10);
          if (!isNaN(outValue) && outValue >= 0 && outValue <= 10) {
            setOutOfStockThreshold(outValue);
            setTempOutOfStockThreshold(outValue);
          }
        }

        if (savedDismissedAlerts) {
          try {
            const decodedDismissed = decodeURIComponent(savedDismissedAlerts);
            const dismissedArray = JSON.parse(decodedDismissed);
            if (Array.isArray(dismissedArray)) {
              setDismissedAlerts(new Set(dismissedArray));
            }
          } catch (jsonError) {
            console.warn('Failed to parse dismissed alerts from cookies:', jsonError);
          }
        }
      } catch (error) {
        console.warn('Failed to load stock alert settings from cookies:', error);
      }
    };

    loadSettingsFromCookies();
  }, []);

  // Function to save settings to cookies
  const saveSettingsToCookies = (lowThreshold: number, outThreshold: number) => {
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // Expire in 1 year
      const cookieOptions = `; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      
      document.cookie = `stockAlert_lowThreshold=${lowThreshold}${cookieOptions}`;
      document.cookie = `stockAlert_outOfStockThreshold=${outThreshold}${cookieOptions}`;
    } catch (error) {
      console.warn('Failed to save stock alert settings to cookies:', error);
    }
  };

  // Function to save dismissed alerts to cookies
  const saveDismissedAlertsToCookies = (dismissedSet: Set<string>) => {
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // Expire in 1 year
      const cookieOptions = `; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      
      const dismissedArray = Array.from(dismissedSet);
      const encodedDismissed = encodeURIComponent(JSON.stringify(dismissedArray));
      document.cookie = `stockAlert_dismissedAlerts=${encodedDismissed}${cookieOptions}`;
    } catch (error) {
      console.warn('Failed to save dismissed alerts to cookies:', error);
    }
  };

  // Function to clear dismissed alerts from cookies
  const clearDismissedAlertsFromCookies = () => {
    try {
      const expiredDate = new Date(0); // Set to epoch time to expire immediately
      const cookieOptions = `; expires=${expiredDate.toUTCString()}; path=/; SameSite=Lax`;
      document.cookie = `stockAlert_dismissedAlerts=${cookieOptions}`;
    } catch (error) {
      console.warn('Failed to clear dismissed alerts from cookies:', error);
    }
  };

  // Function to handle opening settings modal
  const handleOpenSettingsModal = () => {
    // Reset temp values to current saved values when opening modal
    setTempLowStockThreshold(lowStockThreshold);
    setTempOutOfStockThreshold(outOfStockThreshold);
    setShowSettingsModal(true);
  };

  // Function to handle saving settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      // Validate values
      if (tempLowStockThreshold < 1 || tempLowStockThreshold > 100) {
        notifications.show({
          title: 'Invalid Low Stock Threshold',
          message: 'Low stock threshold must be between 1 and 100',
          color: 'red'
        });
        return;
      }

      if (tempOutOfStockThreshold < 0 || tempOutOfStockThreshold > 10) {
        notifications.show({
          title: 'Invalid Out of Stock Threshold',
          message: 'Out of stock threshold must be between 0 and 10',
          color: 'red'
        });
        return;
      }

      if (tempOutOfStockThreshold >= tempLowStockThreshold) {
        notifications.show({
          title: 'Invalid Threshold Configuration',
          message: 'Out of stock threshold must be less than low stock threshold',
          color: 'red'
        });
        return;
      }

      // Save to state and cookies
      setLowStockThreshold(tempLowStockThreshold);
      setOutOfStockThreshold(tempOutOfStockThreshold);
      saveSettingsToCookies(tempLowStockThreshold, tempOutOfStockThreshold);

      notifications.show({
        title: 'Settings Saved',
        message: 'Stock alert preferences have been saved successfully',
        color: 'green',
        icon: <IconCheck size="1rem" />
      });

      setShowSettingsModal(false);
    } catch (error) {
      notifications.show({
        title: 'Save Failed',
        message: 'Failed to save settings. Please try again.',
        color: 'red'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Function to handle canceling settings
  const handleCancelSettings = () => {
    // Reset temp values to current saved values
    setTempLowStockThreshold(lowStockThreshold);
    setTempOutOfStockThreshold(outOfStockThreshold);
    setShowSettingsModal(false);
  };

  // Generate alerts based on current stock levels
  useEffect(() => {
    const newAlerts: StockAlert[] = [];

    products.forEach(product => {
      if (product.hasVariants && product.variants?.length > 0) {
        // Check each variant
        product.variants.forEach((variant: any) => {
          if (variant.isActive && variant.stockQuantity <= lowStockThreshold) {
            const alertId = `${product._id}-${variant._id}`;
            
            if (!dismissedAlerts.has(alertId)) {
              const variantAttributes = Object.entries(variant.attributeCombination)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');

              newAlerts.push({
                productId: product._id,
                productName: product.name,
                variantId: variant._id,
                variantAttributes,
                currentStock: variant.stockQuantity,
                threshold: variant.stockQuantity <= outOfStockThreshold ? outOfStockThreshold : lowStockThreshold,
                sku: variant.sku,
                price: variant.price || product.price,
                isVariant: true
              });
            }
          }
        });
      } else {
        // Check simple product
        if (product.stockQuantity <= lowStockThreshold) {
          const alertId = product._id;
          
          if (!dismissedAlerts.has(alertId)) {
            newAlerts.push({
              productId: product._id,
              productName: product.name,
              currentStock: product.stockQuantity,
              threshold: product.stockQuantity <= outOfStockThreshold ? outOfStockThreshold : lowStockThreshold,
              sku: product.sku,
              price: product.price,
              isVariant: false
            });
          }
        }
      }
    });

    setAlerts(newAlerts);
  }, [products, lowStockThreshold, outOfStockThreshold, dismissedAlerts]);

  const dismissAlert = (alert: StockAlert) => {
    const alertId = alert.variantId ? `${alert.productId}-${alert.variantId}` : alert.productId;
    const newDismissedAlerts = new Set([...dismissedAlerts, alertId]);
    setDismissedAlerts(newDismissedAlerts);
    saveDismissedAlertsToCookies(newDismissedAlerts);
  };

  const getAlertSeverity = (currentStock: number) => {
    if (currentStock <= outOfStockThreshold) {
      return { color: 'red', label: 'Out of Stock', severity: 'critical' };
    } else if (currentStock <= lowStockThreshold) {
      return { color: 'orange', label: 'Low Stock', severity: 'warning' };
    }
    return { color: 'teal', label: 'In Stock', severity: 'normal' };
  };

  const criticalAlerts = alerts.filter(alert => alert.currentStock <= outOfStockThreshold);
  const warningAlerts = alerts.filter(alert => 
    alert.currentStock > outOfStockThreshold && alert.currentStock <= lowStockThreshold
  );

  return (
    <>
      {/* Settings button - always visible */}
      <Group justify="space-between" mb="md">
        <Text fw={500}>Stock Alerts</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconSettings size="0.8rem" />}
          onClick={handleOpenSettingsModal}
        >
          Settings
        </Button>
      </Group>

      {alerts.length === 0 ? (
        <Card withBorder p="md">
          <Group gap="sm">
            <IconCheck size="1.2rem" color="teal" />
            <div>
              <Text fw={500} size="sm" c="teal">All Stock Levels Normal</Text>
              <Text size="xs" c="dimmed">No low stock alerts at this time</Text>
            </div>
          </Group>
        </Card>
      ) : (
        <Paper withBorder p="md">
          <Group gap="sm" mb="md">
            <IconAlertTriangle size="1.2rem" color="orange" />
            <div>
              <Text size="sm" c="dimmed">
                {criticalAlerts.length} critical • {warningAlerts.length} warnings
              </Text>
            </div>
          </Group>

        <Stack gap="md">
          {criticalAlerts.length > 0 && (
            <Alert 
              icon={<IconAlertTriangle size="1rem" />} 
              color="red" 
              variant="light"
              title={`${criticalAlerts.length} Critical Stock Alert${criticalAlerts.length > 1 ? 's' : ''}`}
            >
              Products are out of stock and need immediate attention.
            </Alert>
          )}

          <ScrollArea.Autosize mah={300}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Current Stock</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {alerts.map((alert, index) => {
                  const severity = getAlertSeverity(alert.currentStock);
                  
                  return (
                    <Table.Tr key={`${alert.productId}-${alert.variantId || 'base'}-${index}`}>
                      <Table.Td>
                        <div>
                          <Group gap="xs" align="center">
                            {alert.isVariant ? (
                              <IconBoxMultiple size="0.8rem" />
                            ) : (
                              <IconPackage size="0.8rem" />
                            )}
                            <Text size="sm" fw={500}>{alert.productName}</Text>
                          </Group>
                          {alert.variantAttributes && (
                            <Text size="xs" c="dimmed">{alert.variantAttributes}</Text>
                          )}
                          {alert.sku && (
                            <Text size="xs" c="dimmed">SKU: {alert.sku}</Text>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} c={severity.color}>
                          {alert.currentStock}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={severity.color} 
                          variant="light" 
                          size="sm"
                        >
                          {severity.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="green"
                            onClick={() => {
                              setEditingAlert(alert);
                              setEditingStock(alert.currentStock);
                              setEditingPrice(alert.price);
                            }}
                            title="Edit Stock & Price"
                          >
                            <IconEdit size="0.8rem" />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            title="View Product"
                            onClick={() => {
                              router.push(`/admin/products/${alert.productId}`);
                            }}
                          >
                            <IconEye size="0.8rem" />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="gray"
                            onClick={() => dismissAlert(alert)}
                            title="Dismiss Alert"
                          >
                            <IconX size="0.8rem" />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Stack>
        </Paper>
      )}

      {/* Settings Modal */}
      <Modal
        opened={showSettingsModal}
        onClose={handleCancelSettings}
        title={
          <Group gap="sm">
            <IconSettings size="1.2rem" />
            <Text fw={500}>Stock Alert Settings</Text>
          </Group>
        }
        size="md"
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="lg">
          <div>
            <Text fw={500} mb="sm">Alert Thresholds</Text>
            <Text size="sm" c="dimmed" mb="md">
              Set when to receive alerts for low and out-of-stock items. Changes will only be applied when you click Save.
            </Text>

            <Stack gap="md">
              <NumberInput
                label="Low Stock Threshold"
                description="Alert when stock falls to or below this number"
                value={tempLowStockThreshold}
                onChange={(value) => setTempLowStockThreshold(Number(value) || 10)}
                min={1}
                max={100}
                leftSection={<IconAlertTriangle size="1rem" />}
                disabled={isSavingSettings}
              />

              <NumberInput
                label="Out of Stock Threshold"
                description="Critical alert threshold (usually 0)"
                value={tempOutOfStockThreshold}
                onChange={(value) => setTempOutOfStockThreshold(Number(value) || 0)}
                min={0}
                max={10}
                leftSection={<IconX size="1rem" />}
                disabled={isSavingSettings}
              />
            </Stack>
          </div>

          <Divider />

          <div>
            <Text fw={500} mb="sm">Alert Actions</Text>
            <Stack gap="sm">
              <Button
                variant="light"
                color="blue"
                fullWidth
                onClick={() => {
                  setDismissedAlerts(new Set());
                  clearDismissedAlertsFromCookies();
                  notifications.show({
                    title: 'Alerts Reset',
                    message: 'All dismissed alerts have been restored and will now be visible',
                    color: 'blue',
                    icon: <IconBell size="1rem" />
                  });
                }}
                disabled={isSavingSettings}
                leftSection={<IconBell size="0.9rem" />}
              >
                Reset All Dismissed Alerts
              </Button>

              <Button
                variant="light"
                color="orange"
                fullWidth
                onClick={() => {
                  setTempLowStockThreshold(10);
                  setTempOutOfStockThreshold(0);
                  notifications.show({
                    title: 'Settings Reset',
                    message: 'Alert thresholds have been reset to default values (Low: 10, Out of Stock: 0)',
                    color: 'orange',
                    icon: <IconSettings size="1rem" />
                  });
                }}
                disabled={isSavingSettings}
                leftSection={<IconSettings size="0.9rem" />}
              >
                Reset Settings to Default
              </Button>
              
              <Text size="xs" c="dimmed">
                Currently {dismissedAlerts.size} alert{dismissedAlerts.size !== 1 ? 's' : ''} dismissed
              </Text>
            </Stack>
          </div>

          <Divider />

          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              onClick={handleCancelSettings}
              disabled={isSavingSettings}
              leftSection={<IconX size="0.9rem" />}
            >
              Cancel
            </Button>
            <Group gap="sm">
              <Button
                variant="light"
                onClick={handleCancelSettings}
                disabled={isSavingSettings}
              >
                Close
              </Button>
              <Button
                color="blue"
                onClick={handleSaveSettings}
                loading={isSavingSettings}
                leftSection={<IconCheck size="0.9rem" />}
              >
                Save Settings
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Stock Edit Modal */}
      <Modal
        opened={!!editingAlert}
        onClose={() => {
          setEditingAlert(null);
          setEditingStock(0);
        }}
        title={
          <Group gap="sm">
            <IconEdit size="1.2rem" />
            <Text fw={500}>Edit Stock & Price</Text>
          </Group>
        }
        size="md"
        centered
      >
        {editingAlert && (
          <Stack gap="lg">
            <div>
              <Text fw={500} mb="sm">Product Information</Text>
              <Card withBorder p="md" style={{ opacity: 0.8 }}>
                <Group gap="xs" align="center" mb="xs">
                  {editingAlert.isVariant ? (
                    <IconBoxMultiple size="1rem" />
                  ) : (
                    <IconPackage size="1rem" />
                  )}
                  <Text fw={500}>{editingAlert.productName}</Text>
                </Group>
                {editingAlert.variantAttributes && (
                  <Text size="sm" c="dimmed" mb="xs">{editingAlert.variantAttributes}</Text>
                )}
                {editingAlert.sku && (
                  <Text size="sm" c="dimmed">SKU: {editingAlert.sku}</Text>
                )}
                <Text size="sm" mt="xs">
                  Current Stock: <Text component="span" fw={500} c={getAlertSeverity(editingAlert.currentStock).color}>
                    {editingAlert.currentStock}
                  </Text>
                </Text>
                <Text size="sm" mt="xs">
                  Current Price: <Text component="span" fw={500}>
                    ${editingAlert.price.toFixed(2)}
                  </Text>
                </Text>
              </Card>
            </div>

            <NumberInput
              label="New Stock Quantity"
              description="Enter the updated stock quantity"
              value={editingStock}
              onChange={(value) => setEditingStock(Number(value) || 0)}
              min={0}
              max={99999}
              leftSection={<IconPackage size="1rem" />}
              placeholder="Enter stock quantity"
            />

            <NumberInput
              label="New Price"
              description="Enter the updated price"
              value={editingPrice}
              onChange={(value) => setEditingPrice(Number(value) || 0)}
              min={0}
              decimalScale={2}
              step={0.01}
              leftSection={<IconCurrency size="1rem" />}
              placeholder="Enter price"
            />

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => {
                  setEditingAlert(null);
                  setEditingStock(0);
                  setEditingPrice(0);
                }}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                color="green"
                loading={updating}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    // Call the parent component's edit stock function
                    if (onEditStock) {
                      await onEditStock(editingAlert.productId, editingAlert.variantId, editingStock, editingPrice);
                    }
                    
                    notifications.show({
                      title: 'Stock & Price Updated',
                      message: `Stock updated to ${editingStock} and price updated to $${editingPrice.toFixed(2)} for ${editingAlert.productName}${editingAlert.variantAttributes ? ` (${editingAlert.variantAttributes})` : ''}`,
                      color: 'green',
                      icon: <IconCheck size="1rem" />
                    });

                    setEditingAlert(null);
                    setEditingStock(0);
                    setEditingPrice(0);
                  } catch (error) {
                    notifications.show({
                      title: 'Update Failed',
                      message: 'Failed to update stock and price. Please try again.',
                      color: 'red',
                      icon: <IconX size="1rem" />
                    });
                  } finally {
                    setUpdating(false);
                  }
                }}
              >
                Update Stock & Price
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
