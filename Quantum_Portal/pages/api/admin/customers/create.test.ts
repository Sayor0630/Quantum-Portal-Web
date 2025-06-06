import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './create'; // The API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Customer from '../../../../models/Customer';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Customer');
jest.mock('../../../../lib/permissions');
jest.mock('bcryptjs');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;
const mockCustomerSave = jest.fn();
const mockCustomerFindOne = Customer.findOne as jest.Mock;
const mockCustomerModel = Customer as jest.Mock; // To mock the constructor
const mockBcryptHash = bcrypt.hash as jest.Mock;

describe('/api/admin/customers/create API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  const defaultCreatePayload = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'password123',
    phoneNumber: '01711223344', // Received, but not directly saved
    isActive: true,
    addresses: [
      {
        street: '123 Main St',
        city: 'Testville',
        state: 'Test State District', // Client sends district, API maps to state
        zipCode: '12345',
        country: 'Bangladesh',
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ({ req: mockReq, res: mockRes } = createMocks({
      method: 'POST',
      body: defaultCreatePayload,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);
    mockBcryptHash.mockResolvedValue('hashedPassword123');
    mockCustomerFindOne.mockResolvedValue(null); // Default: email is not taken

    // Mock the Customer model constructor and save method
    mockCustomerModel.mockImplementation(() => ({
      save: mockCustomerSave.mockResolvedValue({
        _id: 'newCustomerId',
        ...defaultCreatePayload,
        password: 'hashedPassword123', // Ensure this is not returned
        toObject: function() { // Add toObject if sanitizeCustomer uses it
            const { password, ...rest } = this;
            return rest;
        }
      }),
    }));
  });

  // --- Authentication & Authorization ---
  test('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if user lacks MANAGE_CUSTOMERS permission', async () => {
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ORDER_MANAGER } });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  test('should return 405 for non-POST methods', async () => {
    mockReq.method = 'GET';
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });

  // --- Request Body Validation ---
  const requiredFields: (keyof typeof defaultCreatePayload)[] = ['firstName', 'lastName', 'email', 'password'];
  requiredFields.forEach(field => {
    test(`should return 400 if required field "${field}" is missing`, async () => {
      const body = { ...defaultCreatePayload };
      delete body[field];
      mockReq.body = body;
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(400);
      expect(mockRes._getJSONData().message).toContain('Missing required fields');
    });
  });

  test('should return 400 for invalid email format', async () => {
    mockReq.body = { ...defaultCreatePayload, email: 'invalid-email' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid email format.');
  });

  test('should return 400 for password too short', async () => {
    mockReq.body = { ...defaultCreatePayload, password: 'short' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Password must be at least 8 characters long.');
  });

  test('should return 400 for invalid optional phoneNumber format', async () => {
    mockReq.body = { ...defaultCreatePayload, phoneNumber: '123' };
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toContain('Invalid phone number format');
  });

  test('should return 409 if email is already in use', async () => {
    mockCustomerFindOne.mockResolvedValue({ email: defaultCreatePayload.email }); // Simulate email taken
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(409);
    expect(mockRes._getJSONData().message).toBe('Email already in use.');
  });

  // --- Successful Creation ---
  test('should return 201 and created customer (excluding password) on success', async () => {
    await handler(mockReq, mockRes);

    expect(mockBcryptHash).toHaveBeenCalledWith(defaultCreatePayload.password, 12);
    expect(mockCustomerSave).toHaveBeenCalled();
    expect(mockRes._getStatusCode()).toBe(201);
    const result = mockRes._getJSONData();
    expect(result.success).toBe(true);
    expect(result.customer._id).toBe('newCustomerId');
    expect(result.customer.email).toBe(defaultCreatePayload.email);
    expect(result.customer.password).toBeUndefined(); // CRITICAL: Password should not be returned
    expect(result.customer.isActive).toBe(defaultCreatePayload.isActive);
    expect(result.customer.addresses.length).toBe(1);
    expect(result.customer.addresses[0].state).toBe(defaultCreatePayload.addresses[0].state); // Check address mapping
  });

  test('should correctly set isActive to true by default if not provided', async () => {
    const payloadWithoutIsActive = { ...defaultCreatePayload };
    delete payloadWithoutIsActive.isActive; // Remove isActive
    mockReq.body = payloadWithoutIsActive;

    // Redefine mock for this specific test case if Customer constructor is called
     mockCustomerModel.mockImplementation(() => ({
      save: mockCustomerSave.mockResolvedValue({
        _id: 'newCustomerId',
        ...payloadWithoutIsActive,
        isActive: true, // This is what we expect the model to default to or API to set
        password: 'hashedPassword123',
         toObject: function() { const { password, ...rest } = this; return rest; }
      }),
    }));

    await handler(mockReq, mockRes);

    expect(mockRes._getStatusCode()).toBe(201);
    expect(mockRes._getJSONData().customer.isActive).toBe(true);
    // Check that the constructor was called with isActive: true or undefined then model defaulted
    const customerInstanceArg = mockCustomerModel.mock.calls[0][0];
    expect(customerInstanceArg.isActive === true || customerInstanceArg.isActive === undefined).toBe(true);
  });

  test('should correctly process and save valid addresses', async () => {
    await handler(mockReq, mockRes);
    const customerInstanceArg = mockCustomerModel.mock.calls[0][0];
    expect(customerInstanceArg.addresses.length).toBe(1);
    expect(customerInstanceArg.addresses[0].street).toBe(defaultCreatePayload.addresses[0].street);
    expect(customerInstanceArg.addresses[0].state).toBe(defaultCreatePayload.addresses[0].state); // District mapped to state
  });

   test('should skip incomplete address objects in payload', async () => {
    const payloadWithIncompleteAddress = {
        ...defaultCreatePayload,
        addresses: [
            { street: 'Only street' }, // Incomplete
            defaultCreatePayload.addresses[0] // Complete
        ]
    };
    mockReq.body = payloadWithIncompleteAddress;

    // Mock Customer constructor for this test
    mockCustomerModel.mockImplementation(() => ({
      save: mockCustomerSave.mockResolvedValue({
        _id: 'newCustomerId',
        ...payloadWithIncompleteAddress,
        addresses: [defaultCreatePayload.addresses[0]], // Only the valid one should be saved
        password: 'hashedPassword123',
        toObject: function() { const { password, ...rest } = this; return rest; }
      }),
    }));

    await handler(mockReq, mockRes);

    const customerInstanceArg = mockCustomerModel.mock.calls[0][0];
    expect(customerInstanceArg.addresses.length).toBe(1); // Only the complete address
    expect(customerInstanceArg.addresses[0].street).toBe(defaultCreatePayload.addresses[0].street);
  });

  // --- Error Handling ---
  test('should return 500 if bcrypt hashing fails', async () => {
    mockBcryptHash.mockRejectedValue(new Error('Hashing failed'));
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(500);
  });

  test('should return 500 if customer.save() fails', async () => {
    mockCustomerSave.mockRejectedValue(new Error('Database save error'));
    mockCustomerModel.mockImplementation(() => ({ save: mockCustomerSave })); // Re-mock to use the failing save
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(500);
  });
});
