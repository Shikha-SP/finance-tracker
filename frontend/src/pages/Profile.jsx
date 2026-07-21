import { useState } from 'react';
import { User, Lock, Upload, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  const [name, setName] = useState(localStorage.getItem('userName') || '');
  const [email, setEmail] = useState(localStorage.getItem('userEmail') || '');
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result); // Save as base64
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');

      const res = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, profilePic })
      });

      if (res.ok) {
        localStorage.setItem('userName', name);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('profilePic', profilePic);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/login');

      const res = await fetch('http://localhost:5000/api/users/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setPwdSaved(true);
        setTimeout(() => setPwdSaved(false), 2000);
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Error changing password');
      }
    } catch (err) {
      setErrorMsg('Server error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Profile Info */}
        <div className="panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} /> Personal Information
          </h2>
          
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {profilePic ? (
                  <img src={profilePic} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={30} color="var(--text-muted)" />
                )}
              </div>
              <div>
                <label className="btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                  <Upload size={14} /> Upload Picture
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Display Name</label>
              <input
                type="text"
                className="settings-input"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Email Address</label>
              <input
                type="email"
                className="settings-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {profileSaved ? <><Check size={16}/> Saved</> : 'Update Profile'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="panel">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} /> Change Password
          </h2>
          
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMsg && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}>{errorMsg}</div>}
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Current Password</label>
              <input
                type="password"
                className="settings-input"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>New Password</label>
              <input
                type="password"
                className="settings-input"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {pwdSaved ? <><Check size={16}/> Changed</> : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
