import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import DepartmentForm from './DepartmentForm';
import DepartmentList from './DepartmentList';

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/departments');
      console.log('Departments fetched:', response.data.departments);
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setShowForm(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await api.delete(`/departments/${id}`);
        fetchDepartments();
      } catch (error) {
        alert(error.response?.data?.error || 'Error deleting department');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingDepartment(null);
    fetchDepartments();
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

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <h1 className="h3 mb-0">Department Management</h1>
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="bi bi-plus-circle me-2"></i>Add Department
          </button>
        </div>
      </div>

      <DepartmentList
        departments={departments}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showForm && (
        <DepartmentForm
          department={editingDepartment}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
};

export default DepartmentManagement;

