import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './update-order-status';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../../lib/dbConnect';
import Order from '../../../../../models/Order';
import { hasPermission, Role, Permission } from '../../../../../lib/permissions';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../../lib/dbConnect');
jest.mock('../../../../../models/Order');
jest.mock('../../../../../lib/permissions');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;

const mockValidOrderId = new mongoose.Types.ObjectId().toString();
const VALID_ORDER_STATUSES = [
  'pending', 'processing', 'shipped', 'delivered', 'completed',
  'cancelled', 'refunded', 'on-hold', 'failed'
];

describe('/api/admin/orders/[id]/update-order-status API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];
  let mockOrderInstance: any;

  const setup = (method: RequestMethod, orderId?: string, body?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: { id: orderId || mockValidOrderId },
      body,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);

    mockOrderInstance = {
      _id: mockValidOrderId,
      status: 'pending',
      isDelivered: false,
      deliveredAt: undefined,
      save: jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      }),
    };
    (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Auth & Validation Tests (similar to payment status) ---
  test('should return 401 if no session', async () => {
    setup('PUT', mockValidOrderId, { status: 'processing' });
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if user lacks permission', async () => {
    setup('PUT', mockValidOrderId, { status: 'processing' });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  test('should return 405 for non-PUT methods', async () => {
    setup('GET');
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });

  test('should return 400 for invalid order ID', async () => {
    setup('PUT', 'invalid-id', { status: 'processing' });
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
  });

  test('should return 400 for missing status in body', async () => {
    setup('PUT', mockValidOrderId, {});
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Invalid order status.');
  });

  test('should return 400 for invalid status value', async () => {
    setup('PUT', mockValidOrderId, { status: 'shipped_wrong' });
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Invalid order status.');
  });

  // --- Core Logic ---
  test('should return 404 if order not found', async () => {
    setup('PUT', mockValidOrderId, { status: 'processing' });
    (Order.findById as jest.Mock).mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(404);
  });

  test('should update order status successfully for a valid status', async () => {
    const newStatus = 'processing';
    setup('PUT', mockValidOrderId, { status: newStatus });

    await handler(mockReq, mockRes);

    expect(mockOrderInstance.status).toBe(newStatus);
    expect(mockOrderInstance.save).toHaveBeenCalled();
    expect(mockRes._getStatusCode()).toBe(200);
    expect(mockRes._getJSONData().data.status).toBe(newStatus);
  });

  test('should update status to "delivered", set isDelivered=true and deliveredAt', async () => {
    setup('PUT', mockValidOrderId, { status: 'delivered' });

    await handler(mockReq, mockRes);

    expect(mockOrderInstance.status).toBe('delivered');
    expect(mockOrderInstance.isDelivered).toBe(true);
    expect(mockOrderInstance.deliveredAt).toBeInstanceOf(Date);
    expect(mockOrderInstance.save).toHaveBeenCalled();
    expect(mockRes._getStatusCode()).toBe(200);
    expect(mockRes._getJSONData().data.status).toBe('delivered');
    expect(mockRes._getJSONData().data.isDelivered).toBe(true);
  });

  // Optional: Test if moving *away* from 'delivered' clears flags (if that logic is added to API)
  // test('should clear isDelivered and deliveredAt if status changes from "delivered" to another status', async () => {
  //   mockOrderInstance.status = 'delivered';
  //   mockOrderInstance.isDelivered = true;
  //   mockOrderInstance.deliveredAt = new Date();
  //   (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance);
  //   setup('PUT', mockValidOrderId, { status: 'processing' });
  //   await handler(mockReq, mockRes);
  //   expect(mockOrderInstance.status).toBe('processing');
  //   // Assuming API implements this clearing logic:
  //   // expect(mockOrderInstance.isDelivered).toBe(false);
  //   // expect(mockOrderInstance.deliveredAt).toBeUndefined();
  //   expect(mockOrderInstance.save).toHaveBeenCalled();
  // });

  test('should return 500 if order.save() fails', async () => {
    setup('PUT', mockValidOrderId, { status: 'shipped' });
    mockOrderInstance.save.mockRejectedValue(new Error('DB Save Failed'));
    (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance);

    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(500);
  });
});
