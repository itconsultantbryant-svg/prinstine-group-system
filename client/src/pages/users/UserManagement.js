import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import UserForm from './UserForm';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filters, setFilters] = useState({
    role: '',
    search: ''
  });

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.role) params.append('role', filters.role);
      if (filters.search) params.append('search', filters.search);

      const response = await api.get(`/users?${params.toString()}`);
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEdit = async (user) => {
    try {
      const response = await api.get(`/users/${user.id}`);
      setEditingUser(response.data.user);
      setShowForm(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setEditingUser(user);
      setShowForm(true);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting user');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const roles = ['Admin', 'Staff', 'Instructor', 'Student', 'Client', 'Partner'];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">User Management</h1>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, email..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <button
            className="btn btn-outline-secondary w-100"
            onClick={() => setFilters({ role: '', search: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No users found. Click "Add User" to create one.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          {user.profile_image ? (
                            <img 
                              src={user.profile_image} 
                              alt={user.name}
                              className="rounded-circle me-2"
                              style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                            />
                          ) : (
                            <i className="bi bi-person-circle me-2" style={{ fontSize: '1.5rem' }}></i>
                          )}
                          {user.name}
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge bg-${
                          user.role === 'Admin' ? 'danger' :
                          user.role === 'Staff' ? 'primary' :
                          user.role === 'Instructor' ? 'info' :
                          user.role === 'Student' ? 'success' :
                          user.role === 'Client' ? 'warning' : 'secondary'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{user.phone || 'N/A'}</td>
                      <td>
                        <span className={`badge bg-${user.is_active ? 'success' : 'danger'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(user)}>
                          <i className="bi bi-pencil me-1"></i>Edit
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(user.id)}>
                          <i className="bi bi-trash me-1"></i>Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <UserForm
          user={editingUser}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default UserManagement;
