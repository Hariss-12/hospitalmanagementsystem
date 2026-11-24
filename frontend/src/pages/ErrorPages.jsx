import React from 'react';
import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm space-y-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-700 font-bold text-lg">
        403
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Unauthorized Role Access (HTTP 403)</h1>
      <p className="text-sm text-slate-600">
        Your current account role does not have permission to access this protected hospital module.
        Role-based access control (RBAC) is strictly enforced on both frontend routes and backend APIs.
      </p>
      <Link
        to="/"
        className="inline-block px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
      >
        Return to Home
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-4">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-bold text-lg">
        404
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Page Not Found (HTTP 404)</h1>
      <p className="text-sm text-slate-600">
        The requested hospital route does not exist. Please check the URL or return to your dashboard.
      </p>
      <Link
        to="/"
        className="inline-block px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
      >
        Return to Home
      </Link>
    </div>
  );
}

export default NotFoundPage;
