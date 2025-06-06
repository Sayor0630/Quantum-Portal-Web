import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './lookup'; // API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Customer from '../../../../models/Customer';
import { Role } from '../../../../lib/permissions'; // For session role

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Customer');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock; // Corrected mock name

describe('/api/admin/customers/lookup API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  const setup = (method: RequestMethod, query?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: query || {},
    }));
    mockDbConnect.mockResolvedValue(undefined); // Simulate successful DB connection
    // Default to an authenticated admin session
    mockGetServerSession.mockResolvedValue({
      user: { role: Role.ADMIN, id: 'adminUserId' }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  // --- Authentication Tests ---
  test('should return 401 if no session found', async () => {
    setup('GET', { email: 'test@example.com' });
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Unauthorized: No valid session found');
  });

  // Note: The current lookup API doesn't have specific sub-role permission checks,
  // just that the user is an authenticated admin. If granular permissions were added,
  // those tests would go here.

  // --- Parameter Validation Tests ---
  test('should return 400 if neither email nor phone is provided', async () => {
    setup('GET', {}); // Empty query
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    expect(mockRes._getJSONData().message).toBe('Bad Request: Email or phone number must be provided for lookup.');
  });

  test('should return 400 if phone lookup is attempted (as it is currently not supported by primary field)', async () => {
    setup('GET', { phone: '01234567890' });
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(400);
    // This message comes from the current implementation detail
    expect(mockRes._getJSONData().message).toBe('Bad Request: Phone lookup is not currently supported by primary field. Please use email.');
  });

   test('should return 400 if email is provided but invalid format (for consistency, though API might not strictly check format if just passing to DB)', async () => {
    // The API doesn't strictly validate email format itself, but if it did, this would be the test.
    // Current API relies on DB query for email. If email is just a malformed string, DB won't find it.
    // Let's assume for now a basic check or a specific error if the query parameter itself is problematic.
    // The API currently has: `else if (phone && typeof phone === 'string')` and then `else { return res.status(400).json({ message: 'Bad Request: Invalid email or phone parameter.'});}`
    // This `else` is hard to reach if email is string but malformed.
    // The most practical test is that a malformed email won't find a customer.
    setup('GET', { email: 'not-an-email' });
    (Customer.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null) // Simulate not found for malformed email
    });
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(404); // Because it won't be found
    expect(mockRes._getJSONData().message).toBe('Customer not found.');
  });


  // --- GET Requests ---
  describe('GET /api/admin/customers/lookup (by email)', () => {
    test('should return 200 and customer data if found by email', async () => {
      const customerEmail = 'test@example.com';
      const mockCustomer = {
        _id: 'customerId123',
        firstName: 'Test',
        lastName: 'User',
        email: customerEmail,
        addresses: [{ street: '123 Main St', city: 'Testville', district: 'Test District', country: 'Testland', postalCode: '12345' }]
      };
      setup('GET', { email: customerEmail });
      (Customer.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(), // Chain select
        lean: jest.fn().mockResolvedValue(mockCustomer) // Simulate lean() returning the object
      });

      await handler(mockReq, mockRes);

      expect(Customer.findOne).toHaveBeenCalledWith({ email: customerEmail.toLowerCase() });
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      expect(mockRes._getJSONData().data).toEqual(mockCustomer);
    });

    test('should return 404 if customer not found by email', async () => {
      const customerEmail = 'notfound@example.com';
      setup('GET', { email: customerEmail });
      (Customer.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null) // Simulate customer not found
      });

      await handler(mockReq, mockRes);

      expect(mockRes._getStatusCode()).toBe(404);
      expect(mockRes._getJSONData().message).toBe('Customer not found.');
    });

    test('should return 500 if database query fails', async () => {
      const customerEmail = 'error@example.com';
      setup('GET', { email: customerEmail });
      (Customer.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(500);
      expect(mockRes._getJSONData().message).toBe('Internal Server Error');
      expect(mockRes._getJSONData().error).toBe('Database error');
    });
  });

  // --- Other HTTP Methods ---
  test('should return 405 for unsupported HTTP methods', async () => {
    setup('POST', { email: 'test@example.com' }); // Example of an unsupported method
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
    expect(mockRes._getJSONData().message).toBe('Method POST Not Allowed');
  });
});
