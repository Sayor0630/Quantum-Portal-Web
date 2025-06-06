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

  const mockNewProductId = new mongoose.Types.ObjectId().toString();
  let defaultOrderPayload: any; // Define type more broadly for manipulation in tests

  beforeEach(() => {
    // Reset defaultOrderPayload before each test to ensure clean state, esp. for productId
    defaultOrderPayload = {
      customerName: 'Test Customer FullName', // This is fullName from form, mapped to customerName for API
      email: 'test@example.com', // This is top-level email from form
      phoneNumber: '01711223344', // This is top-level phone from form
      shippingAddress: { // This is the detailed object
        fullName: 'Test Recipient FullName', // Recipient's name for the order
        phone: '01999887766', // Recipient's phone for the order
        email: 'recipient@example.com', // Optional recipient email
        street: '123 Test St',
        city: 'Testville',
        district: 'Test District',
        postalCode: '12345',
        country: 'Testland',
        state: 'Test State (Optional)', // Optional broader region
      },
      orderItems: [{ productId: mockNewProductId, name: 'Test Product', price: 100, quantity: 1, image: 'test.jpg' }],
      totalAmount: 100,
      paymentMethod: 'TestPay',
      status: 'pending', // Overall order status
      paymentStatus: 'unpaid', // Order payment status
      deliveryNote: 'Handle with care.',
      customerId: null, // By default, no pre-selected customer
    };

    jest.clearAllMocks();
    ({ req: mockReq, res: mockRes } = createMocks({
      method: 'POST',
      body: defaultOrderPayload, // Use the reset payload
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN, id: 'adminUserId' } });
    mockHasPermission.mockReturnValue(true);
    mockBcryptHash.mockResolvedValue('hashedpassword');

    // Setup default mocks for models
    // Ensure the mock resolved value for Order save includes the new fields for subsequent checks
    mockOrderModel.mockImplementation(() => ({
        save: mockOrderSave.mockResolvedValue({
            _id: 'orderId',
            ...defaultOrderPayload,
            // Ensure shippingAddress in saved order mock matches the detailed structure
            shippingAddress: defaultOrderPayload.shippingAddress
        })
    }));
    mockCustomerModel.mockImplementation(() => ({
        save: mockCustomerSave.mockResolvedValue({
            _id: 'customerId',
            email: defaultOrderPayload.email,
            // Ensure addresses in new customer mock matches structure
            addresses: [{
                street: defaultOrderPayload.shippingAddress.street,
                city: defaultOrderPayload.shippingAddress.city,
                state: defaultOrderPayload.shippingAddress.district, // district maps to state in Customer model
                postalCode: defaultOrderPayload.shippingAddress.postalCode,
                country: defaultOrderPayload.shippingAddress.country,
            }]
        })
    }));
  });

  // --- Authentication & Authorization (no changes needed from original) ---
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
  // Updated required fields based on new API logic
  const essentialFields = ['customerName', 'phoneNumber', 'shippingAddress', 'orderItems', 'totalAmount', 'paymentMethod'];
  essentialFields.forEach(field => {
    test(`should return 400 if essential field ${field} is missing`, async () => {
      const body = { ...defaultOrderPayload };
      delete body[field];
      mockReq.body = body;
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(400);
      expect(mockRes._getJSONData().message).toContain('Missing required fields');
    });
  });

  const requiredShippingAddressFields = ['street', 'city', 'district', 'postalCode', 'country', 'fullName', 'phone'];
  requiredShippingAddressFields.forEach(field => {
    test(`should return 400 if shippingAddress.${field} is missing`, async () => {
        const body = { ...defaultOrderPayload, shippingAddress: { ...defaultOrderPayload.shippingAddress } };
        delete body.shippingAddress[field];
        mockReq.body = body;
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        if (field === 'fullName' || field === 'phone') {
            expect(mockRes._getJSONData().message).toContain('Shipping address object must also contain fullName and phone');
        } else {
            expect(mockRes._getJSONData().message).toContain('Incomplete shipping address object');
        }
    });
  });

  test('should return 400 if top-level phoneNumber is invalid (not 11 digits or not starting with 01)', async () => {
    mockReq.body = { ...defaultOrderPayload, phoneNumber: '12345' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Invalid phone number format. Must be 11 digits starting with 01.');

    mockReq.body = { ...defaultOrderPayload, phoneNumber: '02345678901' }; // Starts with 02
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Invalid phone number format. Must be 11 digits starting with 01.');
  });

  test('should return 400 if top-level email is provided but invalid', async () => {
    mockReq.body = { ...defaultOrderPayload, email: 'invalid-email-format' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid email format.');
  });

  test('should return 400 if email is not provided AND no customerId is selected (new rule)', async () => {
    mockReq.body = { ...defaultOrderPayload, email: '', customerId: null }; // No email, no customerId
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Email is required to find or create a customer if no customer is selected.');
  });


  // --- Successful Order Creation Scenarios ---
  describe('Successful Order Creation with New Fields', () => {
    test('should create order with new customer if email provided and customerId is null', async () => {
      mockReq.body = { ...defaultOrderPayload, customerId: null, email: 'newcustomer@example.com' };
      mockCustomerFindOne.mockResolvedValue(null); // Customer not found by email
      const newCustomerId = new mongoose.Types.ObjectId();
      mockCustomerSave.mockResolvedValueOnce({ _id: newCustomerId, email: 'newcustomer@example.com' }); // Mock for new customer save
      const newOrderId = new mongoose.Types.ObjectId();
      mockOrderSave.mockResolvedValueOnce({ _id: newOrderId, customer: newCustomerId, ...mockReq.body }); // Mock for order save

      await handler(mockReq, mockRes);

      expect(mockCustomerFindOne).toHaveBeenCalledWith({ email: 'newcustomer@example.com' });
      expect(mockCustomerSave).toHaveBeenCalled();
      expect(mockOrderSave).toHaveBeenCalled();
      const orderCallArg = mockOrderSave.mock.calls[0][0]; // Argument to Order.save()
      expect(orderCallArg.shippingAddress.fullName).toBe(defaultOrderPayload.shippingAddress.fullName);
      expect(orderCallArg.shippingAddress.phone).toBe(defaultOrderPayload.shippingAddress.phone);
      expect(orderCallArg.shippingAddress.district).toBe(defaultOrderPayload.shippingAddress.district);
      expect(orderCallArg.deliveryNote).toBe(defaultOrderPayload.deliveryNote);
      expect(orderCallArg.paymentStatus).toBe(defaultOrderPayload.paymentStatus);
      expect(mockRes._getStatusCode()).toBe(201);
      expect(mockRes._getJSONData().order.customer).toEqual(newCustomerId);
    });

    test('should create order with existing customer if customerId is provided', async () => {
      const existingCustomerId = new mongoose.Types.ObjectId().toString();
      mockReq.body = { ...defaultOrderPayload, customerId: existingCustomerId, email: 'existing@example.com' };
      // Simulate customer found by ID (or skip findOne if ID is trusted)
      (Customer.findById as jest.Mock).mockResolvedValue({ _id: existingCustomerId, email: 'existing@example.com' });

      const newOrderId = new mongoose.Types.ObjectId();
      // Ensure the order save mock uses the correct customerId and other details
      mockOrderSave.mockResolvedValueOnce({ _id: newOrderId, customer: existingCustomerId, ...mockReq.body });

      await handler(mockReq, mockRes);

      expect(Customer.findById).toHaveBeenCalledWith(existingCustomerId); // API now checks if selected customer exists
      expect(mockCustomerFindOne).not.toHaveBeenCalled(); // Should not try to find by email if ID is given
      expect(mockCustomerSave).not.toHaveBeenCalled();   // No new customer should be saved
      expect(mockOrderSave).toHaveBeenCalled();
      const orderCallArg = mockOrderSave.mock.calls[0][0];
      expect(orderCallArg.customer.toString()).toBe(existingCustomerId);
      expect(orderCallArg.shippingAddress.fullName).toBe(defaultOrderPayload.shippingAddress.fullName);
      expect(orderCallArg.deliveryNote).toBe(defaultOrderPayload.deliveryNote);
      expect(mockRes._getStatusCode()).toBe(201);
    });

    test('should correctly map shippingAddress.district to Customer.addresses.state for new customer', async () => {
        mockReq.body = { ...defaultOrderPayload, email: 'districtmap@example.com', customerId: null };
        mockCustomerFindOne.mockResolvedValue(null); // New customer
        const newCustomerId = new mongoose.Types.ObjectId();
        mockCustomerSave.mockResolvedValueOnce({ _id: newCustomerId }); // Mock for new customer save

        await handler(mockReq, mockRes);

        expect(mockCustomerSave).toHaveBeenCalled();
        const customerSaveArg = mockCustomerSave.mock.calls[0][0];
        expect(customerSaveArg.addresses[0].state).toBe(defaultOrderPayload.shippingAddress.district);
    });
  });

  // --- Error Handling (no changes needed from original for these specific tests) ---
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
