import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'
import DeviceCard from './components/DeviceCard'
import DeviceForm from './components/DeviceForm'

// Diese Pfade werden durch deinen Reverse Proxy oder das Host-Networking aufgelöst
const API_URL = '/api'
const WS_NAMESPACE = '/ws'

interface Device {
  id: string
  name: string
  macAddress: string
  ipAddress?: string
  mode: string
  status: string
  lastSeen?: string
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeviceForm, setShowDeviceForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [apiTokens, setApiTokens] = useState<any[]>([])
  const [secretModal, setSecretModal] = useState<{ deviceName: string; secret: string } | null>(null)

  const socketRef = useRef<Socket | null>(null)

  // Zentralisierte Funktion zum Laden aller Daten
  const fetchData = useCallback(async (token: string) => {
    try {
      const [devRes, tokenRes] = await Promise.all([
        axios.get(`${API_URL}/devices`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api-tokens`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDevices(devRes.data)
      setApiTokens(tokenRes.data)
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUser(response.data)
      setIsAuthenticated(true)
      await fetchData(token)
    } catch (error) {
      console.error('Session abgelaufen');
      localStorage.removeItem('token')
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [fetchData])

  // Initialer Check & OAuth Handling
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    
    if (token) {
      localStorage.setItem('token', token)
      // Entfernt den Query-Parameter aus der URL ohne Refresh
      window.history.replaceState({}, document.title, "/")
    }
    
    checkAuth()
  }, [checkAuth])

  // WebSocket Verbindung für Live-Updates
  useEffect(() => {
    if (!isAuthenticated) return

    // Socket.io nutzt automatisch die aktuelle Domain, wenn nur der Pfad angegeben wird
    const socket = io(WS_NAMESPACE, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })
    
    socketRef.current = socket

    socket.on('device-status-changed', (payload: { deviceId: string; status: string }) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === payload.deviceId ? { ...d, status: payload.status } : d
        )
      )
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated])

  // --- API Actions ---

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/authentik`
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
    setUser(null)
    setDevices([])
  }

  const handleWake = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      await axios.post(`${API_URL}/wol/${deviceId}/wake`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
    } catch (error: any) {
      alert(`Wake fehlgeschlagen: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleShutdown = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      await axios.post(`${API_URL}/wol/${deviceId}/shutdown`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
    } catch (error: any) {
      alert(`Shutdown fehlgeschlagen: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleSaveDevice = async (formData: any) => {
    const token = localStorage.getItem('token')
    try {
      if (editingDevice) {
        await axios.patch(`${API_URL}/devices/${editingDevice.id}`, formData, { 
          headers: { Authorization: `Bearer ${token}` } 
        })
      } else {
        await axios.post(`${API_URL}/devices`, formData, { 
          headers: { Authorization: `Bearer ${token}` } 
        })
      }
      setShowDeviceForm(false)
      setEditingDevice(null)
      if (token) fetchData(token)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Fehler beim Speichern')
    }
  }

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Gerät wirklich löschen?')) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${API_URL}/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (token) fetchData(token)
    } catch (error: any) {
      alert(`Löschen fehlgeschlagen: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleDownloadConfig = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      const response = await axios.get(`${API_URL}/devices/${deviceId}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { deviceId: id, secret, serverUrl } = response.data
      const envContent = [
        '# Wake-on-LAN Active Client Config',
        `DEVICE_ID=${id}`,
        `SECRET=${secret}`,
        `SERVER_URL=${serverUrl}`,
        'ALLOW_SHUTDOWN=false',
      ].join('\n')

      const blob = new Blob([envContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `device-${id}.env`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      alert(`Config Download fehlgeschlagen: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleRegenerateSecret = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      const response = await axios.post(`${API_URL}/devices/${deviceId}/regenerate-secret`, {}, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      const device = devices.find((d) => d.id === deviceId)
      setSecretModal({
        deviceName: device?.name ?? 'Device',
        secret: response.data.secret,
      })
      if (token) fetchData(token)
    } catch (error: any) {
      alert(`Fehler: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleCreateApiToken = async () => {
    const name = prompt('Name für den API Token:')
    if (!name) return
    const token = localStorage.getItem('token')
    try {
      const response = await axios.post(`${API_URL}/api-tokens`, { name }, { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      alert(`API Token erstellt!\n\nToken: ${response.data.token}\n\nSicher speichern, er wird nur einmal angezeigt!`)
      if (token) fetchData(token)
    } catch (error: any) {
      alert(`Fehler: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleDeleteApiToken = async (tokenId: string) => {
    if (!confirm('API Token löschen?')) return
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${API_URL}/api-tokens/${tokenId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (token) fetchData(token)
    } catch (error: any) {
      alert(`Fehler: ${error.response?.data?.message || error.message}`)
    }
  }

  // --- Rendering ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Lade Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Wake-on-LAN</h1>
          <p className="mb-6 text-gray-600">Bitte melde dich an, um deine Geräte zu verwalten.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Mit Authentik anmelden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-gray-900">WOL Manager</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:inline">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Devices Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Geräte</h2>
          <button
            onClick={() => { setEditingDevice(null); setShowDeviceForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-shadow shadow-sm"
          >
            + Gerät hinzufügen
          </button>
        </div>

        {/* Devices Grid */}
        {devices.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
            <p className="text-gray-500">Noch keine Geräte registriert.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onWake={handleWake}
                onShutdown={handleShutdown}
                onEdit={(d) => { setEditingDevice(d); setShowDeviceForm(true); }}
                onDelete={handleDeleteDevice}
                onDownloadConfig={handleDownloadConfig}
                onRegenerateSecret={handleRegenerateSecret}
              />
            ))}
          </div>
        )}

        {/* API Tokens Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">API Schnittstellen</h2>
            <button
              onClick={handleCreateApiToken}
              className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors"
            >
              Token erstellen
            </button>
          </div>

          <div className="space-y-3">
            {apiTokens.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Keine API Tokens aktiv.</p>
            ) : (
              apiTokens.map((token) => (
                <div key={token.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-semibold text-gray-800">{token.name}</p>
                    <p className="text-xs text-gray-500">
                      Erstellt: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && ` • Zuletzt genutzt: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteApiToken(token.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    title="Token löschen"
                  >
                    Löschen
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showDeviceForm && (
        <DeviceForm
          device={editingDevice || undefined}
          onSave={handleSaveDevice}
          onCancel={() => { setShowDeviceForm(false); setEditingDevice(null); }}
        />
      )}

      {secretModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Neues Geheimnis: {secretModal.deviceName}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Kopiere dieses Secret in deine Client-Konfiguration. Es wird <strong>nie wieder</strong> angezeigt.
            </p>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                readOnly
                value={secretModal.secret}
                className="flex-1 px-4 py-2 bg-gray-100 border rounded-lg font-mono text-sm focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(secretModal.secret);
                  alert('Kopiert!');
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition-colors"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setSecretModal(null)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
            >
              Fertig
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App