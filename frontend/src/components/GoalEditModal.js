import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const GoalEditModal = ({ isOpen, onClose, goal, onGoalUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_type: 'target',
    target_value: '',
    comparison: 'greater_than',
    unit: '',
    cycle_type: 'monthly',
    start_date: '',
    end_date: '',
    assigned_to: [],
    assigned_to_role: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);

  useEffect(() => {
    if (isOpen && goal) {
      // Pre-populate form with existing goal data
      setFormData({
        title: goal.title || '',
        description: goal.description || '',
        goal_type: goal.goal_type || 'target',
        target_value: goal.target_value || '',
        comparison: goal.comparison || 'greater_than',
        unit: goal.unit || '',
        cycle_type: goal.cycle_type || 'monthly',
        start_date: goal.start_date ? goal.start_date.split('T')[0] : '',
        end_date: goal.end_date ? goal.end_date.split('T')[0] : '',
        assigned_to: goal.assigned_to || [],
        assigned_to_role: goal.assigned_to_role || ''
      });
      
      fetchUsers();
    }
  }, [isOpen, goal]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/team`);
      setUsers(response.data);
      
      // Extract unique custom roles
      const roles = [...new Set(response.data.map(user => user.custom_role).filter(Boolean))];
      setCustomRoles(roles);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'assigned_to') {
      const userId = value;
      setFormData(prev => ({
        ...prev,
        assigned_to: checked 
          ? [...prev.assigned_to, userId]
          : prev.assigned_to.filter(id => id !== userId)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Prepare the data for submission
      const submitData = {
        title: formData.title,
        description: formData.description,
        goal_type: formData.goal_type,
        target_value: parseFloat(formData.target_value),
        comparison: formData.comparison,
        unit: formData.unit,
        cycle_type: formData.cycle_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        assigned_to: formData.assigned_to,
        assigned_to_role: formData.assigned_to_role || null
      };

      const response = await axios.put(`${API}/goals/${goal.id}`, submitData);
      
      console.log('Goal updated successfully:', response.data);
      onGoalUpdated();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        goal_type: 'target',
        target_value: '',
        comparison: 'greater_than',
        unit: '',
        cycle_type: 'monthly',
        start_date: '',
        end_date: '',
        assigned_to: [],
        assigned_to_role: ''
      });
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to update goal');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !goal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Goal</h2>
              <p className="text-gray-600 mt-1">Modify goal details and recalculate progress</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Current Progress Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Current Progress</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Current Value:</span>
                <span className="ml-2 font-medium">{goal.current_value || 0} {goal.unit}</span>
              </div>
              <div>
                <span className="text-blue-700">Target Value:</span>
                <span className="ml-2 font-medium">{goal.target_value} {goal.unit}</span>
              </div>
              <div>
                <span className="text-blue-700">Progress:</span>
                <span className="ml-2 font-medium">{Math.round(goal.progress_percentage || 0)}%</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Type
                </label>
                <select
                  name="goal_type"
                  value={formData.goal_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="target">Target</option>
                  <option value="percentage">Percentage</option>
                  <option value="revenue">Revenue</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Target Value and Comparison Logic */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Value
                </label>
                <input
                  type="number"
                  name="target_value"
                  value={formData.target_value}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Logic
                </label>
                <select
                  name="comparison"
                  value={formData.comparison}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="greater_than">Greater Than (≥)</option>
                  <option value="less_than">Less Than (≤)</option>
                  <option value="equal_to">Equal To (=)</option>
                </select>
              </div>
            </div>

            {/* Unit and Cycle Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  placeholder="e.g., sales, %, dollars"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cycle Type
                </label>
                <select
                  name="cycle_type"
                  value={formData.cycle_type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Assignment Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assignment Options
              </label>
              
              {/* Role-based Assignment */}
              {customRoles.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Assign by Role
                  </label>
                  <select
                    name="assigned_to_role"
                    value={formData.assigned_to_role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a role (optional)</option>
                    {customRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Individual Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Assign to Individuals
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                  {users.map(user => (
                    <label key={user.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="assigned_to"
                        value={user.id}
                        checked={formData.assigned_to.includes(user.id)}
                        onChange={handleChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        {user.first_name} {user.last_name}
                        {user.custom_role && (
                          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {user.custom_role}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
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
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition duration-200 disabled:opacity-50 font-medium"
              >
                {loading ? 'Updating Goal...' : 'Update Goal & Recalculate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GoalEditModal;