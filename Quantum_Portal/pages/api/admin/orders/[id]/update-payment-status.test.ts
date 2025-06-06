import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './update-payment-status';
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

describe('/api/admin/orders/[id]/update-payment-status API Endpoint', () => {
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
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } }); // Default to Admin
    mockHasPermission.mockReturnValue(true); // Default to has permission

    // Setup mock Order instance for findById and save
    mockOrderInstance = {
      _id: mockValidOrderId,
      paymentStatus: 'unpaid',
      isPaid: false,
      paidAt: undefined,
      save: jest.fn().mockImplementation(function(this: any) { // Use function to access `this`
        return Promise.resolve(this); // save() returns the document itself
      }),
      // Add other fields if necessary for specific tests
    };
    (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Authentication & Authorization ---
  test('should return 401 if no session', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'paid' });
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if user lacks permission (CREATE_ORDER used as proxy)', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'paid' });
    mockHasPermission.mockReturnValue(false); // Simulate no permission
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  // --- Method and Parameter Validation ---
  test('should return 405 for non-PUT methods', async () => {
    setup('GET');
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });

  test('should return 400 for invalid order ID', async () => {
    setup('PUT', 'invalid-id', { paymentStatus: 'paid' });
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid order ID.');
  });

  test('should return 400 for missing paymentStatus in body', async () => {
    setup('PUT', mockValidOrderId, {}); // Empty body
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid paymentStatus. Must be "paid" or "unpaid".');
  });

  test('should return 400 for invalid paymentStatus value', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'pending' }); // Invalid value
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid paymentStatus. Must be "paid" or "unpaid".');
  });

  // --- Core Logic Tests ---
  test('should return 404 if order not found', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'paid' });
    (Order.findById as jest.Mock).mockResolvedValue(null); // Order not found
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(404);
    expect(mockRes._getJSONData().message).toBe('Order not found.');
  });

  test('should update paymentStatus to "paid", set isPaid=true and paidAt', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'paid' });

    await handler(mockReq, mockRes);

    expect(Order.findById).toHaveBeenCalledWith(mockValidOrderId);
    expect(mockOrderInstance.paymentStatus).toBe('paid');
    expect(mockOrderInstance.isPaid).toBe(true);
    expect(mockOrderInstance.paidAt).toBeInstanceOf(Date);
    expect(mockOrderInstance.save).toHaveBeenCalled();
    expect(mockRes._getStatusCode()).toBe(200);
    expect(mockRes._getJSONData().success).toBe(true);
    expect(mockRes._getJSONData().data.paymentStatus).toBe('paid');
    expect(mockRes._getJSONData().data.isPaid).toBe(true);
  });

  test('should update paymentStatus to "unpaid", set isPaid=false and clear paidAt', async () => {
    // Initial state of mockOrderInstance for this test
    mockOrderInstance.paymentStatus = 'paid';
    mockOrderInstance.isPaid = true;
    mockOrderInstance.paidAt = new Date();
    (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance); // re-mock findById with this specific instance state

    setup('PUT', mockValidOrderId, { paymentStatus: 'unpaid' });

    await handler(mockReq, mockRes);

    expect(Order.findById).toHaveBeenCalledWith(mockValidOrderId);
    expect(mockOrderInstance.paymentStatus).toBe('unpaid');
    expect(mockOrderInstance.isPaid).toBe(false);
    expect(mockOrderInstance.paidAt).toBeUndefined();
    expect(mockOrderInstance.save).toHaveBeenCalled();
    expect(mockRes._getStatusCode()).toBe(200);
    expect(mockRes._getJSONData().success).toBe(true);
    expect(mockRes._getJSONData().data.paymentStatus).toBe('unpaid');
    expect(mockRes._getJSONData().data.isPaid).toBe(false);
  });

  test('should return 500 if order.save() fails', async () => {
    setup('PUT', mockValidOrderId, { paymentStatus: 'paid' });
    mockOrderInstance.save.mockRejectedValue(new Error('Database save error'));
    (Order.findById as jest.Mock).mockResolvedValue(mockOrderInstance);

    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(500);
    expect(mockRes._getJSONData().message).toBe('Internal Server Error');
  });
});
