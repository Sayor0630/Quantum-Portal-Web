import React from 'react';
import AdminLayout from '../../components/admin/AdminLayout'; // Adjust path if necessary

const AdminDashboardPage = () => {
  return (
    <AdminLayout>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the Admin Panel.</p>
      {/* Placeholder for key metrics and charts */}
      <div>
        <h2>Key Metrics (Placeholder)</h2>
        <ul>
          <li>Total Sales: ...</li>
          <li>New Orders: ...</li>
          <li>New Users: ...</li>
        </ul>
      </div>
      <div>
        <h2>Graphs/Charts (Placeholder)</h2>
        <p>[Chart for revenue trends]</p>
        <p>[Chart for sales trends]</p>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
