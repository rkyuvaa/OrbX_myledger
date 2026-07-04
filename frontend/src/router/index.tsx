import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { Receive } from '../pages/Receive';
import { Pay } from '../pages/Pay';
import { Transfer } from '../pages/Transfer';
import { Daybook } from '../pages/Daybook';
import { Ledger } from '../pages/Ledger';
import { Reports } from '../pages/Reports';
import { ConfigIndex } from '../pages/Config';
import { Settings } from '../pages/Settings';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard/App routes under AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/pay" element={<Pay />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/daybook" element={<Daybook />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/config" element={<ConfigIndex />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Default Fallbacks */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
