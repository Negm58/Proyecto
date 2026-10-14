import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Check,
  X,
  Lock,
  Mail,
  User,
  Trash2,
  Key,
  UserX,
} from 'lucide-react';

export const UsersPage = () => {
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal create user
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal assign roles
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [currentUserForRoles, setCurrentUserForRoles] = useState(null);
  const [userRoleIds, setUserRoleIds] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
      ]);

      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      await api.post('/users', {
        name: newName,
        email: newEmail,
        password: newPassword,
        roleIds: selectedRoleIds,
      });

      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setSelectedRoleIds([]);
      fetchData();
    } catch (err) {
      setErrorMsg(err.message || 'Error creando usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async (e) => {
    e.preventDefault();
    if (!currentUserForRoles) return;
    setSaving(true);

    try {
      await api.put(`/users/${currentUserForRoles.id}/roles`, {
        roleIds: userRoleIds,
      });
      setShowRoleModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('¿Seguro que deseas desactivar este usuario?')) return;
    try {
      await api.delete(`/users/${userId}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePermanent = async (u) => {
    if (u.id === currentUser?.id) {
      alert('No puedes eliminar tu propia cuenta de administrador.');
      return;
    }
    const confirmDelete = window.confirm(
      `⚠️ ATENCIÓN: ¿Confirmas la ELIMINACIÓN PERMANENTE del usuario "${u.name}" (${u.email})?\n\nEsta acción borrará la cuenta de la base de datos de manera definitiva. No se puede deshacer.`
    );
    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/users/${u.id}/permanent`);
      alert(res.message || 'Usuario eliminado permanentemente.');
      fetchData();
    } catch (err) {
      alert(`Error eliminando el usuario: ${err.message}`);
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Gestión de Usuarios & Roles (RBAC)</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Control de acceso granular por módulos y acciones (Admin, Gerente, Cajero, Visualizador).
          </p>
        </div>

        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <UserPlus size={17} /> Crear Nuevo Usuario
        </button>
      </div>

      {/* Users Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>Usuarios Registrados</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo Electrónico</th>
                <th>Roles Asignados</th>
                <th>Estado</th>
                <th>Fecha Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Cargando usuarios...</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{u.name}</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {u.id.slice(0, 8)}...</span>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {u.roles?.map((r, idx) => (
                          <span
                            key={idx}
                            className={`badge ${r === 'ADMIN' ? 'badge-primary' : 'badge-warning'}`}
                          >
                            <Shield size={11} /> {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {u.isActive ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => {
                            setCurrentUserForRoles(u);
                            const currentIds = roles
                              .filter((r) => u.roles?.includes(r.name))
                              .map((r) => r.id);
                            setUserRoleIds(currentIds);
                            setShowRoleModal(true);
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          <Key size={14} /> Asignar Roles
                        </button>
                        {u.isActive && (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="btn btn-sm btn-secondary"
                            title="Desactivar usuario (acceso restringido)"
                          >
                            <Trash2 size={14} /> Desactivar
                          </button>
                        )}
                        {isAdmin && u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeletePermanent(u)}
                            className="btn btn-sm btn-danger"
                            title="Eliminar usuario permanentemente de la base de datos (Solo Administrador)"
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: 'var(--danger)',
                              borderColor: 'var(--danger)',
                              fontWeight: 700,
                            }}
                          >
                            <Trash2 size={14} /> Eliminar Permanente
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Matriz de Permisos por Rol</h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Configuración predefinida de permisos y alcance operativo según el esquema de seguridad del restaurante.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {roles.map((role) => (
            <div
              key={role.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-main)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShieldCheck size={20} color="var(--primary-600)" />
                <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{role.name}</h4>
              </div>
              <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {role.description}
              </p>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                {role.rolePermissions?.length || 0} permisos asignados
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Crear Usuario */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Crear Usuario Secundario</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)' }}>
                    {errorMsg}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mariana Gómez"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    placeholder="cajero@restaurante.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña Temporal *</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Roles a Asignar</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {roles.map((r) => (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoleIds([...selectedRoleIds, r.id]);
                            } else {
                              setSelectedRoleIds(selectedRoleIds.filter((id) => id !== r.id));
                            }
                          }}
                        />
                        <span style={{ fontWeight: 600 }}>{r.name}</span> — <span style={{ color: 'var(--text-muted)' }}>{r.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar Roles */}
      {showRoleModal && currentUserForRoles && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                Asignar Roles: {currentUserForRoles.name}
              </h3>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRoles}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {roles.map((r) => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userRoleIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setUserRoleIds([...userRoleIds, r.id]);
                          } else {
                            setUserRoleIds(userRoleIds.filter((id) => id !== r.id));
                          }
                        }}
                      />
                      <span style={{ fontWeight: 700 }}>{r.name}</span>: {r.description}
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowRoleModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Guardando...' : 'Guardar Roles'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
