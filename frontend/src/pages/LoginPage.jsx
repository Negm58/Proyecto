import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Flame,
  Lock,
  Mail,
  User,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
  Users,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

// Edge/IE ya muestran su propio ícono nativo para revelar la contraseña al escribir.
// En esos navegadores no se dibuja el botón personalizado para evitar dos indicadores.
const HAS_NATIVE_REVEAL = typeof navigator !== 'undefined' && /Edg\/|Edge\/|Trident\//.test(navigator.userAgent);

export const LoginPage = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isRecover, setIsRecover] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Recovery State
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: Search, 2: Reset Form, 3: Profile Picker
  const [recoveredUser, setRecoveredUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [masterPin, setMasterPin] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showMasterPinInput, setShowMasterPinInput] = useState(false);

  // Available profiles list
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // UI status
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchProfiles = async () => {
    resetMessages();
    setLoadingProfiles(true);
    try {
      const res = await api.get('/auth/profiles');
      if (res.success && res.data) {
        setAvailableProfiles(res.data);
        setRecoveryStep(3); // Switch to profile picker view
      }
    } catch (err) {
      setError('No se pudieron obtener los perfiles registrados.');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSelectProfile = (profile) => {
    setRecoveredUser(profile);
    setRecoveryIdentifier(profile.email);
    setRecoveryStep(2);
    setSuccessMsg(`Perfil seleccionado: ${profile.name} (${profile.email}). Ingresa tu nueva contraseña.`);
  };

  const handleCheckIdentifier = async (e) => {
    e.preventDefault();
    resetMessages();
    if (!recoveryIdentifier || recoveryIdentifier.trim() === '') {
      setError('Por favor ingresa tu correo electrónico o tu nombre de usuario.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/recover', { identifier: recoveryIdentifier });
      if (res.success && res.data) {
        setRecoveredUser(res.data);
        setRecoveryStep(2);
        setSuccessMsg(`¡Cuenta encontrada! Hola, ${res.data.name}. Define tu nueva contraseña.`);
      }
    } catch (err) {
      setError(err.message || 'No encontramos ninguna cuenta con esos datos. Prueba con "Ver perfiles disponibles".');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: recoveredUser.email,
        newPassword,
        masterPin: masterPin.trim() || undefined,
      });

      setSuccessMsg(res.message || '¡Contraseña restablecida con éxito!');

      // Si el servidor nos devolvió token y usuario, iniciar sesión automáticamente
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setTimeout(() => {
          setIsRecover(false);
          setRecoveryStep(1);
          setEmail(recoveredUser.email);
          setPassword(newPassword);
        }, 1800);
      }
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141210',
        backgroundImage: `radial-gradient(circle at 50% 15%, rgba(249, 115, 22, 0.18) 0%, transparent 60%),
                          radial-gradient(circle at 80% 85%, rgba(234, 88, 12, 0.1) 0%, transparent 50%)`,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isRecover && recoveryStep === 3 ? '520px' : '440px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              margin: '0 auto 1rem',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.45)',
            }}
          >
            {isRecover ? <KeyRound size={34} color="#FFF" /> : <Flame size={38} color="#FFF" />}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {isRecover
              ? 'Recuperar Acceso'
              : isRegister
              ? 'Crear Perfil'
              : 'Iniciar Sesión'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>
            Pollos La Llovizna — Sistema de Gestión
          </p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              lineHeight: 1.4,
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Mensaje de Éxito */}
        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              color: '#047857',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* SECCIÓN DE RECUPERACIÓN DE CONTRASEÑA O PERFIL */}
        {/* ============================================================== */}
        {isRecover ? (
          <div>
            {/* PASO 1: BÚSQUEDA POR CORREO O NOMBRE */}
            {recoveryStep === 1 && (
              <form onSubmit={handleCheckIdentifier}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', textAlign: 'center' }}>
                  Ingresa tu correo o tu nombre para localizar tu cuenta y restablecer tu clave.
                </p>

                <div className="form-group">
                  <label className="form-label">Correo Electrónico o Nombre de Usuario</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      placeholder="admin@polloslallovizna.com o Administrador"
                      value={recoveryIdentifier}
                      onChange={(e) => setRecoveryIdentifier(e.target.value)}
                      className="form-control"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    <Mail size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', marginTop: '0.5rem' }}
                >
                  {loading ? 'Buscando cuenta...' : 'Buscar Mi Cuenta'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleFetchProfiles}
                    disabled={loadingProfiles}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      textDecoration: 'underline',
                    }}
                  >
                    <Users size={15} /> ¿No recuerdas tus datos? Ver perfiles registrados
                  </button>
                </div>
              </form>
            )}

            {/* PASO 2: ASIGNACIÓN DE NUEVA CLAVE */}
            {recoveryStep === 2 && (
              <form onSubmit={handleResetPassword}>
                <div
                  style={{
                    backgroundColor: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    color: '#C2410C',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: '0.2rem' }}>👤 Perfil Localizado:</div>
                  <div><strong>Nombre:</strong> {recoveredUser?.name}</div>
                  <div><strong>Correo:</strong> {recoveredUser?.email}</div>
                  <div><strong>Roles:</strong> {recoveredUser?.roles?.join(', ') || 'Usuario'}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nueva Contraseña (mínimo 6 caracteres)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-control"
                      style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    />
                    <Lock size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
                    {!HAS_NATIVE_REVEAL && newPassword && (
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                          position: 'absolute',
                          right: '0.85rem',
                          top: '0.75rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-light)',
                          cursor: 'pointer',
                        }}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirmar Nueva Contraseña</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Repite la clave"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-control"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                    <Lock size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
                  </div>
                </div>

                {showMasterPinInput ? (
                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--primary-700)' }}>
                      PIN Maestro de Emergencia (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="LLOVIZNA2026"
                      value={masterPin}
                      onChange={(e) => setMasterPin(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowMasterPinInput(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer' }}
                    >
                      + Usar PIN maestro de rescate
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', marginTop: '0.5rem' }}
                >
                  {loading ? 'Restableciendo clave...' : 'Guardar y Entrar al Sistema'}
                </button>
              </form>
            )}

            {/* PASO 3: SELECTOR DE PERFILES REGISTRADOS */}
            {recoveryStep === 3 && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                  Selecciona la cuenta que deseas recuperar para restablecer su contraseña:
                </p>

                {availableProfiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No hay cuentas registradas en este equipo. Puedes crear una nueva cuenta administradora en la pantalla de registro.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '0.25rem' }}>
                    {availableProfiles.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProfile(p)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#FFF',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary-500)';
                          e.currentTarget.style.backgroundColor = '#FFF7ED';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.backgroundColor = '#FFF';
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.email}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                            {p.roles?.join(', ') || 'ADMIN'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary-600)', fontWeight: 700 }}>Elegir →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BOTÓN REGRESAR */}
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (recoveryStep > 1) {
                    setRecoveryStep(1);
                  } else {
                    setIsRecover(false);
                    resetMessages();
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 600,
                }}
              >
                <ArrowLeft size={16} /> {recoveryStep > 1 ? 'Volver a buscar' : 'Volver a Iniciar Sesión'}
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* MODO LOGIN Y REGISTRO NORMAL */
          /* ============================================================== */
          <form onSubmit={handleAuthSubmit}>
            {isRegister && (
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Administrador General"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  <User size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Correo Electrónico *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="admin@polloslallovizna.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Mail size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                <Lock size={18} color="var(--text-light)" style={{ position: 'absolute', left: '0.85rem', top: '0.75rem' }} />
                {!HAS_NATIVE_REVEAL && password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '0.75rem',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
              {!isRegister && (
                <div style={{ textAlign: 'right', marginTop: '0.45rem' }}>
                  <button
                    id="btn-forgot-password"
                    type="button"
                    onClick={() => {
                      setIsRecover(true);
                      setRecoveryStep(1);
                      resetMessages();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ¿Olvidaste tu contraseña o usuario?
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}
            >
              {loading ? 'Accediendo...' : isRegister ? 'Registrar Perfil Administrador' : 'Entrar al Sistema'}
            </button>
          </form>
        )}

        {/* PIE DE FORMULARIO: REGISTRO / LOGIN */}
        {!isRecover && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isRegister ? '¿Ya tienes una cuenta?' : '¿Primer acceso o nuevo usuario?'}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  resetMessages();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginLeft: '0.4rem',
                  textDecoration: 'underline',
                }}
              >
                {isRegister ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
