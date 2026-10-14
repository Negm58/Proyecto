import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Database,
  Download,
  ShieldCheck,
  Clock,
  HardDrive,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  Upload,
  FileUp,
  X,
  AlertTriangle,
} from 'lucide-react';

export const BackupsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState(null); // id o 'file'
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backups/logs');
      if (res.success) setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExecuteBackup = async () => {
    setCreating(true);
    setStatusMsg('');
    try {
      const res = await api.post('/backups/execute');
      if (res.success) {
        setStatusMsg('✅ Respaldo completo generado exitosamente.');
        fetchLogs();
      }
    } catch (err) {
      setStatusMsg('❌ Error generando el respaldo: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // Restaurar respaldo específico seleccionado de la lista
  const handleRestoreSpecific = async (log) => {
    const confirmRestore = window.confirm(
      `⚠️ ATENCIÓN - RECUPERACIÓN DE DATOS:\n\n¿Estás seguro de que deseas cargar y restaurar la copia de seguridad #${log.id} del ${new Date(log.createdAt).toLocaleString()}?\n\nEsta acción reconstruirá todas las tablas (insumos, recetas, lotes, ventas y usuarios) a partir de esta copia de seguridad en caso de que se hayan perdido registros.`
    );
    if (!confirmRestore) return;

    setRestoringId(log.id);
    setStatusMsg('');
    try {
      const res = await api.post(`/backups/restore/${log.id}`);
      if (res.success) {
        setStatusMsg(`✅ ${res.message || 'Copia de seguridad restaurada con éxito.'}`);
        fetchLogs();
      }
    } catch (err) {
      setStatusMsg(`❌ Error restaurando el respaldo #${log.id}: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  };

  // Cargar y restaurar desde archivo JSON local
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json || !json.data) {
          throw new Error('El archivo seleccionado no tiene el formato válido de copia de seguridad del sistema.');
        }

        const confirmRestore = window.confirm(
          `⚠️ ATENCIÓN - RESTAURACIÓN DESDE ARCHIVO EXTERNO:\n\nArchivo: ${file.name}\nFecha de generación: ${json.metadata?.createdAt ? new Date(json.metadata.createdAt).toLocaleString() : 'Desconocida'}\n\n¿Deseas restaurar la base de datos con los registros de este archivo?`
        );
        if (!confirmRestore) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setRestoringId('file');
        setStatusMsg('');
        const res = await api.post('/backups/restore-file', json);
        if (res.success) {
          setStatusMsg(`✅ ${res.message || 'Copia de seguridad cargada y restaurada exitosamente.'}`);
          fetchLogs();
        }
      } catch (err) {
        setStatusMsg(`❌ Error procesando el archivo de respaldo: ${err.message}`);
      } finally {
        setRestoringId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = (id) => {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const url = `${apiUrl}/backups/download/${id}`;
    
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const fileUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = `backup-inventario-${id}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert('Error descargando el archivo: ' + err.message));
  };

  return (
    <div className="page-wrapper">
      {/* Hidden file input for uploading external JSON backup */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json,application/json"
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Copias de Seguridad (Backups)</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Respaldos integrales de la base de datos y cargador de recuperación ante pérdida total de registros.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={restoringId !== null}
            className="btn btn-secondary"
            title="Subir archivo .json de respaldo guardado en tu equipo y restaurar"
          >
            <Upload size={17} />
            {restoringId === 'file' ? 'Restaurando Archivo...' : 'Cargar Copia desde Archivo (.json)'}
          </button>

          <button
            onClick={handleExecuteBackup}
            disabled={creating}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.25rem' }}
          >
            <HardDrive size={18} />
            {creating ? 'Generando Copia...' : 'Generar Respaldo Manual'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: statusMsg.startsWith('✅') ? 'var(--success-bg)' : 'var(--danger-bg)',
            border: `1px solid ${statusMsg.startsWith('✅') ? 'var(--success-border)' : 'var(--danger-border)'}`,
            marginBottom: '1.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{statusMsg}</span>
          <button
            onClick={() => setStatusMsg('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Info card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, var(--primary-50) 0%, #FFFFFF 100%)',
          borderLeft: '4px solid var(--primary-500)',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <ShieldCheck size={22} color="var(--primary-600)" />
          <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>Recuperación Ante Desastres &amp; Respaldo de Emergencia</h4>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Cada archivo de respaldo incluye la integridad total de materias primas, lotes FIFO, recetas, historial de ventas, mermas registradas y cuentas de usuarios con sus roles y credenciales.
          Si por algún motivo se pierden o corrompen los registros, puedes utilizar el botón <strong>"Cargar / Restaurar Copia"</strong> de la lista o subir un archivo descargado previamente.
        </p>
      </div>

      {/* Logs Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Historial de Respaldos Realizados</h3>
          <button onClick={fetchLogs} className="btn btn-sm btn-secondary">
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha y Hora</th>
                <th>Tipo</th>
                <th>Usuario</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones Disponibles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem' }}>Cargando registros de respaldos...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No se han generado respaldos todavía. Haz clic en "Generar Respaldo Manual".
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isRestoringThis = restoringId === log.id;
                  const isRestoreLog = log.backupType === 'RESTORE';

                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 700 }}>#{log.id}</td>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${isRestoreLog ? 'badge-warning' : 'badge-primary'}`}>
                          {log.backupType}
                        </span>
                      </td>
                      <td>{log.user?.name || (isRestoreLog ? 'Administrador' : 'Sistema')}</td>
                      <td>
                        <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                          {log.status === 'SUCCESS' ? 'EXITOSO' : 'FALLIDO'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {log.status === 'SUCCESS' && !isRestoreLog && (
                            <>
                              <button
                                onClick={() => handleRestoreSpecific(log)}
                                disabled={restoringId !== null}
                                className="btn btn-sm btn-primary"
                                title="Cargar y restaurar esta copia específica en caso de pérdida de registros"
                                style={{ fontWeight: 700 }}
                              >
                                <RotateCcw size={14} />
                                {isRestoringThis ? 'Restaurando...' : 'Cargar / Restaurar Copia'}
                              </button>

                              <button
                                onClick={() => handleDownload(log.id)}
                                className="btn btn-sm btn-secondary"
                                title="Descargar archivo JSON a tu computadora"
                              >
                                <Download size={14} /> Descargar JSON
                              </button>
                            </>
                          )}
                          {isRestoreLog && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Registro de restauración ({log.fileSize || 'completada'})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
