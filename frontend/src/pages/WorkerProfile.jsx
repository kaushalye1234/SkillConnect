import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { workerAPI, reviewAPI } from '../api';

function Stars({ rating = 0 }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="material-symbols-outlined text-lg" style={{ color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0' }}>star</span>
      ))}
    </span>
  );
}

export default function WorkerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [workerRes, reviewsRes] = await Promise.allSettled([
          workerAPI.getById(id),
          reviewAPI.getForWorker(id),
        ]);
        if (workerRes.status === 'fulfilled') setWorker(workerRes.value?.data?.data);
        if (reviewsRes.status === 'fulfilled') setReviews(reviewsRes.value?.data?.data || []);
      } catch { setError('Failed to load worker profile.'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center py-12"><span className="spinner" /></div>;
  if (error) return <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>;
  if (!worker) return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <span className="material-symbols-outlined text-6xl text-slate-300 mb-3">person_off</span>
      <p className="text-lg font-semibold text-slate-700">Worker not found</p>
    </div>
  );

  return (
    <div className="fade-in space-y-6">
      {/* Back button */}
      <button onClick={() => navigate('/workers')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#13ecec] transition-colors">
        <span className="material-symbols-outlined text-lg">arrow_back</span> Back to Workers
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-[#152a2a] to-[#1e3b3b] relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#13ecec] to-[#0ea5a5] flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
              {(worker.firstName || '?')[0]?.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="pt-14 pb-6 px-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{worker.firstName} {worker.lastName}</h1>
              <p className="text-sm text-slate-500">{worker.district || 'Location not set'}{worker.city ? `, ${worker.city}` : ''}</p>
              <div className="flex items-center gap-3 mt-2">
                <Stars rating={worker.averageRating || 0} />
                <span className="text-sm text-slate-500">({worker.totalJobs || 0} jobs completed)</span>
              </div>
            </div>
            {user?.role === 'customer' && (
              <button onClick={() => navigate('/bookings')}
                className="h-10 px-5 rounded-xl bg-[#13ecec] text-slate-900 font-bold text-sm hover:bg-[#0ea5a5] transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">calendar_today</span> Book Worker
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {worker.bio && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#13ecec]">description</span> About
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">{worker.bio}</p>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#13ecec]">star</span> Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet</p>
            ) : (
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.reviewId || r.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Stars rating={r.overallRating || r.rating} />
                      <span className="text-xs text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="text-sm text-slate-600">{r.reviewText || 'No comment'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Quick Info</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#13ecec]/10 text-[#0ea5a5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">payments</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Hourly Rate</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {worker.hourlyRateMin && worker.hourlyRateMax ? `Rs.${worker.hourlyRateMin} - ${worker.hourlyRateMax}` : 'Not set'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">location_on</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm font-semibold text-slate-900">{worker.district || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">task_alt</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Jobs Completed</p>
                  <p className="text-sm font-semibold text-slate-900">{worker.totalJobs || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-50 text-yellow-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">star</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rating</p>
                  <p className="text-sm font-semibold text-slate-900">{worker.averageRating?.toFixed(1) || '0.0'} / 5.0</p>
                </div>
              </div>
              {worker.isVerified && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">verified</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-600">Verified Worker</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
