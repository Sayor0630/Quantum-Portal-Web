import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './[id]'; // API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import PaymentMethod from '../../../../models/PaymentMethod';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/PaymentMethod');
jest.mock('../../../../lib/permissions');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;

const mockValidObjectId = new mongoose.Types.ObjectId().toString();
const mockInvalidObjectId = 'invalid-id';

describe('/api/admin/payment-methods/[id] API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  const setup = (method: RequestMethod, id?: string, body?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: { id: id || mockValidObjectId }, // Default to a valid ID
      body,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Authentication & Authorization (similar to index, can be more concise here) ---
  test('should return 401 if no session', async () => {
    setup('GET');
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if no permission', async () => {
    setup('GET');
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ORDER_MANAGER } });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  // --- ID Validation ---
  test('should return 400 if ID is invalid', async () => {
    setup('GET', mockInvalidObjectId);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid payment method ID.');
  });

  // --- GET /{id} ---
  describe('GET /api/admin/payment-methods/[id]', () => {
    test('should return 200 and the payment method if found', async () => {
      setup('GET');
      const mockMethod = { _id: mockValidObjectId, name: 'Test Method' };
      (PaymentMethod.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMethod),
      });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().data).toEqual(mockMethod);
    });

    test('should return 404 if payment method not found', async () => {
      setup('GET');
      (PaymentMethod.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(404);
    });
  });

  // --- PUT /{id} ---
  describe('PUT /api/admin/payment-methods/[id]', () => {
    const updateData = { name: 'Updated Name', isEnabled: false };

    test('should return 200 and updated method on success', async () => {
      setup('PUT', mockValidObjectId, updateData);
      const mockExistingMethod = {
        _id: mockValidObjectId,
        name: 'Old Name',
        isEnabled: true,
        save: jest.fn().mockResolvedValue({ _id: mockValidObjectId, ...updateData }),
        markModified: jest.fn(),
      };
      (PaymentMethod.findById as jest.Mock).mockResolvedValue(mockExistingMethod);

      await handler(mockReq, mockRes);

      expect(mockExistingMethod.name).toBe(updateData.name);
      expect(mockExistingMethod.isEnabled).toBe(updateData.isEnabled);
      expect(mockExistingMethod.save).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().data.name).toBe(updateData.name);
    });

    test('should return 404 if method to update not found', async () => {
      setup('PUT', mockValidObjectId, updateData);
      (PaymentMethod.findById as jest.Mock).mockResolvedValue(null);
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(404);
    });

    test('should return 400 if no update data provided', async () => {
        setup('PUT', mockValidObjectId, {}); // Empty body
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toBe('No update data provided. Please provide name, isEnabled, or details to update.');
    });

    test('should return 400 if name is empty string', async () => {
        setup('PUT', mockValidObjectId, { name: '' });
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toBe('Payment method name cannot be empty.');
    });

    test('should return 409 if updated name causes duplicate key error', async () => {
        setup('PUT', mockValidObjectId, { name: 'Duplicate Name' });
        const mockExistingMethod = {
            _id: mockValidObjectId,
            name: 'Old Name',
            isEnabled: true,
            save: jest.fn().mockRejectedValue({ name: 'MongoServerError', code: 11000 }),
            markModified: jest.fn(),
        };
        (PaymentMethod.findById as jest.Mock).mockResolvedValue(mockExistingMethod);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(409);
    });
  });

  // --- DELETE /{id} ---
  describe('DELETE /api/admin/payment-methods/[id]', () => {
    test('should return 200 and success message on successful deletion', async () => {
      setup('DELETE');
      (PaymentMethod.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: mockValidObjectId, name: 'Deleted Method' });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().message).toBe('Payment method deleted successfully.');
    });

    test('should return 404 if method to delete not found', async () => {
      setup('DELETE');
      (PaymentMethod.findByIdAndDelete as jest.Mock).mockResolvedValue(null);
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(404);
    });
  });

  // --- Other HTTP Methods ---
  test('should return 405 for unsupported HTTP methods', async () => {
    setup('POST'); // Example: POST is not supported by [id].ts
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });
});
