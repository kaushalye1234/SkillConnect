import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

export default function CustomerProfilePage() {
    const { id } = useParams();
    const location = useLocation();
    const profile = location.state?.customer || null;

    const fullName = useMemo(() => {
        const first = profile?.firstName || profile?.customer?.firstName || '';
        const last = profile?.lastName || profile?.customer?.lastName || '';
        const value = `${first} ${last}`.trim();
        return value || 'Customer';
    }, [profile]);

    const email = profile?.user?.email || profile?.email || 'Not available';
    const locationText = profile?.location
        || [profile?.city, profile?.district].filter(Boolean).join(', ')
        || profile?.district
        || 'Not specified';
    const avatar = profile?.profilePicture || profile?.avatarUrl || profile?.imageUrl;
    const initials = fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'CU';

    if (!profile) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="mb-4">
                    <Link to="/bookings" className="text-sm font-medium text-cyan-700 hover:text-cyan-600">
                        &larr; Back to Bookings
                    </Link>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <p className="text-base font-semibold text-slate-800">Customer profile data is unavailable.</p>
                    <p className="text-sm text-slate-500 mt-2">
                        Open this page from a booking card to view customer details.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-4">
                <Link to="/bookings" className="text-sm font-medium text-cyan-700 hover:text-cyan-600">
                    &larr; Back to Bookings
                </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-cyan-700 to-cyan-500" />
                <div className="px-6 pb-6">
                    <div className="-mt-10 flex items-end gap-4">
                        {avatar ? (
                            <img
                                src={avatar}
                                alt={fullName}
                                className="h-20 w-20 rounded-full object-cover border-4 border-white shadow"
                            />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-cyan-100 text-cyan-700 text-2xl font-bold border-4 border-white shadow flex items-center justify-center">
                                {initials}
                            </div>
                        )}
                        <div className="pb-1">
                            <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
                            <p className="text-sm text-slate-500">{email}</p>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-1">Location</p>
                            <p className="text-sm font-semibold text-slate-800">{locationText}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-1">Customer ID</p>
                            <p className="text-sm font-semibold text-slate-800">#{profile?.customerId || profile?.id || id}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
