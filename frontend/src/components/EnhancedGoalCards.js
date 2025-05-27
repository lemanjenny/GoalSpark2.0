import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Enhanced Goal Card Component with Comments
const GoalCard = ({ goal, onProgressUpdate, onViewDetails }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      case 'off_track': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 border border-gray-200">
      {/* Goal Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{goal.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{goal.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)} ml-4`}>
          {getStatusIcon(goal.status)} {goal.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {goal.current_value || 0} / {goal.target_value} {goal.unit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              goal.status === 'on_track' ? 'bg-green-500' :
              goal.status === 'at_risk' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(goal.progress_percentage || 0, 100)}%` }}
          ></div>
        </div>
        <div className="text-right mt-1">
          <span className="text-sm font-medium text-gray-700">
            {Math.round(goal.progress_percentage || 0)}%
          </span>
        </div>
      </div>

      {/* Latest Comment Section */}
      {goal.latest_comment && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-medium text-blue-700">Latest Update</span>
            <span className="text-xs text-blue-600">
              {goal.latest_comment_timestamp ? formatTimeAgo(goal.latest_comment_timestamp) : ''}
            </span>
          </div>
          <p className="text-sm text-gray-700 italic line-clamp-2">"{goal.latest_comment}"</p>
          {goal.latest_comment_user && (
            <p className="text-xs text-blue-600 mt-1">— {goal.latest_comment_user}</p>
          )}
        </div>
      )}

      {/* Goal Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Type:</span>
          <span className="ml-2 font-medium capitalize">{goal.goal_type}</span>
        </div>
        <div>
          <span className="text-gray-500">Cycle:</span>
          <span className="ml-2 font-medium capitalize">{goal.cycle_type}</span>
        </div>
        <div>
          <span className="text-gray-500">Due:</span>
          <span className="ml-2 font-medium">{formatDate(goal.end_date)}</span>
        </div>
        <div>
          <span className="text-gray-500">Updated:</span>
          <span className="ml-2 font-medium">
            {goal.last_updated ? formatDate(goal.last_updated) : 'Never'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => onProgressUpdate(goal)}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 text-sm font-medium"
        >
          Update Progress
        </button>
        <button
          onClick={() => onViewDetails(goal)}
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition duration-200 text-sm font-medium"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

// Enhanced Goal List Component with Filtering
const EnhancedGoalCards = ({ statusFilter = null, onProgressUpdate, onViewDetails }) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchGoals();
  }, [statusFilter, refreshTrigger]);

  const fetchGoals = async () => {
    try {
      let url = `${API}/goals?include_comments=true`;
      if (statusFilter) {
        url += `&status_filter=${statusFilter}`;
      }
      
      const response = await axios.get(url);
      setGoals(response.data);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded mb-4"></div>
            <div className="h-3 bg-gray-200 rounded-full mb-4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header with Status Filter Info */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {statusFilter ? `${statusFilter.replace('_', ' ').toUpperCase()} Goals` : 'All Goals'}
          </h2>
          <p className="text-gray-600 mt-1">
            {goals.length} goal{goals.length !== 1 ? 's' : ''} found
            {statusFilter && (
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'on_track' ? 'bg-green-100 text-green-800' :
                statusFilter === 'at_risk' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                Filter: {statusFilter.replace('_', ' ')}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter ? `No ${statusFilter.replace('_', ' ')} goals found` : 'No goals found'}
          </h3>
          <p className="text-gray-600">
            {statusFilter 
              ? `There are currently no goals with ${statusFilter.replace('_', ' ')} status.`
              : 'Create your first goal to get started with tracking your progress.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onProgressUpdate={onProgressUpdate}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedGoalCards;