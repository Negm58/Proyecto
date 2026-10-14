import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Trash2,
  Loader2,
  Settings,
  Key,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';

export const AiAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy **PolloBot**, tu Asistente de Operaciones de **Pollos La Llovizna**.\n\nTengo acceso en tiempo real a:\n- 📦 Stock de insumos y almacén (pollo, papas, carbón, aceite...)\n- 🚨 Alertas de desabastecimiento y sugerencias de compra\n- ⏳ Fechas de caducidad y lotes FIFO\n- 📋 Recetas, costos de producción y política de margen máx 30%\n- 💰 Ventas del día y platos más vendidos\n\n¿En qué te asisto hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState({ geminiConfigured: false, activeEngine: 'Motor Analítico Local Dinámico' });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const messagesEndRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/ai/status');
      if (res.success && res.data) {
        setAiStatus(res.data);
      }
    } catch (err) {
      console.error('Error obteniendo estado de IA:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    '🍗 Stock actual de Pollo y Papas',
    '🚨 Insumos con stock bajo y pedido sugerido',
    '⏳ ¿Hay lotes próximos a vencer?',
    '📊 Verificar margen máximo 30% en platos',
    '💰 Resumen de ventas de hoy',
  ];

  const handleSend = async (messageText) => {
    const textToSend = messageText || input;
    if (!textToSend || textToSend.trim() === '') return;

    const userMsg = { role: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { message: textToSend });
      if (res.success && res.data) {
        setMessages((prev) => [...prev, { role: 'assistant', text: res.data.message }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Ocurrió un error al procesar tu consulta. Verifica la conexión con el servidor de Pollos La Llovizna.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await api.delete('/ai/history');
      setMessages([
        {
          role: 'assistant',
          text: 'Historial reiniciado. Pregúntame sobre el stock de insumos, costos de platos, recetas o ventas en vivo.',
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    setSavingKey(true);
    setConfigSuccess('');
    try {
      const res = await api.post('/ai/config', { apiKey: newApiKey });
      if (res.success) {
        setConfigSuccess(res.message);
        fetchStatus();
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigSuccess('');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingKey(false);
    }
  };

  const renderFormattedText = (text) => {
    // Convierte **texto** en <strong>texto</strong> y divide en líneas
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={idx} style={{ minHeight: line.trim() === '' ? '0.5rem' : 'auto' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </div>
      );
    });
  };

  return (
    <>
      {/* Botón flotante para abrir chat */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            backgroundColor: 'var(--primary-500)',
            color: '#FFF',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            padding: '0.85rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            boxShadow: '0 10px 28px rgba(249, 115, 22, 0.45)',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.95rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <Bot size={22} />
          <span>PolloBot IA</span>
          <span
            style={{
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 900,
            }}
          >
            EN VIVO
          </span>
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '440px',
            height: '630px',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Cabecera */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)',
                }}
              >
                <Bot size={22} color="#FFF" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFF' }}>PolloBot</h4>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: aiStatus.geminiConfigured ? 'rgba(34, 197, 94, 0.25)' : 'rgba(168, 85, 247, 0.25)',
                      color: aiStatus.geminiConfigured ? '#4ADE80' : '#C084FC',
                      border: `1px solid ${aiStatus.geminiConfigured ? '#22C55E' : '#A855F7'}`,
                    }}
                  >
                    {aiStatus.geminiConfigured ? 'Gemini IA 🟢' : 'Motor Analítico 🟣'}
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                  Pollos La Llovizna — Análisis en Tiempo Real
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => setShowConfigModal(true)}
                title="Configurar IA / Gemini Key"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.75)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleClearHistory}
                title="Reiniciar chat"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.75)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <Trash2 size={17} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.85)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal de Configuración de API Key */}
          {showConfigModal && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#FFF7ED',
                borderBottom: '2px solid var(--primary-400)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--primary-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Key size={16} /> Motor Inteligente de PolloBot
                </span>
                <button onClick={() => setShowConfigModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                El Asistente ya cuenta con un <strong>Motor Analítico Local Dinámico</strong> que consulta la base de datos en vivo. Si deseas conectar adicionalmente <strong>Google Gemini (IA Generativa)</strong>, pega tu API Key abajo:
              </p>
              <form onSubmit={handleSaveApiKey} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="form-control"
                  style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem', flex: 1 }}
                />
                <button type="submit" disabled={savingKey} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                  {savingKey ? 'Guardando...' : 'Guardar'}
                </button>
              </form>
              {configSuccess && (
                <div style={{ color: '#047857', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 700 }}>
                  ✓ {configSuccess}
                </div>
              )}
            </div>
          )}

          {/* Sugerencias Rápidas */}
          <div
            style={{
              padding: '0.6rem 0.85rem',
              backgroundColor: 'var(--bg-main)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#FFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-400)';
                  e.currentTarget.style.color = 'var(--primary-600)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Lista de Mensajes */}
          <div
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              backgroundColor: '#FAFAF9',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '0.8rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.86rem',
                    lineHeight: 1.5,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    backgroundColor: m.role === 'user' ? 'var(--primary-500)' : '#FFFFFF',
                    color: m.role === 'user' ? '#FFFFFF' : 'var(--text-main)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-color)',
                    borderBottomRightRadius: m.role === 'user' ? '4px' : 'var(--radius-lg)',
                    borderBottomLeftRadius: m.role === 'user' ? 'var(--radius-lg)' : '4px',
                  }}
                >
                  {renderFormattedText(m.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-600)', padding: '0.5rem' }}>
                <Loader2 size={18} className="animate-spin" />
                <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>
                  PolloBot analizando inventario y recetas en vivo...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de Envío */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pregunta sobre stock, insumos, costos o ventas..."
              disabled={loading}
              className="form-control"
              style={{ padding: '0.65rem 0.85rem', fontSize: '0.875rem' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="btn btn-primary"
              style={{ padding: '0.65rem 0.95rem', borderRadius: 'var(--radius-md)' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
