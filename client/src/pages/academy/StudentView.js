import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';

const StudentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    try {
      const response = await api.get(`/academy/students/${id}`);
      setStudent(response.data.student);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
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

  if (error) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {error}
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/academy')}>
          Back to Academy
        </button>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="alert alert-warning">
        Student not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/academy')}>
          Back to Academy
        </button>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/academy')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Student Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              {student.profile_image ? (
                <img 
                  src={student.profile_image} 
                  alt={student.name} 
                  className="img-fluid rounded-circle mb-3"
                  style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                />
              ) : (
                <div className="bg-success rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '150px', height: '150px' }}>
                  <i className="bi bi-person" style={{ fontSize: '4rem', color: 'white' }}></i>
                </div>
              )}
              <h4>{student.name}</h4>
              <p className="text-muted">{student.email}</p>
              <span className={`badge bg-${student.status === 'Active' ? 'success' : 'secondary'} fs-6`}>
                {student.status}
              </span>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Student Information</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Student ID:</strong>
                  <p>{student.student_id}</p>
                </div>
                <div className="col-md-6">
                  <strong>Phone:</strong>
                  <p>{student.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Enrollment Date:</strong>
                  <p>{student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Status:</strong>
                  <p>
                    <span className={`badge bg-${student.status === 'Active' ? 'success' : 'secondary'}`}>
                      {student.status}
                    </span>
                  </p>
                </div>
              </div>

              {student.courses_enrolled && (
                <div className="mb-3">
                  <strong>Courses Enrolled:</strong>
                  <p>
                    {JSON.parse(student.courses_enrolled).map((courseId, idx) => (
                      <span key={idx} className="badge bg-info me-1">Course #{courseId}</span>
                    ))}
                  </p>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(student.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentView;

