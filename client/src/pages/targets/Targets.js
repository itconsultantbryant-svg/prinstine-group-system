import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import { getSocket } from '../../config/socket';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Targets = () => {
  const { user } = useAuth();
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [availableAmount, setAvailableAmount] = useState(0);
  const [users, setUsers] = useState([]);
  const [sharingHistory, setSharingHistory] = useState([]);
  const [targetProgress, setTargetProgress] = useState([]);

  // Form states
  const [createForm, setCreateForm] = useState({
    user_id: '',
    target_amount: '',
    category: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: '',
    notes: ''
  });

  const [editForm, setEditForm] = useState({
    target_amount: '',
    category: '',
    period_start: '',
    period_end: '',
    status: '',
    notes: ''
  });

  const [shareForm, setShareForm] = useState({
    to_user_id: '',
    amount: '',
    reason: ''
  });

  const [extendForm, setExtendForm] = useState({
    additional_amount: '',
    period_end: ''
  });

  useEffect(() => {
    fetchTargets(true);
    fetchSharingHistory();
    fetchUsers();

    // Set up real-time socket connection
    const socket = getSocket();
    if (socket) {
      const handleTargetCreated = () => {
        console.log('Target created event received, refreshing...');
        fetchTargets(true);
        fetchSharingHistory();
      };

      const handleTargetUpdated = () => {
        console.log('Target updated event received, refreshing...');
        fetchTargets(true);
        fetchSharingHistory();
      };

      const handleFundShared = (data) => {
        console.log('Fund shared event received:', data);
        console.log('Refreshing targets and sharing history...');
        // Add a small delay to ensure backend has committed the transaction
        setTimeout(() => {
          fetchTargets(true);
          fetchSharingHistory();
        }, 300);
      };

      const handleTargetProgressUpdated = (data) => {
        console.log('Target progress updated event received:', data);
        console.log('Event data:', {
          target_id: data.target_id,
          action: data.action,
          status: data.status,
          total_progress: data.total_progress,
          net_amount: data.net_amount,
          progress_percentage: data.progress_percentage,
          remaining_amount: data.remaining_amount
        });
        console.log('Refreshing targets and sharing history...');
        
        // Force immediate refresh with cache-busting
        fetchTargets(true);
        fetchSharingHistory();
        
        // If viewing progress for this target, refresh it
        if (data.target_id && selectedTarget && selectedTarget.id === data.target_id) {
          fetchTargetProgress(selectedTarget.id);
        }
        
        // Update local state immediately if we have the calculated values from the event
        if (data.net_amount !== undefined && data.target_id) {
          setTargets(prevTargets => prevTargets.map(target => {
            if (target.id === data.target_id) {
              return {
                ...target,
                net_amount: parseFloat(data.net_amount || 0),
                progress_percentage: parseFloat(data.progress_percentage || 0).toFixed(2),
                remaining_amount: parseFloat(data.remaining_amount || 0),
                total_progress: parseFloat(data.total_progress || target.total_progress || 0)
              };
            }
            return target;
          }));
        }
        
        // Also refresh again after delays to ensure database commit and accurate calculations
        setTimeout(() => {
          console.log('Second refresh after progress update (500ms delay)...');
          fetchTargets(true);
          fetchSharingHistory();
          if (data.target_id && selectedTarget && selectedTarget.id === data.target_id) {
            fetchTargetProgress(selectedTarget.id);
          }
        }, 500);
        
        setTimeout(() => {
          console.log('Third refresh after progress update (1500ms delay - ensuring database commit)...');
          fetchTargets(true);
          fetchSharingHistory();
          if (data.target_id && selectedTarget && selectedTarget.id === data.target_id) {
            fetchTargetProgress(selectedTarget.id);
          }
        }, 1500);
        
        // Fourth refresh for final verification
        setTimeout(() => {
          console.log('Fourth refresh after progress update (3000ms delay - final verification)...');
          fetchTargets(true);
        }, 3000);
      };

      const handleTargetDeleted = () => {
        console.log('Target deleted event received, refreshing...');
        setTimeout(() => {
          fetchTargets(true);
          fetchSharingHistory();
        }, 300);
      };

      const handleFundReversed = (data) => {
        console.log('Fund reversed event received:', data);
        setTimeout(() => {
          fetchTargets(true);
          fetchSharingHistory();
        }, 300);
      };

      const handleProgressReportApproved = (data) => {
        console.log('Progress report approved event received:', data);
        // If this affects a target, refresh the targets list immediately and again after delay
        if (data.user_id || data.amount) {
          console.log('Refreshing targets after progress report approval...');
          // Immediate refresh with cache-busting
          fetchTargets(true);
          fetchSharingHistory();
          // Also refresh again after delays to ensure database commit and accurate calculations
          setTimeout(() => {
            console.log('Second refresh after progress report approval (500ms delay)...');
            fetchTargets(true);
            fetchSharingHistory();
          }, 500);
          setTimeout(() => {
            console.log('Third refresh after progress report approval (1500ms delay - ensuring database commit)...');
            fetchTargets(true);
            fetchSharingHistory();
          }, 1500);
          setTimeout(() => {
            console.log('Fourth refresh after progress report approval (3000ms delay - final verification)...');
            fetchTargets(true);
          }, 3000);
        }
      };

      const handleTargetProgressCreated = (data) => {
        console.log('Target progress created event received:', data);
        // Refresh targets and progress history when new pending progress is created
        if (data.target_id && selectedTarget && selectedTarget.id === data.target_id) {
          // If viewing progress for this target, refresh it
          fetchTargetProgress(selectedTarget.id);
        }
        // Always refresh targets list to show updated counts
        fetchTargets(true);
      };

      const handleProgressReportCreated = (data) => {
        console.log('Progress report created event received:', data);
        // Refresh targets to show new pending progress entries
        fetchTargets(true);
        // If viewing progress history, refresh it
        if (selectedTarget) {
          fetchTargetProgress(selectedTarget.id);
        }
      };

      socket.on('target_created', handleTargetCreated);
      socket.on('target_updated', handleTargetUpdated);
      socket.on('fund_shared', handleFundShared);
      socket.on('fund_reversed', handleFundReversed);
      socket.on('target_progress_updated', handleTargetProgressUpdated);
      socket.on('target_progress_created', handleTargetProgressCreated);
      socket.on('target_deleted', handleTargetDeleted);
      socket.on('progress_report_approved', handleProgressReportApproved);
      socket.on('progress_report_created', handleProgressReportCreated);

      return () => {
        socket.off('target_created', handleTargetCreated);
        socket.off('target_updated', handleTargetUpdated);
        socket.off('fund_shared', handleFundShared);
        socket.off('fund_reversed', handleFundReversed);
        socket.off('target_progress_updated', handleTargetProgressUpdated);
        socket.off('target_progress_created', handleTargetProgressCreated);
        socket.off('target_deleted', handleTargetDeleted);
        socket.off('progress_report_approved', handleProgressReportApproved);
        socket.off('progress_report_created', handleProgressReportCreated);
      };
    }
  }, [user]);

  const fetchTargets = async (forceRefresh = false) => {
    try {
      if (forceRefresh || !loading) {
        setLoading(true);
      }
      setError('');
      console.log('Fetching targets...', { forceRefresh, timestamp: new Date().toISOString() });
      
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await api.get(`/targets?t=${timestamp}`);
      console.log('Targets API response status:', response.status);
      console.log('Targets API response data:', response.data);
      
      // Handle different response formats
      const targetsData = response.data?.targets || response.data || [];
      const targetsArray = Array.isArray(targetsData) ? targetsData : [];
      console.log(`Setting ${targetsArray.length} targets in state`);
      
      if (targetsArray.length > 0) {
        const sample = targetsArray[0];
        console.log('Sample target (from API):', {
          id: sample.id,
          user_name: sample.user_name,
          target_amount: sample.target_amount,
          total_progress: sample.total_progress,
          shared_in: sample.shared_in,
          shared_out: sample.shared_out,
          net_amount: sample.net_amount,
          progress_percentage: sample.progress_percentage,
          remaining_amount: sample.remaining_amount,
          status: sample.status
        });
        
        // Verify calculation matches what we expect
        const expectedNetAmount = (parseFloat(sample.total_progress || 0)) + 
                                  (parseFloat(sample.shared_in || 0)) - 
                                  (parseFloat(sample.shared_out || 0));
        const expectedProgress = sample.target_amount > 0 
          ? (expectedNetAmount / sample.target_amount) * 100 
          : 0;
        
        console.log('Calculation verification:', {
          expected_net_amount: expectedNetAmount,
          actual_net_amount: sample.net_amount,
          match: Math.abs(expectedNetAmount - parseFloat(sample.net_amount || 0)) < 0.01,
          expected_progress: expectedProgress.toFixed(2),
          actual_progress: sample.progress_percentage,
          progress_match: Math.abs(expectedProgress - parseFloat(sample.progress_percentage || 0)) < 0.01
        });
      }
      
      // Always update state with new object references (to trigger re-render)
      // Create deep copies to ensure React detects changes
      const updatedTargets = targetsArray.map(target => ({
        ...target,
        net_amount: parseFloat(target.net_amount || 0),
        total_progress: parseFloat(target.total_progress || 0),
        shared_in: parseFloat(target.shared_in || 0),
        shared_out: parseFloat(target.shared_out || 0),
        target_amount: parseFloat(target.target_amount || 0),
        progress_percentage: parseFloat(target.progress_percentage || 0),
        remaining_amount: parseFloat(target.remaining_amount || 0)
      }));
      setTargets(updatedTargets);
    } catch (err) {
      console.error('Error fetching targets:', err);
      console.error('Error response status:', err.response?.status);
      console.error('Error response data:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || 'Failed to load targets';
      setError(errorMessage);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchSharingHistory = async () => {
    try {
      const response = await api.get('/targets/fund-sharing/history');
      setSharingHistory(response.data.sharing_history || []);
    } catch (err) {
      console.error('Error fetching sharing history:', err);
    }
  };

  const fetchTargetProgress = async (targetId) => {
    try {
      const response = await api.get(`/targets/${targetId}/progress`);
      // Handle different response formats
      const progressData = response.data?.progress || response.data || [];
      setTargetProgress(Array.isArray(progressData) ? progressData : []);
    } catch (err) {
      console.error('Error fetching target progress:', err);
      setTargetProgress([]);
    }
  };

  const handleApproveProgress = async (progressId, status) => {
    try {
      console.log(`Approving progress entry ${progressId} with status: ${status}`);
      const response = await api.put(`/targets/progress/${progressId}/approve`, { status });
      
      console.log('Approval response:', response.data);
      
      if (response.data) {
        // Log the returned target data
        if (response.data.target) {
          console.log('Updated target values from approval:', {
            net_amount: response.data.target.net_amount,
            progress_percentage: response.data.target.progress_percentage,
            remaining_amount: response.data.target.remaining_amount,
            total_progress: response.data.target.total_progress
          });
        }
        
        // Update local state immediately if response includes target data
        if (response.data?.target) {
          setTargets(prevTargets => prevTargets.map(target => {
            if (target.id === response.data.target.id) {
              return {
                ...target,
                net_amount: parseFloat(response.data.target.net_amount || 0),
                progress_percentage: parseFloat(response.data.target.progress_percentage || 0).toFixed(2),
                remaining_amount: parseFloat(response.data.target.remaining_amount || 0),
                total_progress: parseFloat(response.data.target.total_progress || target.total_progress || 0)
              };
            }
            return target;
          }));
        }
        
        // Refresh the progress list immediately
        if (selectedTarget) {
          fetchTargetProgress(selectedTarget.id);
        }
        
        // Refresh targets to update net amounts immediately with cache-busting
        fetchTargets(true);
        fetchSharingHistory();
        
        // Also refresh again after delays to ensure database commit
        setTimeout(() => {
          console.log('First refresh after progress approval (500ms delay)...');
          fetchTargets(true);
          fetchSharingHistory();
          if (selectedTarget) {
            fetchTargetProgress(selectedTarget.id);
          }
        }, 500);
        
        setTimeout(() => {
          console.log('Second refresh after progress approval (1500ms delay)...');
          fetchTargets(true);
          fetchSharingHistory();
          if (selectedTarget) {
            fetchTargetProgress(selectedTarget.id);
          }
        }, 1500);
        
        setTimeout(() => {
          console.log('Third refresh after progress approval (3000ms delay - final verification)...');
          fetchTargets(true);
        }, 3000);
        
        // Show success message
        alert(`Progress entry ${status.toLowerCase()} successfully`);
      }
    } catch (err) {
      console.error('Error approving progress:', err);
      console.error('Error response:', err.response?.data);
      alert(err.response?.data?.error || 'Failed to approve progress entry');
    }
  };

  const handleCreateTarget = async (e) => {
    e.preventDefault();
    setError('');

    try {
      console.log('Creating target with form data:', createForm);
      const response = await api.post('/targets', createForm);
      console.log('Target creation response:', response.data);
      
      setShowCreateModal(false);
      setCreateForm({
        user_id: '',
        target_amount: '',
        category: '',
        period_start: new Date().toISOString().split('T')[0],
        period_end: '',
        notes: ''
      });
      
      // If the response includes the target, add it to the list immediately as a temporary measure
      if (response.data?.target) {
        console.log('Adding created target to list temporarily:', response.data.target);
        setTargets(prev => {
          // Check if target already exists (avoid duplicates)
          const exists = prev.some(t => t.id === response.data.target.id);
          if (exists) {
            // Update existing target
            return prev.map(t => t.id === response.data.target.id ? response.data.target : t);
          } else {
            // Add new target at the beginning
            return [response.data.target, ...prev];
          }
        });
      }
      
      // Wait a moment for the backend to commit, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh all data to ensure consistency
      await Promise.all([
        fetchTargets(true),
        fetchSharingHistory()
      ]);
      
      // Emit socket event for real-time update (backend already emits, but this ensures it)
      const socket = getSocket();
      if (socket) {
        socket.emit('target_created');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create target';
      setError(errorMessage);
      console.error('Error creating target:', err);
      console.error('Error response:', err.response?.data);
      
      // If user already has an active target, show helpful message
      if (errorMessage.includes('already has an active target')) {
        // Optionally, we could fetch and show the existing target here
        alert(errorMessage + '\n\nPlease extend or cancel the existing target first, or wait for it to be completed.');
      }
    }
  };

  const handleEditTarget = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.put(`/targets/${selectedTarget.id}`, editForm);
      setShowEditModal(false);
      setSelectedTarget(null);
      // Refresh all data immediately
      await Promise.all([
        fetchTargets(true),
        fetchSharingHistory()
      ]);
      
      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit('target_updated');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update target');
      console.error('Error updating target:', err);
    }
  };

  const handleDeleteTarget = async (targetId) => {
    if (!window.confirm('Are you sure you want to delete this target? This action cannot be undone.')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/targets/${targetId}`);
      
      // Remove from local state immediately
      setTargets(prevTargets => prevTargets.filter(t => t.id !== targetId));
      
      // Refresh after a delay to ensure backend has processed
      setTimeout(() => {
        fetchTargets(true);
        fetchSharingHistory();
      }, 300);
    } catch (error) {
      console.error('Error deleting target:', error);
      setError(error.response?.data?.error || 'Failed to delete target');
    }
  };

  const handleOpenEditModal = (target) => {
    setSelectedTarget(target);
    // Format dates for date input (yyyy-MM-dd format)
    const formatDateForInput = (dateValue) => {
      if (!dateValue) return '';
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      } catch (e) {
        return '';
      }
    };
    
    setEditForm({
      target_amount: target.target_amount || '',
      category: target.category || '',
      period_start: formatDateForInput(target.period_start),
      period_end: formatDateForInput(target.period_end),
      status: target.status || 'Active',
      notes: target.notes || ''
    });
    setShowEditModal(true);
  };

  const handleShareFund = async (e) => {
    e.preventDefault();
    setError('');

    // Validate amount doesn't exceed available
    const shareAmount = parseFloat(shareForm.amount);
    if (shareAmount > availableAmount) {
      setError(`Cannot share more than available amount. Available: $${availableAmount.toFixed(2)}`);
      return;
    }

    try {
      await api.post('/targets/share-fund', shareForm);
      setShowShareModal(false);
      setShareForm({
        to_user_id: '',
        amount: '',
        reason: ''
      });
      setAvailableAmount(0);
      // Refresh all data immediately
      await Promise.all([
        fetchTargets(true),
        fetchSharingHistory()
      ]);
      
      // Emit socket event for real-time update (backend already emits, but this ensures it)
      const socket = getSocket();
      if (socket) {
        socket.emit('fund_shared');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to share fund');
    }
  };

  const handleOpenShareModal = () => {
    // Calculate available amount for current user
    const userTarget = targets.find(t => t.user_id === user.id && t.status === 'Active');
    if (userTarget) {
      const netAmount = parseFloat(userTarget.net_amount || 0);
      const sharedOut = parseFloat(userTarget.shared_out || 0);
      const available = netAmount - sharedOut;
      setAvailableAmount(Math.max(0, available));
    } else {
      setAvailableAmount(0);
    }
    setShowShareModal(true);
  };

  const handleExtendTarget = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post(`/targets/${selectedTarget.id}/extend`, extendForm);
      setShowExtendModal(false);
      setSelectedTarget(null);
      setExtendForm({
        additional_amount: '',
        period_end: ''
      });
      // Refresh all data immediately
      await Promise.all([
        fetchTargets(true),
        fetchSharingHistory()
      ]);
      
      // Emit socket event for real-time update
      const socket = getSocket();
      if (socket) {
        socket.emit('target_created');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extend target');
      console.error('Error extending target:', err);
    }
  };

  const handleReverseSharing = async (sharingId) => {
    if (!window.confirm('Are you sure you want to reverse this fund sharing?')) {
      return;
    }

    try {
      await api.post(`/targets/reverse-sharing/${sharingId}`, {
        reversal_reason: 'Reversed by admin'
      });
      fetchTargets(true);
      fetchSharingHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reverse sharing');
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'success';
    if (percentage >= 75) return 'info';
    if (percentage >= 50) return 'warning';
    return 'danger';
  };

  // Chart data
  const getTargetsChartData = () => {
    if (!targets.length) return null;

    return {
      labels: targets.map(t => t.user_name || 'Unknown User'),
      datasets: [
        {
          label: 'Target Amount',
          data: targets.map(t => t.target_amount || 0),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Net Amount',
          data: targets.map(t => t.net_amount || 0),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }
      ]
    };
  };

  const getProgressChartData = () => {
    if (!targets.length) return null;

    return {
      labels: targets.map(t => t.user_name || 'Unknown User'),
      datasets: [{
        label: 'Progress %',
        data: targets.map(t => parseFloat(t.progress_percentage) || 0),
        backgroundColor: targets.map(t => {
          const pct = parseFloat(t.progress_percentage) || 0;
          if (pct >= 100) return 'rgba(40, 167, 69, 0.6)';
          if (pct >= 75) return 'rgba(23, 162, 184, 0.6)';
          if (pct >= 50) return 'rgba(255, 193, 7, 0.6)';
          return 'rgba(220, 53, 69, 0.6)';
        }),
        borderColor: targets.map(t => {
          const pct = parseFloat(t.progress_percentage) || 0;
          if (pct >= 100) return 'rgba(40, 167, 69, 1)';
          if (pct >= 75) return 'rgba(23, 162, 184, 1)';
          if (pct >= 50) return 'rgba(255, 193, 7, 1)';
          return 'rgba(220, 53, 69, 1)';
        }),
        borderWidth: 1
      }]
    };
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
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
          <div>
            <h3 className="mb-0">Targets Management</h3>
            <p className="text-muted mb-0">Track and manage employee targets and progress</p>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={() => fetchTargets(true)}
              title="Refresh targets"
              disabled={loading}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spinner-border spinner-border-sm' : ''}`}></i>
              {loading ? ' Refreshing...' : ' Refresh'}
            </button>
            {user?.role === 'Admin' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <i className="bi bi-plus-circle me-2"></i>Create Target
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Charts */}
      {targets.length > 0 && (
        <div className="row mb-4">
          <div className="col-md-6 mb-3">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Targets vs Net Amount</h5>
              </div>
              <div className="card-body">
                {getTargetsChartData() && <Bar data={getTargetsChartData()} />}
              </div>
            </div>
          </div>
          <div className="col-md-6 mb-3">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Progress Percentage</h5>
              </div>
              <div className="card-body">
                {getProgressChartData() && <Bar data={getProgressChartData()} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Targets List */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Targets List</h5>
        </div>
        <div className="card-body">
          {targets.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
              <p className="mt-3">No targets found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-dark">
                  <tr>
                    <th>Employee</th>
                    <th>Target Amount</th>
                    <th>Net Amount</th>
                    <th>Progress</th>
                    <th>Remaining</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.id}>
                      <td>
                        <div>
                          <strong>{target.user_name || 'Unknown User'}</strong>
                          <br />
                          <small className="text-muted">{target.user_email || 'No email'}</small>
                        </div>
                      </td>
                      <td>
                        <strong className="text-primary">
                          ${parseFloat(target.target_amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </strong>
                      </td>
                      <td>
                        <strong className="text-success">
                          ${parseFloat(target.net_amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </strong>
                        <br />
                        <small className="text-muted">
                          Progress: ${parseFloat(target.total_progress || 0).toFixed(2)} | 
                          In: ${parseFloat(target.shared_in || 0).toFixed(2)} | 
                          Out: ${parseFloat(target.shared_out || 0).toFixed(2)}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="progress flex-grow-1 me-2" style={{ height: '20px' }}>
                            <div
                              className={`progress-bar bg-${getProgressColor(parseFloat(target.progress_percentage || 0))}`}
                              role="progressbar"
                              style={{
                                width: `${Math.min(100, Math.max(0, parseFloat(target.progress_percentage || 0)))}%`
                              }}
                            >
                              {parseFloat(target.progress_percentage || 0).toFixed(1)}%
                            </div>
                          </div>
                          {parseFloat(target.progress_percentage || 0) > 100 && (
                            <span className="badge bg-success ms-2">Exceeded!</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-muted">
                          ${parseFloat(target.remaining_amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </td>
                      <td>
                        {target.category && (
                          <span className="badge bg-info">{target.category}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${
                          target.status === 'Active' ? 'success' :
                          target.status === 'Completed' ? 'primary' :
                          target.status === 'Extended' ? 'info' : 'secondary'
                        }`}>
                          {target.status}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          {user?.role === 'Admin' && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleOpenEditModal(target)}
                                title="Edit Target"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteTarget(target.id)}
                                title="Delete Target"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                              {target.status === 'Active' && parseFloat(target.progress_percentage || 0) >= 100 && (
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => {
                                    setSelectedTarget(target);
                                    setShowExtendModal(true);
                                  }}
                                  title="Extend Target"
                                >
                                  <i className="bi bi-arrow-up-circle"></i>
                                </button>
                              )}
                            </>
                          )}
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setSelectedTarget(target);
                              fetchTargetProgress(target.id);
                            }}
                            title="View Progress"
                            data-bs-toggle="modal"
                            data-bs-target="#progressModal"
                          >
                            <i className="bi bi-graph-up"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fund Sharing Section */}
      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Share Fund</h5>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleOpenShareModal}
              >
                <i className="bi bi-share me-1"></i>Share
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Share a portion of your earned amount with another employee.
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Fund Sharing History</h5>
            </div>
            <div className="card-body">
              {sharingHistory.length === 0 ? (
                <p className="text-muted">No sharing history</p>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>From</th>
                        <th>To</th>
                        <th>Amount</th>
                        <th>Status</th>
                        {user?.role === 'Admin' && <th>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sharingHistory.map((sharing) => (
                        <tr key={sharing.id}>
                          <td>{sharing.from_user_name}</td>
                          <td>{sharing.to_user_name}</td>
                          <td>
                            ${parseFloat(sharing.amount || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td>
                            <span className={`badge bg-${
                              sharing.status === 'Active' ? 'success' :
                              sharing.status === 'Reversed' ? 'danger' : 'secondary'
                            }`}>
                              {sharing.status}
                            </span>
                          </td>
                          {user?.role === 'Admin' && sharing.status === 'Active' && (
                            <td>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleReverseSharing(sharing.id)}
                                title="Reverse"
                              >
                                <i className="bi bi-arrow-counterclockwise"></i>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Target Modal */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create Target</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={handleCreateTarget}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Employee *</label>
                    <select
                      className="form-select"
                      value={createForm.user_id}
                      onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
                      required
                    >
                      <option value="">Select Employee</option>
                      {users
                        .filter(u => u.role === 'Staff' || u.role === 'DepartmentHead' || u.role === 'Admin')
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email}) - {u.role}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Target Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={createForm.target_amount}
                      onChange={(e) => setCreateForm({ ...createForm, target_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      <option value="Employee">Employee</option>
                      <option value="Client for Consultancy">Client for Consultancy</option>
                      <option value="Client for Audit">Client for Audit</option>
                      <option value="Student">Student</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Period Start *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={createForm.period_start}
                      onChange={(e) => setCreateForm({ ...createForm, period_start: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Period End</label>
                    <input
                      type="date"
                      className="form-control"
                      value={createForm.period_end}
                      onChange={(e) => setCreateForm({ ...createForm, period_end: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Create Target</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Share Fund Modal */}
      {showShareModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Share Fund</h5>
                <button type="button" className="btn-close" onClick={() => setShowShareModal(false)}></button>
              </div>
              <form onSubmit={handleShareFund}>
                <div className="modal-body">
                  {availableAmount > 0 ? (
                    <div className="alert alert-info">
                      <strong>Available Amount:</strong> ${availableAmount.toFixed(2)}
                      <br />
                      <small>You can only share from your achieved target amount.</small>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <strong>No Active Target:</strong> You need an active target with achieved progress to share funds.
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Share With *</label>
                    <select
                      className="form-select"
                      value={shareForm.to_user_id}
                      onChange={(e) => setShareForm({ ...shareForm, to_user_id: e.target.value })}
                      required
                      disabled={availableAmount <= 0}
                    >
                      <option value="">Select Employee</option>
                      {users
                        .filter(u => u.id !== user.id && (u.role === 'Staff' || u.role === 'DepartmentHead' || u.role === 'Admin'))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={availableAmount}
                      className="form-control"
                      value={shareForm.amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > availableAmount) {
                          setError(`Amount cannot exceed available amount: $${availableAmount.toFixed(2)}`);
                        } else {
                          setError('');
                        }
                        setShareForm({ ...shareForm, amount: e.target.value });
                      }}
                      required
                      disabled={availableAmount <= 0}
                    />
                    <small className="text-muted">
                      {availableAmount > 0 
                        ? `Maximum: $${availableAmount.toFixed(2)}` 
                        : 'You need an active target with achieved progress to share funds'}
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={shareForm.reason}
                      onChange={(e) => setShareForm({ ...shareForm, reason: e.target.value })}
                      placeholder="Optional reason for sharing"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowShareModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={availableAmount <= 0}>
                    Share Fund
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Target Modal */}
      {showEditModal && selectedTarget && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Target</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <form onSubmit={handleEditTarget}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Employee</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`${selectedTarget.user_name} (${selectedTarget.user_email})`}
                      disabled
                    />
                  </div>
                  {user?.role === 'Admin' && (
                    <div className="mb-3">
                      <label className="form-label">Target Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control"
                        value={editForm.target_amount}
                        onChange={(e) => setEditForm({ ...editForm, target_amount: e.target.value })}
                        required
                      />
                    </div>
                  )}
                  {user?.role !== 'Admin' && (
                    <div className="mb-3">
                      <label className="form-label">Target Amount</label>
                      <input
                        type="text"
                        className="form-control"
                        value={`$${parseFloat(selectedTarget.target_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        disabled
                      />
                      <small className="text-muted">Only Admin can edit target amount</small>
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      <option value="Employee">Employee</option>
                      <option value="Client for Consultancy">Client for Consultancy</option>
                      <option value="Client for Audit">Client for Audit</option>
                      <option value="Student">Student</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  {user?.role === 'Admin' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Period Start *</label>
                        <input
                          type="date"
                          className="form-control"
                          value={editForm.period_start}
                          onChange={(e) => setEditForm({ ...editForm, period_start: e.target.value })}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Period End</label>
                        <input
                          type="date"
                          className="form-control"
                          value={editForm.period_end}
                          onChange={(e) => setEditForm({ ...editForm, period_end: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  {user?.role !== 'Admin' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Period Start</label>
                        <input
                          type="text"
                          className="form-control"
                          value={selectedTarget.period_start ? new Date(selectedTarget.period_start).toLocaleDateString() : 'N/A'}
                          disabled
                        />
                        <small className="text-muted">Only Admin can edit period dates</small>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Period End</label>
                        <input
                          type="text"
                          className="form-control"
                          value={selectedTarget.period_end ? new Date(selectedTarget.period_end).toLocaleDateString() : 'N/A'}
                          disabled
                        />
                        <small className="text-muted">Only Admin can edit period dates</small>
                      </div>
                    </>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                      <option value="Extended">Extended</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Update Target</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Extend Target Modal */}
      {showExtendModal && selectedTarget && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Extend Target</h5>
                <button type="button" className="btn-close" onClick={() => setShowExtendModal(false)}></button>
              </div>
              <form onSubmit={handleExtendTarget}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Current Target</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`${selectedTarget.user_name || 'Unknown User'} - $${parseFloat(selectedTarget.target_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      disabled
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Additional Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control"
                      value={extendForm.additional_amount}
                      onChange={(e) => setExtendForm({ ...extendForm, additional_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">New Period End</label>
                    <input
                      type="date"
                      className="form-control"
                      value={extendForm.period_end}
                      onChange={(e) => setExtendForm({ ...extendForm, period_end: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowExtendModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Extend Target</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      <div className="modal fade" id="progressModal" tabIndex="-1">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Target Progress History</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              {targetProgress.length === 0 ? (
                <p className="text-muted">No progress history available</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Source</th>
                        {user?.role === 'Admin' && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {targetProgress.map((progress) => (
                        <tr key={progress.id}>
                          <td>{new Date(progress.transaction_date).toLocaleDateString()}</td>
                          <td>
                            ${parseFloat(progress.amount || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </td>
                          <td>{progress.category}</td>
                          <td>
                            <span className={`badge bg-${
                              progress.status === 'Approved' ? 'success' :
                              progress.status === 'Pending' ? 'warning' :
                              progress.status === 'Rejected' ? 'danger' : 'secondary'
                            }`}>
                              {progress.status || 'Pending'}
                            </span>
                          </td>
                          <td>{progress.source_user_name || progress.progress_report_name || 'Manual Entry'}</td>
                          {user?.role === 'Admin' && (
                            <td>
                              {progress.status === 'Pending' && (
                                <div className="btn-group" role="group">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => handleApproveProgress(progress.id, 'Approved')}
                                    title="Approve"
                                  >
                                    <i className="bi bi-check-circle"></i> Approve
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleApproveProgress(progress.id, 'Rejected')}
                                    title="Reject"
                                  >
                                    <i className="bi bi-x-circle"></i> Reject
                                  </button>
                                </div>
                              )}
                              {progress.status === 'Approved' && (
                                <span className="text-success">
                                  <i className="bi bi-check-circle"></i> Approved
                                </span>
                              )}
                              {progress.status === 'Rejected' && (
                                <span className="text-danger">
                                  <i className="bi bi-x-circle"></i> Rejected
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Targets;

