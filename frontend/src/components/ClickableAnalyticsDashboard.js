import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EnhancedGoalCards from './EnhancedGoalCards';
import ActivityFeed from './ActivityFeed';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Clickable Status Tile Component
const ClickableStatusTile = ({ title, value, subtitle, icon, color, status, onClick, loading = false }) => {
  return (
    <div 
      onClick={() => onClick(status)}
      className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-l-4 ${color.border}`}
    >
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${color.bg}`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-gray-600">{title}</p>
              {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </>
          )}
        </div>
        <div className="text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Enhanced Analytics Dashboard with Clickable Tiles
const ClickableAnalyticsDashboard = ({ onBack }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'filtered_goals'

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      const response = await axios.get(`${API}/analytics/dashboard`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setAnalyticsData({
        team_overview: { total_employees: 0, total_goals: 0, active_goals: 0, completed_goals: 0, completion_rate: 0, avg_progress: 0 },
        goal_completion_stats: { total: 0, on_track: 0, at_risk: 0, off_track: 0, on_track_percentage: 0, at_risk_percentage: 0, off_track_percentage: 0 },
        status_distribution: { on_track: 0, at_risk: 0, off_track: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTileClick = (status) => {
    setSelectedStatusFilter(status);
    setViewMode('filtered_goals');
  };

  const handleBackToOverview = () => {
    setSelectedStatusFilter(null);
    setViewMode('overview');
  };

  const handleProgressUpdate = () => {
    // Refresh analytics data after progress update
    fetchAnalyticsData();
  };

  const handleViewDetails = (goal) => {
    // You can implement a detailed goal view here
    console.log('View details for goal:', goal);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const { team_overview, goal_completion_stats, status_distribution } = analyticsData;

  // If viewing filtered goals
  if (viewMode === 'filtered_goals' && selectedStatusFilter) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackToOverview}
                  className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                >
                  <span>←</span>
                  <span>Back to Analytics</span>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {selectedStatusFilter.replace('_', ' ').toUpperCase()} Goals
                  </h1>
                  <p className="text-sm text-gray-600">Filtered goal view</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-700 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </header>

        {/* Filtered Goals Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EnhancedGoalCards
            statusFilter={selectedStatusFilter}
            onProgressUpdate={handleProgressUpdate}
            onViewDetails={handleViewDetails}
          />
        </main>
      </div>
    );
  }

  // Overview mode
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>←</span>
                <span>Back to Dashboard</span>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enhanced Analytics</h1>
                <p className="text-sm text-gray-600">Performance insights with interactive exploration</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Clickable Status Overview Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Goal Status Overview (Click to explore)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ClickableStatusTile
              title="On Track Goals"
              value={goal_completion_stats.on_track}
              subtitle={`${goal_completion_stats.on_track_percentage}% of all goals`}
              status="on_track"
              onClick={handleStatusTileClick}
              color={{
                bg: 'bg-green-100',
                border: 'border-green-500'
              }}
              icon={
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <ClickableStatusTile
              title="At Risk Goals"
              value={goal_completion_stats.at_risk}
              subtitle={`${goal_completion_stats.at_risk_percentage}% of all goals`}
              status="at_risk"
              onClick={handleStatusTileClick}
              color={{
                bg: 'bg-yellow-100',
                border: 'border-yellow-500'
              }}
              icon={
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              }
            />

            <ClickableStatusTile
              title="Off Track Goals"
              value={goal_completion_stats.off_track}
              subtitle={`${goal_completion_stats.off_track_percentage}% of all goals`}
              status="off_track"
              onClick={handleStatusTileClick}
              color={{
                bg: 'bg-red-100',
                border: 'border-red-500'
              }}
              icon={
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Team Overview Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Performance Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM9 9a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{team_overview.total_employees}</p>
                  <p className="text-gray-600">Team Members</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{team_overview.completion_rate}%</p>
                  <p className="text-gray-600">Completion Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{team_overview.active_goals}</p>
                  <p className="text-gray-600">Active Goals</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{team_overview.avg_progress}%</p>
                  <p className="text-gray-600">Avg Progress</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="mb-8">
          <ActivityFeed limit={15} />
        </div>

        {/* Helpful Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 mt-1">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-blue-900 mb-2">Enhanced Analytics Features</h3>
              <ul className="text-blue-700 space-y-1 text-sm">
                <li>• Click on status tiles above to explore goals by their status</li>
                <li>• View recent comments directly on goal cards</li>
                <li>• Real-time activity feed shows team progress updates</li>
                <li>• Get contextual comment prompts when updating goal status</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClickableAnalyticsDashboard;