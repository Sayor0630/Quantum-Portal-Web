import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './[customerId]'; // The API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Customer from '../../../../models/Customer';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Customer');
jest.mock('../../../../lib/permissions');
jest.mock('bcryptjs');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;

const mockValidCustomerId = new mongoose.Types.ObjectId().toString();

describe('/api/admin/customers/[id] API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];
  let mockCustomerInstance: any;
  let mockLeanCustomerData: any;

  const setup = (method: RequestMethod, customerId?: string, body?: any, queryParams?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: { id: customerId || mockValidCustomerId, ...queryParams },
      body,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);
    mockBcryptHash.mockResolvedValue('newHashedPassword');

    // Data for .lean() in GET
    mockLeanCustomerData = {
      _id: mockValidCustomerId,
      firstName: 'Original First',
      lastName: 'Original Last',
      email: 'original@example.com',
      isActive: true,
      addresses: [{ street: '123 Old St', city: 'Old City', state: 'Old State', zipCode: '00000', country: 'Bangladesh' }],
      // No password here
    };

    // Mock Mongoose document instance for findById (used in PUT)
    mockCustomerInstance = {
      ...mockLeanCustomerData, // Start with lean data
      password: 'oldHashedPassword', // Add password for the instance
      save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); }),
      toObject: jest.fn().mockImplementation(function(this: any) { // Ensure toObject is present for sanitizeCustomer
          const { password, ...rest } = this; // Simulate password exclusion
          return rest;
      }),
    };

    // Default mock for findById
    (Customer.findById as jest.Mock).mockImplementation((id) => {
        if (id.toString() === mockValidCustomerId) {
            // For GET, it might chain .select().lean()
            // For PUT, it's used directly to get a document instance
            return {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockLeanCustomerData),
                exec: jest.fn().mockResolvedValue(mockCustomerInstance), // Fallback if exec is used
                // Directly return instance for PUT scenario
                ...mockCustomerInstance // Spread the instance methods like save, toObject
            };
        }
        return Promise.resolve(null); // Not found
    });
     // Ensure findById used in PUT returns the instance that can be saved
    (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance);


  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Common Auth & Validation ---
  // (Tests for 401, 403, invalid ID format, and non-supported methods can be added here, similar to create.test.ts)
  test('should return 401 if no session', async () => {
    setup('GET');
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
  });

  test('should return 403 if user lacks MANAGE_CUSTOMERS permission', async () => {
    setup('GET');
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ORDER_MANAGER } });
    mockHasPermission.mockReturnValue(false);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(403);
  });

  test('should return 400 for invalid customer ID format', async () => {
    setup('GET', 'invalid-id-format');
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Invalid customer ID.');
  });


  // --- GET /api/admin/customers/[id] ---
  describe('GET /api/admin/customers/[id]', () => {
    test('should return 200 and customer data (excluding password) if found', async () => {
      setup('GET');
      // Specific mock for GET path that uses .select().lean()
      (Customer.findById as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockLeanCustomerData)
      });
      await handler(mockReq, mockRes);
      expect(Customer.findById).toHaveBeenCalledWith(new mongoose.Types.ObjectId(mockValidCustomerId));
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      expect(mockRes._getJSONData().customer.email).toBe(mockLeanCustomerData.email);
      expect(mockRes._getJSONData().customer.password).toBeUndefined();
    });

    test('should return 404 if customer not found', async () => {
      setup('GET');
      (Customer.findById as jest.Mock).mockReturnValueOnce({ // Ensure this mock is specific to GET
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null)
      });
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(404);
    });
  });

  // --- PUT /api/admin/customers/[id] ---
  describe('PUT /api/admin/customers/[id]', () => {
    const updatePayload = {
      firstName: "Updated First",
      lastName: "Updated Last",
      email: "updated@example.com",
      isActive: false,
      addresses: [{ street: '456 New St', city: 'New City', state: 'New State', zipCode: '67890', country: 'Bangladesh', isDefaultShipping: true, isDefaultBilling: true }],
    };

    test('should successfully update customer data (no password change)', async () => {
      setup('PUT', mockValidCustomerId, updatePayload);
      // Ensure findById for PUT returns the full mock instance
      (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance);


      await handler(mockReq, mockRes);

      expect(Customer.findById).toHaveBeenCalledWith(new mongoose.Types.ObjectId(mockValidCustomerId));
      expect(mockCustomerInstance.firstName).toBe(updatePayload.firstName);
      expect(mockCustomerInstance.email).toBe(updatePayload.email.toLowerCase());
      expect(mockCustomerInstance.isActive).toBe(updatePayload.isActive);
      expect(mockCustomerInstance.addresses.length).toBe(1);
      expect(mockCustomerInstance.addresses[0].street).toBe(updatePayload.addresses[0].street);
      expect(mockCustomerInstance.save).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      expect(mockRes._getJSONData().customer.email).toBe(updatePayload.email);
      expect(mockRes._getJSONData().customer.password).toBeUndefined();
    });

    test('should successfully update password if provided and valid', async () => {
      const payloadWithPassword = { ...updatePayload, password: 'newValidPassword123' };
      setup('PUT', mockValidCustomerId, payloadWithPassword);
      (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance);


      await handler(mockReq, mockRes);

      expect(mockBcryptHash).toHaveBeenCalledWith(payloadWithPassword.password, 12);
      expect(mockCustomerInstance.password).toBe('newHashedPassword');
      expect(mockCustomerInstance.save).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(200);
    });

    test('should NOT update password if password field is empty or missing', async () => {
      const payloadWithoutPassword = { ...updatePayload, password: '' };
      setup('PUT', mockValidCustomerId, payloadWithoutPassword);
      (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance);

      await handler(mockReq, mockRes);

      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(mockCustomerInstance.password).toBe('oldHashedPassword'); // Should remain unchanged
      expect(mockCustomerInstance.save).toHaveBeenCalled();
      expect(mockRes._getStatusCode()).toBe(200);
    });

    test('should return 409 if updated email is already in use by another customer', async () => {
      const payloadWithExistingEmail = { ...updatePayload, email: 'another@example.com' };
      setup('PUT', mockValidCustomerId, payloadWithExistingEmail);
      (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance); // Original customer
      // Simulate that 'another@example.com' is taken by someone else
      (Customer.findOne as jest.Mock).mockResolvedValue({ _id: 'otherCustomerId', email: 'another@example.com' });

      await handler(mockReq, mockRes);

      expect(Customer.findOne).toHaveBeenCalledWith({ email: payloadWithExistingEmail.email.toLowerCase() });
      expect(mockRes._getStatusCode()).toBe(409);
      expect(mockRes._getJSONData().message).toBe('New email address is already in use.');
    });

    test('should allow updating email to the same email (case-insensitive)', async () => {
        const payloadWithSameEmail = { ...updatePayload, email: 'ORIGINAL@example.com' }; // Same email, different case
        setup('PUT', mockValidCustomerId, payloadWithSameEmail);
        (Customer.findById as jest.Mock).mockResolvedValue(mockCustomerInstance);
        // When checking for email uniqueness, findOne should return the current customer, which is fine.
        (Customer.findOne as jest.Mock).mockResolvedValue(mockCustomerInstance);

        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(200); // Should not throw 409
        expect(mockCustomerInstance.email).toBe(payloadWithSameEmail.email.toLowerCase());
    });


    test('should return 404 if customer to update is not found', async () => {
      setup('PUT', mockValidCustomerId, updatePayload);
      (Customer.findById as jest.Mock).mockResolvedValue(null); // Simulate not found
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(404);
    });

    // Add more validation error tests for specific fields (e.g., empty firstName)
    test('should return 400 if required field like firstName is missing on update', async () => {
        const invalidPayload = { ...updatePayload, firstName: '' };
        setup('PUT', mockValidCustomerId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Missing required fields');
    });

  });
    // --- Method Not Allowed ---
    test('should return 405 for unsupported methods like DELETE', async () => {
        setup('DELETE');
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(405);
    });
});
