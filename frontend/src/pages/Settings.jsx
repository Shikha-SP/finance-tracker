import { useState, useEffect } from 'react';
import { useTx } from '../context/TxContext';
import { Moon, Sun, Trash2, Check, Bell } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme, clearAllData } = useTx();
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/users/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            if (data.notifications) {
              setEmailAlerts(data.notifications.emailAlerts ?? true);
              setPushNotifications(data.notifications.pushNotifications ?? false);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleClearData = () => {
    if (confirmClear) {
      clearAllData?.();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/users/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            theme,
            notifications: { emailAlerts, pushNotifications }
          })
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        {/* Appearance */}
        <div className="settings-section" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Appearance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: '500' }}>Theme Preference</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Toggle between light and dark mode.</p>
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} /> Notifications
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <p style={{ fontWeight: '500' }}>Email Alerts</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Receive email updates about your budget limits.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={emailAlerts} onChange={e => setEmailAlerts(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: '500' }}>Push Notifications</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Receive push notifications on this device.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={pushNotifications} onChange={e => setPushNotifications(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-section settings-section--danger">
          <h2 style={{ fontSize: '1.1rem', color: 'var(--danger)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={18} /> Danger Zone
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: '500' }}>Clear all data</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Permanently delete all transactions and budget limits.</p>
            </div>
            <button
              className={`settings-danger-btn${confirmClear ? ' is-confirm' : ''}`}
              onClick={handleClearData}
              style={{ backgroundColor: confirmClear ? 'var(--danger)' : 'transparent', color: confirmClear ? '#fff' : 'var(--danger)', border: '1px solid var(--danger)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
            >
              {confirmClear ? 'Confirm?' : 'Clear Data'}
            </button>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saved ? <><Check size={16}/> Saved</> : 'Save Settings'}
          </button>
        </div>

      </div>

      <style>{`
        .switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: .4s;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
        }
        input:checked + .slider {
          background-color: var(--primary);
        }
        input:checked + .slider:before {
          transform: translateX(20px);
        }
        .slider.round {
          border-radius: 20px;
        }
        .slider.round:before {
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
