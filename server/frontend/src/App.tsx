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
  passiveStatus?: string
  activeStatus?: string
  lastSeen?: string
}

interface ApiTokenRow {
  id: string
  name: string
  lastUsedAt?: string
  createdAt: string
  expiresAt?: string
  deviceIds?: string[]
}

interface ApiTokenFormState {
  mode: 'create' | 'edit'
  tokenId?: string
  name: string
  deviceIds: string[]
}

function formatTokenDeviceScope(
  deviceIds: string[] | undefined,
  allDevices: Device[],
): string {
  if (!deviceIds?.length) {
    return 'Alle Geräte'
  }
  return deviceIds
    .map((id) => allDevices.find((d) => d.id === id)?.name ?? id)
    .join(', ')
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeviceForm, setShowDeviceForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([])
  const [secretModal, setSecretModal] = useState<{ deviceName: string; secret: string } | null>(null)
  const [apiTokenModal, setApiTokenModal] = useState<ApiTokenFormState | null>(null)
  const [apiTokenModalError, setApiTokenModalError] = useState('')
  const [apiTokenModalSaving, setApiTokenModalSaving] = useState(false)
  const [createdApiToken, setCreatedApiToken] = useState<{ token: string; scopeInfo: string } | null>(null)

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
          d.id === payload.deviceId
            ? {
                ...d,
                status: payload.status,
                passiveStatus: d.mode === 'PASSIVE' ? payload.status : 'UNKNOWN',
                activeStatus: d.mode === 'ACTIVE' ? payload.status : 'UNKNOWN',
              }
            : d
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
      const { deviceId: id, secret, serverUrl, wsUrl } = response.data
      const envContent = [
        '# Wake-on-LAN Active Client Config',
        `DEVICE_ID=${id}`,
        `SECRET=${secret}`,
        `SERVER_URL=${serverUrl}`,
        ...(wsUrl ? [`WS_URL=${wsUrl}`] : []),
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

  const openCreateApiTokenModal = () => {
    setApiTokenModalError('')
    setApiTokenModal({
      mode: 'create',
      name: '',
      deviceIds: [],
    })
  }

  const openEditApiTokenModal = (tokenRow: ApiTokenRow) => {
    setApiTokenModalError('')
    setApiTokenModal({
      mode: 'edit',
      tokenId: tokenRow.id,
      name: tokenRow.name,
      deviceIds: tokenRow.deviceIds ?? [],
    })
  }

  const toggleTokenDevice = (deviceId: string) => {
    if (!apiTokenModal) return
    setApiTokenModal({
      ...apiTokenModal,
      deviceIds: apiTokenModal.deviceIds.includes(deviceId)
        ? apiTokenModal.deviceIds.filter((id) => id !== deviceId)
        : [...apiTokenModal.deviceIds, deviceId],
    })
  }

  const handleSubmitApiTokenModal = async () => {
    if (!apiTokenModal) return
    const token = localStorage.getItem('token')
    setApiTokenModalError('')
    setApiTokenModalSaving(true)
    try {
      if (apiTokenModal.mode === 'create') {
        const name = apiTokenModal.name.trim()
        if (!name) {
          setApiTokenModalError('Name ist erforderlich')
          return
        }
        const response = await axios.post(
          `${API_URL}/api-tokens`,
          {
            name,
            ...(apiTokenModal.deviceIds.length
              ? { deviceIds: apiTokenModal.deviceIds }
              : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        setCreatedApiToken({
          token: response.data.token,
          scopeInfo:
            response.data.deviceIds?.length > 0
              ? `Eingeschränkt auf ${response.data.deviceIds.length} Gerät(e).`
              : 'Voller Zugriff auf alle Geräte.',
        })
      } else if (apiTokenModal.tokenId) {
        await axios.patch(
          `${API_URL}/api-tokens/${apiTokenModal.tokenId}`,
          {
            name: apiTokenModal.name.trim(),
            deviceIds: apiTokenModal.deviceIds,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
      }
      setApiTokenModal(null)
      if (token) fetchData(token)
    } catch (error: any) {
      setApiTokenModalError(error.response?.data?.message || error.message)
    } finally {
      setApiTokenModalSaving(false)
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
              onClick={openCreateApiTokenModal}
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
                <div key={token.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 bg-gray-50 rounded-lg border">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{token.name}</p>
                    <p className="text-xs text-gray-500">
                      Erstellt: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && ` • Zuletzt genutzt: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Geräte:</span>{' '}
                      {formatTokenDeviceScope(token.deviceIds, devices)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditApiTokenModal(token)}
                      className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded border border-blue-200"
                    >
                      Zugriff bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteApiToken(token.id)}
                      className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded border border-red-200"
                      title="Token löschen"
                    >
                      Löschen
                    </button>
                  </div>
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

      {apiTokenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900">
              {apiTokenModal.mode === 'create' ? 'API Token erstellen' : 'API Token bearbeiten'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={apiTokenModal.name}
                  onChange={(e) => setApiTokenModal({ ...apiTokenModal, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gerätezugriff (Dropdown)
                </label>
                <details className="border border-gray-300 rounded-md">
                  <summary className="px-3 py-2 cursor-pointer select-none text-sm text-gray-700">
                    {apiTokenModal.deviceIds.length > 0
                      ? `${apiTokenModal.deviceIds.length} Gerät(e) ausgewählt`
                      : 'Alle Geräte (kein Filter)'}
                  </summary>
                  <div className="max-h-56 overflow-y-auto p-3 border-t space-y-2">
                    {devices.length === 0 ? (
                      <p className="text-sm text-gray-500">Keine Geräte vorhanden</p>
                    ) : (
                      devices.map((device) => (
                        <label key={device.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={apiTokenModal.deviceIds.includes(device.id)}
                            onChange={() => toggleTokenDevice(device.id)}
                            className="mt-0.5"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{device.name}</span>{' '}
                            <span className="font-mono text-xs text-gray-500 break-all">{device.id}</span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </details>
              </div>

              {apiTokenModalError && (
                <div className="bg-red-100 border border-red-300 text-red-700 text-sm px-3 py-2 rounded">
                  {apiTokenModalError}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => setApiTokenModal(null)}
                disabled={apiTokenModalSaving}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmitApiTokenModal}
                disabled={apiTokenModalSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {apiTokenModalSaving ? 'Speichere...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdApiToken && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-gray-900">API Token erstellt</h3>
            <p className="text-sm text-gray-600 mb-3">
              Bitte sofort kopieren und sicher speichern. Er wird nur einmal angezeigt.
            </p>
            <p className="text-xs text-gray-500 mb-4">{createdApiToken.scopeInfo}</p>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                readOnly
                value={createdApiToken.token}
                className="flex-1 px-4 py-2 bg-gray-100 border rounded-lg font-mono text-sm focus:outline-none"
              />
              <button
                onClick={() => navigator.clipboard.writeText(createdApiToken.token)}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition-colors"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setCreatedApiToken(null)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
            >
              Fertig
            </button>
          </div>
        </div>
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
