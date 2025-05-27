import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EnhancedProgressModal = ({ isOpen, onClose, goal, onProgressUpdated }) => {
  const [formData, setFormData] = useState({
    progress_value: '',
    status: 'on_track',
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commentPrompt, setCommentPrompt] = useState('');
  const [promptContext, setPromptContext] = useState(null);

  useEffect(() => {
    if (isOpen && goal) {
      // Initialize form with current goal data
      setFormData({
        progress_value: goal.current_value || 0,
        status: goal.status || 'on_track',
        comment: ''
      });
      
      // Fetch contextual comment prompt
      fetchCommentPrompt(goal.status || 'on_track');
    }
  }, [isOpen, goal]);

  useEffect(() => {
    // Update comment prompt when status changes
    if (formData.status && goal) {
      fetchCommentPrompt(formData.status);
    }
  }, [formData.status, goal]);

  const fetchCommentPrompt = async (status) => {
    if (!goal) return;
    
    try {
      const response = await axios.get(`${API}/goals/${goal.id}/comment-prompt?status=${status}`);
      setCommentPrompt(response.data.prompt);
      setPromptContext(response.data.additional_context);
    } catch (error) {
      console.error('Error fetching comment prompt:', error);
      setCommentPrompt('Please share an update on your progress.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/goals/${goal.id}/progress`, {
        new_value: parseFloat(formData.progress_value),
        status: formData.status,
        comment: formData.comment || null
      });

      onProgressUpdated();
      onClose();
      
      // Reset form
      setFormData({
        progress_value: '',
        status: 'on_track',
        comment: ''
      });
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_track': return 'text-green-600';
      case 'at_risk': return 'text-yellow-600';
      case 'off_track': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'on_track': return '🟢';
      case 'at_risk': return '🟡';
      case 'off_track': return '🔴';
      default: return '⚪';
    }
  };

  const calculateProgress = () => {
    if (!goal || !formData.progress_value) return 0;
    return Math.min((parseFloat(formData.progress_value) / goal.target_value) * 100, 100);
  };

  if (!isOpen || !goal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Update Progress</h2>
              <p className="text-gray-600 mt-1">{goal.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Goal Overview */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Current Progress:</span>
                <span className="ml-2 font-medium">{goal.current_value || 0} / {goal.target_value} {goal.unit}</span>
              </div>
              <div>
                <span className="text-gray-500">Current Status:</span>
                <span className={`ml-2 font-medium ${getStatusColor(goal.status)}`}>
                  {getStatusIcon(goal.status)} {goal.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {promptContext && (
                <>
                  <div>
                    <span className="text-gray-500">Due Date:</span>
                    <span className="ml-2 font-medium">{promptContext.time_remaining}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Completion:</span>
                    <span className="ml-2 font-medium">{Math.round(promptContext.progress_percentage)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Progress Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Progress Value
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  name="progress_value"
                  value={formData.progress_value}
                  onChange={handleChange}
                  min="0"
                  max={goal.target_value * 1.5} // Allow some overage
                  step="0.01"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-gray-600 font-medium">/ {goal.target_value} {goal.unit}</span>
              </div>
              
              {/* Progress Visualization */}
              <div className="mt-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(calculateProgress())}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(calculateProgress(), 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Goal Status
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'on_track', label: 'On Track', icon: '🟢', description: 'Meeting expectations' },
                  { value: 'at_risk', label: 'At Risk', icon: '🟡', description: 'May need support' },
                  { value: 'off_track', label: 'Off Track', icon: '🔴', description: 'Behind schedule' }
                ].map((status) => (
                  <label
                    key={status.value}
                    className={`relative block p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.status === status.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={status.value}
                      checked={formData.status === status.value}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="text-2xl mb-1">{status.icon}</div>
                      <div className="font-medium text-gray-900">{status.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{status.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Enhanced Comment Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Update Comment
                {(formData.status === 'at_risk' || formData.status === 'off_track') && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              
              {/* Contextual Prompt */}
              {commentPrompt && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start space-x-2">
                    <div className="text-blue-500 mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-blue-700 font-medium">Suggested prompt:</p>
                      <p className="text-sm text-blue-600 italic">"{commentPrompt}"</p>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                name="comment"
                value={formData.comment}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={commentPrompt || "Share an update on your progress..."}
                required={formData.status === 'at_risk' || formData.status === 'off_track'}
              />
              
              {(formData.status === 'at_risk' || formData.status === 'off_track') && (
                <p className="text-sm text-red-600 mt-1">
                  A comment is required for at-risk and off-track goals.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50 font-medium"
              >
                {loading ? 'Updating...' : 'Update Progress'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProgressModal;