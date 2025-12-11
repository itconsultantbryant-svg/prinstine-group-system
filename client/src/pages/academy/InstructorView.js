import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';

const InstructorView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instructor, setInstructor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInstructor();
  }, [id]);

  const fetchInstructor = async () => {
    try {
      const response = await api.get(`/academy/instructors/${id}`);
      if (response.data && response.data.instructor) {
        setInstructor(response.data.instructor);
      } else {
        setError('Instructor data not found in response');
      }
    } catch (err) {
      console.error('Instructor fetch error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load instructor details');
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

  if (!instructor) {
    return (
      <div className="alert alert-warning">
        Instructor not found
        <button className="btn btn-sm btn-outline-secondary ms-3" onClick={() => navigate('/academy')}>
          Back to Academy
        </button>
      </div>
    );
  }

  const assignedCourses = instructor.courses_assigned ? JSON.parse(instructor.courses_assigned) : [];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-12 d-flex justify-content-between align-items-center">
          <div>
            <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/academy')}>
              <i className="bi bi-arrow-left me-2"></i>Back
            </button>
            <h1 className="h3 mb-0 d-inline">Instructor Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body text-center">
              {instructor.profile_image ? (
                <img 
                  src={instructor.profile_image} 
                  alt={instructor.name} 
                  className="img-fluid rounded-circle mb-3"
                  style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                />
              ) : (
                <div className="bg-info rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '150px', height: '150px' }}>
                  <i className="bi bi-person" style={{ fontSize: '4rem', color: 'white' }}></i>
                </div>
              )}
              <h4>{instructor.name}</h4>
              <p className="text-muted">{instructor.email}</p>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Instructor Information</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Instructor ID:</strong>
                  <p>{instructor.instructor_id}</p>
                </div>
                <div className="col-md-6">
                  <strong>Phone:</strong>
                  <p>{instructor.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Specialization:</strong>
                  <p>{instructor.specialization || 'N/A'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Courses Assigned:</strong>
                  <p>{assignedCourses.length} course(s)</p>
                </div>
              </div>

              {assignedCourses.length > 0 && (
                <div className="mb-3">
                  <strong>Assigned Course IDs:</strong>
                  <p>
                    {assignedCourses.map((courseId, idx) => (
                      <span key={idx} className="badge bg-primary me-1">Course #{courseId}</span>
                    ))}
                  </p>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(instructor.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorView;

