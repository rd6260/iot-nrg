import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { StoreProvider } from './lib/store.jsx';
import Layout from './components/Layout.jsx';
import Overview from './pages/Overview.jsx';
import Sensors from './pages/Sensors.jsx';
import Adaptive from './pages/Adaptive.jsx';
import Energy from './pages/Energy.jsx';
import Efficiency from './pages/Efficiency.jsx';
import HistoryPage from './pages/History.jsx';
import Alerts from './pages/Alerts.jsx';
import Device from './pages/Device.jsx';
import SettingsPage from './pages/Settings.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="sensors" element={<Sensors />} />
            <Route path="adaptive" element={<Adaptive />} />
            <Route path="energy" element={<Energy />} />
            <Route path="efficiency" element={<Efficiency />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="device" element={<Device />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);
