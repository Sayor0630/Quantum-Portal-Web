import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './index'; // The API route handler for listing orders
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer'; // For populate
import Product from '../../../../models/Product';  // For populate
import { Role, Permission, hasPermission } from '../../../../lib/permissions'; // For session and permission check
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Order');
jest.mock('../../../../lib/permissions');
// Customer and Product are used via populate, their direct methods aren't called from Order.find usually,
// but it's good practice if we were testing deeper aspects of populate.
// jest.mock('../../../../models/Customer');
// jest.mock('../../../../models/Product');


const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock; // For permission checks if any are added at this level

describe('/api/admin/orders API Endpoint (List Orders)', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];

  const mockOrdersData = [
    {
      _id: new mongoose.Types.ObjectId().toString(),
      customer: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      orderItems: [{ product: { name: 'Product A' }, quantity: 1, price: 100 }],
      totalAmount: 100,
      status: 'pending',
      paymentStatus: 'unpaid', // New field
      shippingAddress: { // Expanded address
        fullName: 'John Doe',
        phone: '01234567890',
        street: '123 Main St',
        city: 'Anytown',
        district: 'Some District',
        postalCode: '12345',
        country: 'Bangladesh',
      },
      deliveryNote: 'Call on arrival.', // New field
      createdAt: new Date().toISOString(),
    },
    {
      _id: new mongoose.Types.ObjectId().toString(),
      customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
      orderItems: [{ product: { name: 'Product B' }, quantity: 2, price: 50 }],
      totalAmount: 100,
      status: 'processing',
      paymentStatus: 'paid', // New field
      shippingAddress: { // Expanded address
        fullName: 'Jane Doe',
        phone: '01987654321',
        street: '456 Oak Ave',
        city: 'Otherville',
        district: 'Another District',
        postalCode: '67890',
        country: 'Bangladesh',
      },
      createdAt: new Date().toISOString(),
    }
  ];

  const setup = (method: RequestMethod, query?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: { page: '1', limit: '10', ...query }, // Default query params
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } }); // Assume admin session
    // For this list endpoint, specific permission beyond being an admin might not be checked in the handler,
    // but if it were, hasPermission would be mocked here.
    // mockHasPermission.mockReturnValue(true);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Order.find() chain
    const mockQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockOrdersData),
    };
    (Order.find as jest.Mock).mockReturnValue(mockQuery);
    (Order.countDocuments as jest.Mock).mockResolvedValue(mockOrdersData.length);
  });

  // --- Authentication Tests ---
  test('should return 401 if no session found', async () => {
    setup('GET');
    mockGetServerSession.mockResolvedValue(null);
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(401);
    expect(mockRes._getJSONData().message).toBe('Unauthorized');
  });

  // --- Method Validation ---
  test('should return 405 for non-GET methods', async () => {
    setup('POST');
    await handler(mockReq, mockRes);
    expect(mockRes._getStatusCode()).toBe(405);
  });

  // --- GET Request Tests ---
  describe('GET /api/admin/orders', () => {
    test('should return 200 and a list of orders including new fields', async () => {
      setup('GET');
      await handler(mockReq, mockRes);

      expect(mockRes._getStatusCode()).toBe(200);
      const jsonData = mockRes._getJSONData();
      expect(jsonData.orders.length).toBe(mockOrdersData.length);

      // Check for new fields in the first returned order
      const firstOrder = jsonData.orders[0];
      expect(firstOrder.paymentStatus).toBe(mockOrdersData[0].paymentStatus);
      expect(firstOrder.deliveryNote).toBe(mockOrdersData[0].deliveryNote);
      expect(firstOrder.shippingAddress.fullName).toBe(mockOrdersData[0].shippingAddress.fullName);
      expect(firstOrder.shippingAddress.phone).toBe(mockOrdersData[0].shippingAddress.phone);
      expect(firstOrder.shippingAddress.district).toBe(mockOrdersData[0].shippingAddress.district);

      expect(jsonData.currentPage).toBe(1);
      expect(jsonData.totalPages).toBe(1);
      expect(jsonData.totalItems).toBe(mockOrdersData.length);
    });

    test('should correctly apply pagination parameters', async () => {
      setup('GET', { page: '2', limit: '5' });
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      (Order.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: mockSkip,
        limit: mockLimit,
        lean: jest.fn().mockResolvedValue([]), // Return empty for this specific pagination test if needed
      });
      (Order.countDocuments as jest.Mock).mockResolvedValue(20); // Total 20 items for 5 per page = 4 pages

      await handler(mockReq, mockRes);

      expect(mockSkip).toHaveBeenCalledWith((2 - 1) * 5);
      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().currentPage).toBe(2);
      expect(mockRes._getJSONData().totalPages).toBe(4); // 20 items / 5 per page
    });

    test('should handle errors during DB query', async () => {
        setup('GET');
        (Order.find as jest.Mock).mockReturnValue({
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockRejectedValue(new Error('Database query failed')),
        });
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(500);
        expect(mockRes._getJSONData().message).toBe('Error fetching orders');
    });
  });
});
