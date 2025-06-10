'use client';

import { useState, useEffect } from 'react';
import { Paper, Group, Title, Badge, Text, Alert, Table, LoadingOverlay, Button, Tooltip, ActionIcon } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconRefresh, IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';

// Types for stock validation
interface StockValidationItem {
    productId: string;
    variantId?: string;
    variantSku?: string;
    name: string;
    availableQuantity: number;
    requestedQuantity: number;
    actualQuantity?: number;
    shortfall?: number;
}

interface StockValidationResult {
    isValid: boolean;
    validationResult: 'all_available' | 'partial_available' | 'none_available';
    availableItems: StockValidationItem[];
    partiallyAvailableItems: StockValidationItem[];
    unavailableItems: StockValidationItem[];
    errorMessage?: string;
}

interface OrderItem {
    _id: string;
    product: {
        _id: string;
        name: string;
        sku?: string;
    } | null;
    name?: string;
    quantity: number;
    selectedAttributes?: Map<string, string> | Record<string, string>;
    isVariantProduct?: boolean;
    variantId?: string;
}

interface LiveStockValidationProps {
    orderItems: OrderItem[];
    savedStockValidation?: {
        isValidated: boolean;
        validationDate?: string;
        validationResult: 'all_available' | 'partial_available' | 'none_available';
        availableItems?: any[];
        partiallyAvailableItems?: any[];
        unavailableItems?: any[];
        stockDeducted?: boolean;
        stockDeductedAt?: string;
    };
    statusReason?: string;
    orderStatus?: string;
    orderId: string; // Add orderId prop
}

