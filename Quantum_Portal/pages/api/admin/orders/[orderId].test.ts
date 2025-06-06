import { createMocks, RequestMethod } from 'node-mocks-http';
import handler from './[orderId]'; // The API route handler
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../../lib/dbConnect';
import Order from '../../../../models/Order';
import Customer from '../../../../models/Customer';
import Product from '../../../../models/Product';
import { hasPermission, Role, Permission } from '../../../../lib/permissions';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('../../../../lib/dbConnect');
jest.mock('../../../../models/Order');
jest.mock('../../../../models/Customer'); // Required for populate
jest.mock('../../../../models/Product');  // Required for populate
jest.mock('../../../../lib/permissions');

const mockGetServerSession = getServerSession as jest.Mock;
const mockDbConnect = dbConnect as jest.Mock;
const mockHasPermission = hasPermission as jest.Mock;

const mockValidOrderId = new mongoose.Types.ObjectId().toString();
const mockCustomerId = new mongoose.Types.ObjectId().toString();

// For product population
(Product.findById as jest.Mock) = jest.fn().mockImplementation(id => Promise.resolve({ _id: id, name: 'Mock Product' }));


describe('/api/admin/orders/[orderId] API Endpoint', () => {
  let mockReq: ReturnType<typeof createMocks>['req'];
  let mockRes: ReturnType<typeof createMocks>['res'];
  let mockOrderInstance: any;
  let mockExistingOrderData: any;

  const setup = (method: RequestMethod, orderId?: string, body?: any, query?: any) => {
    ({ req: mockReq, res: mockRes } = createMocks({
      method,
      query: { orderId: orderId || mockValidOrderId, ...query },
      body,
    }));
    mockDbConnect.mockResolvedValue(undefined);
    mockGetServerSession.mockResolvedValue({ user: { role: Role.ADMIN } });
    mockHasPermission.mockReturnValue(true);

    mockExistingOrderData = {
      _id: mockValidOrderId,
      customer: mockCustomerId,
      shippingAddress: {
        fullName: 'Old FullName',
        phone: '01111111111',
        email: 'old@example.com',
        street: 'Old Street',
        city: 'Old City',
        district: 'Old District',
        postalCode: '12300',
        country: 'Bangladesh',
      },
      orderItems: [
        { product: new mongoose.Types.ObjectId(), name: 'Item 1', price: 50, quantity: 2, _id: new mongoose.Types.ObjectId() }, // Total 100
      ],
      totalAmount: 100,
      paymentMethod: 'Old Method',
      paymentStatus: 'unpaid',
      status: 'pending',
      deliveryNote: 'Old note',
      isPaid: false,
      paidAt: undefined,
      isDelivered: false,
      deliveredAt: undefined,
      save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); }),
      populate: jest.fn().mockReturnThis(), // For chained populate calls
      lean: jest.fn().mockReturnThis(), // For GET request .lean()
    };

    // Mock static methods like findById and chained populate/lean
    (Order.findById as jest.Mock).mockImplementation(() => ({
      populate: jest.fn().mockImplementation(function(this: any, pathArg: any) {
        // Simulate population for customer and product
        if (pathArg.path === 'customer') {
          this.customer = { _id: mockCustomerId, firstName: 'Test', lastName: 'Customer', email: 'test@cust.com' };
        } else if (pathArg.path === 'orderItems.product') {
          this.orderItems = this.orderItems.map((item: any) => ({
            ...item,
            product: { _id: item.product, name: `Product ${item.product.toString().slice(-4)}`, sku: `SKU${item.product.toString().slice(-4)}` }
          }));
        }
        return this; // Return this for further chaining if any
      }),
      lean: jest.fn().mockResolvedValue(mockExistingOrderData), // For GET
      exec: jest.fn().mockResolvedValue(mockExistingOrderData), // If not using lean directly after populate
    }));
     // For PUT, findById needs to return the Mongoose document instance for save()
    (Order.findById as jest.Mock).mockResolvedValue(mockExistingOrderData);


  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- GET Request Tests (Verifying new fields are returned) ---
  describe('GET /api/admin/orders/[orderId]', () => {
    test('should return 200 and full order data including new fields', async () => {
      setup('GET');
       // Re-setup mock for GET to use the lean version correctly
      (Order.findById as jest.Mock).mockImplementationOnce(() => ({
        populate: jest.fn().mockReturnThis(), // First populate
        populate: jest.fn().mockReturnThis(), // Second populate (if any)
        lean: jest.fn().mockResolvedValue(mockExistingOrderData) // Ensure lean is called
      }));
      await handler(mockReq, mockRes);
      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      const orderData = mockRes._getJSONData().data;
      expect(orderData.paymentStatus).toBe('unpaid'); // New field
      expect(orderData.deliveryNote).toBe('Old note'); // New field
      expect(orderData.shippingAddress.fullName).toBe('Old FullName'); // Expanded address
      expect(orderData.shippingAddress.phone).toBe('01111111111');
      expect(orderData.shippingAddress.district).toBe('Old District');
    });
    // Add tests for 401, 403, 404, invalid ID as in other [id] tests
  });

  // --- PUT Request Tests (Comprehensive Order Update) ---
  describe('PUT /api/admin/orders/[orderId]', () => {
    const mockProductId = new mongoose.Types.ObjectId().toString();
    const updatePayload = {
      shippingAddress: {
        fullName: "Updated FullName",
        phone: "01234567890",
        email: "updated@example.com",
        street: "Updated Street",
        city: "Updated City",
        district: "Updated District",
        postalCode: "54321",
        country: "Bangladesh",
      },
      deliveryNote: "Updated delivery note.",
      paymentMethod: "Updated Payment Method",
      paymentStatus: "paid",
      status: "processing",
      orderItems: [
        { productId: mockProductId, name: "Updated Item 1", price: 75, quantity: 3, _id: mockExistingOrderData.orderItems[0]._id.toString() }, // Total 225
      ],
    };

    test('should successfully update all editable fields and recalculate total', async () => {
      setup('PUT', mockValidOrderId, updatePayload);
       // Ensure findById returns the mock Mongoose document that has .save()
      (Order.findById as jest.Mock).mockResolvedValue(mockExistingOrderData);


      await handler(mockReq, mockRes);

      expect(Order.findById).toHaveBeenCalledWith(new mongoose.Types.ObjectId(mockValidOrderId));

      // Check updated fields on mockOrderInstance (which is mockExistingOrderData)
      expect(mockExistingOrderData.shippingAddress.fullName).toBe(updatePayload.shippingAddress.fullName);
      expect(mockExistingOrderData.shippingAddress.phone).toBe(updatePayload.shippingAddress.phone);
      expect(mockExistingOrderData.shippingAddress.district).toBe(updatePayload.shippingAddress.district);
      expect(mockExistingOrderData.deliveryNote).toBe(updatePayload.deliveryNote);
      expect(mockExistingOrderData.paymentMethod).toBe(updatePayload.paymentMethod);
      expect(mockExistingOrderData.paymentStatus).toBe('paid');
      expect(mockExistingOrderData.isPaid).toBe(true);
      expect(mockExistingOrderData.paidAt).toBeInstanceOf(Date);
      expect(mockExistingOrderData.status).toBe('processing');
      expect(mockExistingOrderData.orderItems.length).toBe(1);
      expect(mockExistingOrderData.orderItems[0].quantity).toBe(3);
      expect(mockExistingOrderData.orderItems[0].price).toBe(75);
      expect(mockExistingOrderData.totalAmount).toBe(225); // 75 * 3
      expect(mockExistingOrderData.save).toHaveBeenCalled();

      expect(mockRes._getStatusCode()).toBe(200);
      expect(mockRes._getJSONData().success).toBe(true);
      const responseData = mockRes._getJSONData().data;
      expect(responseData.totalAmount).toBe(225);
      expect(responseData.paymentStatus).toBe('paid');
    });

    test('should return 400 if essential fields are missing in payload', async () => {
        const invalidPayload = { ...updatePayload, shippingAddress: undefined };
        setup('PUT', mockValidOrderId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Missing required fields for update');
    });

    test('should return 400 for invalid shippingAddress.phone format', async () => {
        const invalidPayload = { ...updatePayload, shippingAddress: { ...updatePayload.shippingAddress, phone: '123' } };
        setup('PUT', mockValidOrderId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Invalid phone number in shipping address');
    });

    test('should return 400 for invalid paymentStatus enum', async () => {
        const invalidPayload = { ...updatePayload, paymentStatus: 'half-paid' };
        setup('PUT', mockValidOrderId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Invalid paymentStatus');
    });

    test('should return 400 for invalid order status enum', async () => {
        const invalidPayload = { ...updatePayload, status: 'lost-in-mail' };
        setup('PUT', mockValidOrderId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Invalid order status');
    });

    test('should return 400 for invalid orderItem structure (e.g., quantity <= 0)', async () => {
        const invalidPayload = { ...updatePayload, orderItems: [{ ...updatePayload.orderItems[0], quantity: 0 }] };
        setup('PUT', mockValidOrderId, invalidPayload);
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(400);
        expect(mockRes._getJSONData().message).toContain('Invalid order item structure');
    });

    test('should return 404 if order to update is not found', async () => {
        setup('PUT', mockValidOrderId, updatePayload);
        (Order.findById as jest.Mock).mockResolvedValue(null); // Simulate not found
        await handler(mockReq, mockRes);
        expect(mockRes._getStatusCode()).toBe(404);
    });
  });
});
