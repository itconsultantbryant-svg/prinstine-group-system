import React from 'react';
import { Link } from 'react-router-dom';
import { normalizeUrl } from '../../utils/apiUrl';

const StaffList = ({ staff, onEdit, onDelete }) => {
  return (
    <div className="card">
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover">
              <thead>
              <tr>
                <th>Image</th>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Department</th>
                <th>Employment Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    No staff members found
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.profile_image && member.profile_image.trim() !== '' ? (
                        <img
                          src={member.profile_image.startsWith('http') ? member.profile_image : normalizeUrl(member.profile_image)}
                          alt={member.name}
                          className="rounded-circle"
                          style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="bg-secondary rounded-circle d-flex align-items-center justify-content-center"
                          style={{
                            width: '40px',
                            height: '40px'
                          }}
                        >
                          <i className="bi bi-person text-white"></i>
                        </div>
                      )}
                    </td>
                    <td>{member.staff_id}</td>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.position}</td>
                    <td>{member.department}</td>
                    <td>
                      <span className={`badge bg-${
                        member.employment_type === 'Full-time' ? 'primary' :
                        member.employment_type === 'Part-time' ? 'warning' : 'success'
                      }`}>
                        {member.employment_type}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/staff/view/${member.id}`}
                        className="btn btn-sm btn-outline-info me-2"
                      >
                        <i className="bi bi-eye me-1"></i>View
                      </Link>
                      <button
                        className="btn btn-sm btn-outline-primary me-2"
                        onClick={() => onEdit(member)}
                      >
                        <i className="bi bi-pencil me-1"></i>Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onDelete(member.id)}
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

export default StaffList;

