import React from 'react';
import { Link } from 'react-router-dom';

const DepartmentList = ({ departments, onEdit, onDelete }) => {
  return (
    <div className="card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted">
                    No departments found. Click "Add Department" to create one.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id}>
                    <td><strong>{dept.name}</strong></td>
                    <td>{dept.description || 'N/A'}</td>
                    <td>{new Date(dept.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link
                        to={`/departments/view/${dept.id}`}
                        className="btn btn-sm btn-outline-info me-2"
                      >
                        <i className="bi bi-eye me-1"></i>View
                      </Link>
                      <button
                        className="btn btn-sm btn-outline-primary me-2"
                        onClick={() => onEdit(dept)}
                      >
                        <i className="bi bi-pencil me-1"></i>Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onDelete(dept.id)}
                      >
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
  );
};

export default DepartmentList;

