import { createMocks } from 'node-mocks-http';
import handler from './new'; // API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Order');
jest.mock('../../../../models/Customer');
jest.mock('../../../../lib/permissions');
jest.mock('bcrypt'); // Mock bcrypt for password generation

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;
const mockOrderSave = jest.fn();
const mockCustomerSave = jest.fn();
const mockCustomerFindOne = Customer.findOne as jest.Mock;
const mockOrderModel = Order as jest.Mock;
const mockCustomerModel = Customer as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;


describe('/api/admin/orders/new API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  const defaultOrderPayload = {
    customerName: 'Test Customer',
    email: 'test@example.com',
    phoneNumber: '+12345678901',
    shippingAddress: {
      street: '123 Test St',
      city: 'Testville',
      postalCode: '12345',
      country: 'Testland',
    },
    orderItems: [{ productId: new mongoose.Types.ObjectId().toString(), name: 'Test Product', price: 100, quantity: 1 }],
    totalAmount: 100,
    paymentMethod: 'TestPay',
    status: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ({ req: mockReq, res: mockRes } = createMocks({
      method: 'POST',
      body: defaultOrderPayload,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN, id: 'adminUserId' } });
    mockHasPermission.mockReturnValue(true);
    mockBcryptHash.mockResolvedValue('hashedpassword');

    // Setup default mocks for models
    mockOrderModel.mockImplementation(() => ({ save: mockOrderSave.mockResolvedValue({ _id: 'orderId', ...defaultOrderPayload }) }));
    mockCustomerModel.mockImplementation(() => ({ save: mockCustomerSave.mockResolvedValue({ _id: 'customerId', ...defaultOrderPayload }) }));
  });

  // --- Authentication & Authorization ---
  test('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if user lacks CREATE_ORDER permission', async () => {
    mockGetServerSession.mockResolvedValue({ user: { role: 'SomeOtherRole' as Role } });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  test('should return 405 if method is not POST', async () => {
    mockReq.method = 'GET';
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });

  // --- Request Body Validation ---
  const requiredFields = ['customerName', 'email', 'phoneNumber', 'shippingAddress', 'orderItems', 'totalAmount'];
  requiredFields.forEach(field => {
    test(`should return 400 if ${field} is missing`, async () => {
      mockReq.body = { ...defaultOrderPayload, [field]: undefined };
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(400);
      expect(mockRes._getJSONData().message).toBe('Missing required fields');
    });
  });

  test('should return 400 if orderItems is empty', async () => {
    mockReq.body = { ...defaultOrderPayload, orderItems: [] };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Order items must be a non-empty array');
  });

  test('should return 400 if totalAmount is not positive', async () => {
    mockReq.body = { ...defaultOrderPayload, totalAmount: 0 };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Total amount must be a positive number');
  });

  test('should return 400 for invalid email format', async () => {
    mockReq.body = { ...defaultOrderPayload, email: 'invalid-email' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid email format.');
  });

  test('should return 400 for invalid phone number format', async () => {
    mockReq.body = { ...defaultOrderPayload, phoneNumber: '123' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid phone number format.');
  });

  test('should return 400 for incomplete shipping address', async () => {
    mockReq.body = { ...defaultOrderPayload, shippingAddress: { city: 'City only' }};
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Incomplete shipping address');
  });

  test('should return 400 for invalid order item structure', async () => {
    mockReq.body = { ...defaultOrderPayload, orderItems: [{ productId: '123' /* missing other fields */ }] };
    // This error is thrown inside the try-catch, so the message comes from there
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toMatch(/Invalid order item structure/);
  });


  // --- Successful Order Creation ---
  describe('Successful Order Creation', () => {
    test('should create a new customer if not found and then create order', async () => {
      mockCustomerFindOne.mockResolvedValue(null); // Customer not found
      const newCustomerId = new mongoose.Types.ObjectId();
      mockCustomerSave.mockResolvedValueOnce({ _id: newCustomerId, ...defaultOrderPayload.shippingAddress });
      const newOrderId = new mongoose.Types.ObjectId();
      mockOrderSave.mockResolvedValueOnce({ _id: newOrderId, customer: newCustomerId, ...defaultOrderPayload });

      // Re-assign model implementations for this specific test case if needed for clarity
      mockCustomerModel.mockImplementation(() => ({ save: mockCustomerSave }));
      mockOrderModel.mockImplementation(() => ({ save: mockOrderSave }));

      await handler(mockReq, mockRes);

      expect(mockCustomerFindOne).toHaveBeenCalledWith({ email: defaultOrderPayload.email.toLowerCase() });
      expect(mockCustomerSave).toHaveBeenCalled(); // New customer saved
      expect(mockOrderSave).toHaveBeenCalled();    // New order saved
      expect(mockRes._getStatusCode()).toBe(201);
      expect(mockRes._getJSONData().order.customer).toBe(newCustomerId);
    });

    test('should use existing customer if found and then create order', async () => {
      const existingCustomerId = new mongoose.Types.ObjectId();
      mockCustomerFindOne.mockResolvedValue({ _id: existingCustomerId, name: 'Existing Customer' });
      const newOrderId = new mongoose.Types.ObjectId();
      mockOrderSave.mockResolvedValueOnce({ _id: newOrderId, customer: existingCustomerId, ...defaultOrderPayload });

      mockOrderModel.mockImplementation(() => ({ save: mockOrderSave }));

      await handler(mockReq, mockRes);

      expect(mockCustomerFindOne).toHaveBeenCalledWith({ email: defaultOrderPayload.email.toLowerCase() });
      expect(mockCustomerSave).not.toHaveBeenCalled(); // No new customer saved
      expect(mockOrderSave).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(201);
      expect(mockRes._getJSONData().order.customer).toBe(existingCustomerId);
    });
  });

  // --- Error Handling ---
    test('should return 500 if Order.save fails', async () => {
        mockCustomerFindOne.mockResolvedValue({ _id: 'customerId' }); // Existing customer
        mockOrderSave.mockRejectedValueOnce(new Error('Database save error for order'));
        mockOrderModel.mockImplementation(() => ({ save: mockOrderSave }));

        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(500);
        expect(mockRes._getJSONData().message).toBe('Internal Server Error');
        expect(mockRes._getJSONData().error).toBe('Database save error for order');
    });

    test('should return 500 if Customer.save fails for new customer', async () => {
        mockCustomerFindOne.mockResolvedValue(null); // New customer
        mockCustomerSave.mockRejectedValueOnce(new Error('Database save error for customer'));
        mockCustomerModel.mockImplementation(() => ({ save: mockCustomerSave }));

        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(500);
        expect(mockRes._getJSONData().message).toBe('Internal Server Error');
        expect(mockRes._getJSONData().error).toBe('Database save error for customer');
    });

});
