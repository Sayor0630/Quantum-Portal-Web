import { createMocks } from 'node-mocks-http';
import handler from './index'; // Assuming this is the route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import PaymentMethod from '../../../../models/PaymentMethod';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/PaymentMethod');
jest.mock('../../../../lib/permissions');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;

describe('/api/admin/payment-methods API Endpoint (index)', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
    ({ req: mockReq, res: mockRes } = createMocks({
      method: 'GET', // Default method
    }));
    mockDbConnect.mockResolvedValue(undefined); // Simulate successful DB connection
  });

  // --- Authentication and Authorization Tests ---
  test('should return 401 if no session found', async () => {
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Unauthorized: No session found');
  });

  test('should return 403 if user does not have MANAGE_PAYMENT_METHODS permission', async () => {
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ORDER_MANAGER } });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
    expect(mockRes._getJSONData().message).toBe('Forbidden: Insufficient permissions');
  });

  // --- GET Requests ---
  describe('GET /api/admin/payment-methods', () => {
    beforeEach(() => {
        mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
        mockHasPermission.mockReturnValue(true); // Admin has permission
    });

    test('should return 200 and a list of payment methods', async () => {
      const mockPaymentMethods = [{ name: 'Test Method 1' }, { name: 'Test Method 2' }];
      (PaymentMethod.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentMethods),
      });

      await handler(mockReq, mockRes);

      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      expect(mockRes._getJSONData().data).toEqual(mockPaymentMethods);
    });

    test('should return 200 and an empty list if no payment methods exist', async () => {
      (PaymentMethod.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().data).toEqual([]);
    });

    test('should return 500 if database query fails', async () => {
      (PaymentMethod.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(500);
      expect(mockRes._getJSONData().message).toContain('Server error fetching payment methods');
    });
  });

  // --- POST Requests ---
  describe('POST /api/admin/payment-methods', () => {
    beforeEach(() => {
      mockReq.method = 'POST';
      mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
      mockHasPermission.mockReturnValue(true);
    });

    test('should return 201 and the created payment method on success', async () => {
      const newMethodData = { name: 'New Method', isEnabled: true, details: 'Details' };
      mockReq.body = newMethodData;

      const mockSavedMethod = { _id: 'someId', ...newMethodData };
      // Mock the model instance and its save method
      const mockPaymentMethodInstance = { save: jest.fn().mockResolvedValue(mockSavedMethod) };
      (PaymentMethod as unknown as jest.Mock).mockImplementation(() => mockPaymentMethodInstance);


      await handler(mockReq, mockRes);

      expect(PaymentMethod).toHaveBeenCalledWith(expect.objectContaining(newMethodData));
      expect(mockPaymentMethodInstance.save).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(201);
      expect(mockRes._getJSONData().success).toBe(true);
      expect(mockRes._getJSONData().data).toEqual(mockSavedMethod);
    });

    test('should return 400 if name is missing', async () => {
      mockReq.body = { isEnabled: true }; // Missing name
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(400);
      expect(mockRes._getJSONData().message).toBe('Payment method name is required.');
    });

    test('should return 409 if payment method name already exists (duplicate key error)', async () => {
        const newMethodData = { name: 'Existing Method', isEnabled: true };
        mockReq.body = newMethodData;
        const mockPaymentMethodInstance = { save: jest.fn().mockRejectedValue({ name: 'MongoServerError', code: 11000 }) };
        (PaymentMethod as unknown as jest.Mock).mockImplementation(() => mockPaymentMethodInstance);

        await handler(mockReq, mockRes);

        expect(mockRes._getStatusCode()).toBe(409);
        expect(mockRes._getJSONData().message).toBe('A payment method with this name already exists.');
    });

    test('should return 500 if saving to database fails for other reasons', async () => {
      const newMethodData = { name: 'New Method', isEnabled: true };
      mockReq.body = newMethodData;
      const mockPaymentMethodInstance = { save: jest.fn().mockRejectedValue(new Error('Some other DB error')) };
      (PaymentMethod as unknown as jest.Mock).mockImplementation(() => mockPaymentMethodInstance);

      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(500);
      expect(mockRes._getJSONData().message).toContain('Server error creating payment method');
    });
  });

  // --- Other HTTP Methods ---
  test('should return 405 for unsupported HTTP methods', async () => {
    mockReq.method = 'PUT'; // Example of an unsupported method for this endpoint
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
    expect(mockRes._getJSONData().message).toBe('Method PUT Not Allowed');
  });
});
