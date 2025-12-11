import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';

const CourseView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/academy/courses/${id}`);
      setCourse(response.data.course);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load course details');
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

  if (!course) {
    return (
      <div className="alert alert-warning">
        Course not found
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
            <h1 className="h3 mb-0 d-inline">Course Details</h1>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-12">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">{course.title}</h5>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Course Code:</strong>
                  <p>{course.course_code}</p>
                </div>
                <div className="col-md-6">
                  <strong>Mode:</strong>
                  <p>
                    <span className={`badge bg-${
                      course.mode === 'Online' ? 'primary' :
                      course.mode === 'In-person' ? 'success' : 'warning'
                    }`}>
                      {course.mode}
                    </span>
                  </p>
                </div>
              </div>

              {course.description && (
                <div className="mb-3">
                  <strong>Description:</strong>
                  <p>{course.description}</p>
                </div>
              )}

              <div className="row mb-3">
                <div className="col-md-4">
                  <strong>Start Date:</strong>
                  <p>{course.start_date ? new Date(course.start_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="col-md-4">
                  <strong>End Date:</strong>
                  <p>{course.end_date ? new Date(course.end_date).toLocaleDateString() : 'N/A'}</p>
                </div>
                <div className="col-md-4">
                  <strong>Max Students:</strong>
                  <p>{course.max_students || 'Unlimited'}</p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Instructor:</strong>
                  <p>{course.instructor_name || 'Not assigned'}</p>
                </div>
                <div className="col-md-6">
                  <strong>Status:</strong>
                  <p>
                    <span className={`badge bg-${course.status === 'Active' ? 'success' : 'secondary'}`}>
                      {course.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <strong>Created:</strong>
                  <p>{new Date(course.created_at).toLocaleDateString()}</p>
                </div>
                <div className="col-md-6">
                  <strong>Last Updated:</strong>
                  <p>{course.updated_at ? new Date(course.updated_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseView;