export default function LiveStockValidation({ 
    orderItems, 
    savedStockValidation, 
    statusReason,
    orderStatus,
    orderId
}: LiveStockValidationProps) {
    const [liveStockData, setLiveStockData] = useState<StockValidationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [showLiveData, setShowLiveData] = useState(true);

    const fetchLiveStockData = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('Fetching live stock data for order:', orderId);
            const response = await fetch(`/api/admin/orders/${orderId}/live-stock-validation`);
            const data = await response.json();

            console.log('API Response:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch live stock data');
            }

            if (data.success) {
                setLiveStockData(data.data);
                setLastUpdated(new Date());
                console.log('Live stock data set:', data.data);
            } else {
                throw new Error(data.message || 'Invalid response from server');
            }
        } catch (err) {
            console.error('Error fetching live stock data:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch live stock data');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch live data on component mount
    useEffect(() => {
        fetchLiveStockData();
    }, []);

    const renderStockTable = (
        items: any[], 
        title: string, 
        color: string, 
        includeShortfall: boolean = false
    ) => {
        if (!items || items.length === 0) return null;

        return (
            <div>
                <Text fw={500} mb="xs" c={color}>
                    {title}:
                </Text>
                <Table striped highlightOnHover mb="md">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Product</Table.Th>
                            <Table.Th style={{ textAlign: 'center' }}>Requested</Table.Th>
                            <Table.Th style={{ textAlign: 'center' }}>Available</Table.Th>
                            {includeShortfall && (
                                <Table.Th style={{ textAlign: 'center' }}>Shortfall</Table.Th>
                            )}
                            <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {items.map((item, index) => (
                            <Table.Tr key={`${title}-${index}`}>
                                <Table.Td>
                                    <div>
                                        <Text size="sm" fw={500}>{item.name}</Text>
                                        {item.variantId && (
                                            <Badge size="xs" variant="light" color="blue" mt={2}>
                                                Variant: {item.variantSku || `ID: ${item.variantId.slice(-8)}`}
                                            </Badge>
                                        )}
                                    </div>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'center' }}>
                                    {item.requestedQuantity}
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'center' }}>
                                    {item.availableQuantity}
                                </Table.Td>
                                {includeShortfall && (
                                    <Table.Td style={{ textAlign: 'center' }}>
                                        <Text c="red" fw={500}>
                                            {item.shortfall || (item.requestedQuantity - item.availableQuantity)}
                                        </Text>
                                    </Table.Td>
                                )}
                                <Table.Td style={{ textAlign: 'center' }}>
                                    <Badge 
                                        color={color} 
                                        variant="filled" 
                                        size="sm"
                                    >
                                        {color === 'green' ? 'Available' :
                                         color === 'orange' ? 'Partial Stock' :
                                         item.availableQuantity === 0 ? 'Out of Stock' : 'Insufficient'}
                                    </Badge>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </div>
        );
    };

    const renderSavedStockValidation = () => {
        if (!savedStockValidation?.isValidated) {
            return (
                <div>
                    <Text fw={500} size="lg" mb="md">Historical Stock Validation</Text>
                    <Alert color="blue" mb="md">
                        No historical stock validation data available for this order.
                    </Alert>
                </div>
            );
        }

        return (
            <div style={{ position: 'relative' }}>
                <LoadingOverlay visible={false} />
                <Group justify="space-between" align="center" mb="md">
                    <Text fw={500} size="lg">Historical Stock Validation</Text>
                    <Badge 
                        color={
                            savedStockValidation.validationResult === 'all_available' ? 'green' :
                            savedStockValidation.validationResult === 'partial_available' ? 'orange' : 'red'
                        }
                        variant="light"
                        size="sm"
                    >
                        {savedStockValidation.validationResult === 'all_available' ? 'All Available' :
                         savedStockValidation.validationResult === 'partial_available' ? 'Partially Available' : 'Out of Stock'}
                    </Badge>
                </Group>

                {savedStockValidation.validationDate && (
                    <Text size="sm" c="dimmed" mb="md">
                        Validated on: {dayjs(savedStockValidation.validationDate).format('MMM D, YYYY h:mm A')}
                    </Text>
                )}

                {savedStockValidation.stockDeducted && savedStockValidation.stockDeductedAt && (
                    <Alert color="green" mb="md" icon={<IconCheck />}>
                        Stock deducted on: {dayjs(savedStockValidation.stockDeductedAt).format('MMM D, YYYY h:mm A')}
                    </Alert>
                )}

                {renderStockTable(savedStockValidation.availableItems || [], 'Available Items', 'green')}
                {renderStockTable(savedStockValidation.partiallyAvailableItems || [], 'Partially Available Items', 'orange', true)}
                {renderStockTable(savedStockValidation.unavailableItems || [], 'Unavailable Items', 'red', true)}
            </div>
        );
    };

    const renderLiveStockValidation = () => {
        return (
            <div>
                <Group justify="space-between" align="center" mb="md">
                    <Group align="center">
                        <Text fw={500} size="lg">Current Stock Status</Text>
                        <Badge color="blue" variant="light" size="sm">
                            LIVE
                        </Badge>
                    </Group>
                    <Group align="center">
                        {liveStockData ? (
                            <Badge 
                                color={
                                    liveStockData.validationResult === 'all_available' ? 'green' :
                                    liveStockData.validationResult === 'partial_available' ? 'orange' : 'red'
                                }
                                variant="filled"
                                size="lg"
                            >
                                {liveStockData.validationResult === 'all_available' ? 'All Available' :
                                 liveStockData.validationResult === 'partial_available' ? 'Partially Available' : 'Out of Stock'}
                            </Badge>
                        ) : (
                            <Badge color="gray" variant="light" size="lg">
                                {loading ? 'Loading...' : error ? 'Error' : 'No Data'}
                            </Badge>
                        )}
                        <Tooltip label="Refresh stock data">
                            <ActionIcon 
                                variant="light" 
                                color="blue" 
                                onClick={fetchLiveStockData}
                                loading={loading}
                            >
                                <IconRefresh size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {lastUpdated && (
                    <Group align="center" mb="md">
                        <IconClock size={14} />
                        <Text size="sm" c="dimmed">
                            Last updated: {dayjs(lastUpdated).format('MMM D, YYYY h:mm A')}
                        </Text>
                    </Group>
                )}

                {error && (
                    <Alert color="red" mb="md" icon={<IconAlertCircle />}>
                        Error fetching live stock data: {error}
                    </Alert>
                )}

                {!liveStockData && !loading && !error && (
                    <Alert color="blue" mb="md">
                        Click refresh to fetch current stock data
                    </Alert>
                )}

                {liveStockData && (
                    <>
                        {renderStockTable(liveStockData.availableItems, 'Available Items', 'green')}
                        {renderStockTable(liveStockData.partiallyAvailableItems, 'Partially Available Items', 'orange', true)}
                        {renderStockTable(liveStockData.unavailableItems, 'Unavailable Items', 'red', true)}
                    </>
                )}
            </div>
        );
    };

    return (
        <Paper withBorder shadow="sm" p="md" radius="md" mb="lg" pos="relative">
            <LoadingOverlay visible={loading} />
            
            <Group justify="space-between" align="center" mb="md">
                <Title order={4}>Stock Validation</Title>
                <Group>
                    <Button
                        variant={showLiveData ? "light" : "filled"}
                        size="sm"
                        onClick={() => setShowLiveData(false)}
                    >
                        Historical
                    </Button>
                    <Button
                        variant={showLiveData ? "filled" : "light"}
                        size="sm"
                        onClick={() => setShowLiveData(true)}
                    >
                        Live Data
                    </Button>
                </Group>
            </Group>

            {statusReason && (
                <Alert 
                    color={orderStatus === 'failed' ? 'red' : orderStatus === 'on-hold' ? 'orange' : 'blue'} 
                    mb="md"
                    icon={<IconAlertCircle />}
                >
                    <Text fw={500}>Status Reason:</Text>
                    <Text>{statusReason}</Text>
                </Alert>
            )}

            {showLiveData ? renderLiveStockValidation() : renderSavedStockValidation()}
        </Paper>
    );
}
