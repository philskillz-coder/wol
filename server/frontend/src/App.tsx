import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'
import DeviceCard from './components/DeviceCard'
import DeviceForm from './components/DeviceForm'

const API_URL = 'http://localhost:3000'
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

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    if (token) {
      localStorage.setItem('token', token)
      window.location.href = '/'
    }
  }, [])

  // WebSocket: live device status updates when a device connects/disconnects
  useEffect(() => {
    if (!isAuthenticated) return

    const wsUrl = new URL(API_URL)
    const socket = io(`${wsUrl.origin}${WS_NAMESPACE}`, {
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

    socket.on('connect_error', () => {
      // Optional: could show a small "Live updates disconnected" hint
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUser(response.data)
      setIsAuthenticated(true)
      await loadDevices(token)
      await loadApiTokens(token)
    } catch (error) {
      localStorage.removeItem('token')
      setLoading(false)
    }
  }

  const loadDevices = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setDevices(response.data)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadApiTokens = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/api-tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setApiTokens(response.data)
    } catch (error) {
      console.error('Failed to load API tokens:', error)
    }
  }

  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/authentik`
  }

  const handleWake = async (deviceId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/wol/${deviceId}/wake`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert('Wake signal sent!')
      await loadDevices(token!)
    } catch (error: any) {
      alert(`Failed to send wake signal: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleShutdown = async (deviceId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/wol/${deviceId}/shutdown`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert('Shutdown command sent!')
      await loadDevices(token!)
    } catch (error: any) {
      alert(`Failed to send shutdown command: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleSaveDevice = async (formData: any) => {
    const token = localStorage.getItem('token')
    try {
      if (editingDevice) {
        await axios.patch(
          `${API_URL}/devices/${editingDevice.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      } else {
        await axios.post(
          `${API_URL}/devices`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
      setShowDeviceForm(false)
      setEditingDevice(null)
      await loadDevices(token!)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to save device')
    }
  }

  const handleDeleteDevice = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${API_URL}/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadDevices(token!)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete device')
    }
  }

  const handleDownloadConfig = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      const response = await axios.get(`${API_URL}/devices/${deviceId}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const { deviceId: id, secret, serverUrl } = response.data
      const envLines = [
        '# Wake-on-LAN Active Client – copy to client/.env',
        `DEVICE_ID=${id}`,
        `SECRET=${secret}`,
        `SERVER_URL=${serverUrl}`,
        'ALLOW_SHUTDOWN=false',
      ]
      const envContent = envLines.join('\n')
      const blob = new Blob([envContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `device-${deviceId}.env`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      alert(`Failed to download config: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleRegenerateSecret = async (deviceId: string) => {
    const token = localStorage.getItem('token')
    try {
      const response = await axios.post(
        `${API_URL}/devices/${deviceId}/regenerate-secret`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const device = devices.find((d) => d.id === deviceId)
      setSecretModal({
        deviceName: device?.name ?? 'Device',
        secret: response.data.secret,
      })
      await loadDevices(token!)
    } catch (error: any) {
      alert(`Failed to regenerate secret: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleCreateApiToken = async () => {
    const name = prompt('Enter a name for the API token:')
    if (!name) return

    const token = localStorage.getItem('token')
    try {
      const response = await axios.post(
        `${API_URL}/api-tokens`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Show token (only shown once!)
      alert(`API Token created!\n\nToken: ${response.data.token}\n\nSave this token now - it won't be shown again!`)
      
      await loadApiTokens(token!)
    } catch (error: any) {
      alert(`Failed to create API token: ${error.response?.data?.message || error.message}`)
    }
  }

  const handleDeleteApiToken = async (tokenId: string) => {
    if (!confirm('Delete this API token?')) return

    const token = localStorage.getItem('token')
    try {
      await axios.delete(`${API_URL}/api-tokens/${tokenId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await loadApiTokens(token!)
    } catch (error: any) {
      alert(`Failed to delete API token: ${error.response?.data?.message || error.message}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Wake-on-LAN Management</h1>
          <p className="mb-6 text-gray-600">Please login to continue</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Login with Authentik
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Wake-on-LAN Management</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{user?.email}</span>
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  setIsAuthenticated(false)
                  setUser(null)
                  setDevices([])
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Devices Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Devices</h2>
              <button
                onClick={() => {
                  setEditingDevice(null)
                  setShowDeviceForm(true)
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Add Device
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
                No devices found. Add a device to get started.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onWake={handleWake}
                    onShutdown={handleShutdown}
                    onEdit={(d) => {
                      setEditingDevice(d)
                      setShowDeviceForm(true)
                    }}
                    onDelete={handleDeleteDevice}
                    onDownloadConfig={handleDownloadConfig}
                    onRegenerateSecret={handleRegenerateSecret}
                  />
                ))}
              </div>
            )}
          </div>

          {/* API Tokens Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">API Tokens</h2>
              <button
                onClick={handleCreateApiToken}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + Create Token
              </button>
            </div>

            {apiTokens.length === 0 ? (
              <p className="text-gray-500">No API tokens created yet.</p>
            ) : (
              <div className="space-y-2">
                {apiTokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">{token.name}</p>
                      <p className="text-sm text-gray-500">
                        Created: {new Date(token.createdAt).toLocaleDateString()}
                        {token.lastUsedAt && (
                          <> • Last used: {new Date(token.lastUsedAt).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteApiToken(token.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showDeviceForm && (
        <DeviceForm
          device={editingDevice || undefined}
          onSave={handleSaveDevice}
          onCancel={() => {
            setShowDeviceForm(false)
            setEditingDevice(null)
          }}
        />
      )}

      {secretModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">New secret: {secretModal.deviceName}</h3>
            <p className="text-sm text-gray-600 mb-3">
              Update your client config with this secret. It won&apos;t be shown again.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={secretModal.secret}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-gray-50"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(secretModal.secret)
                }}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm"
              >
                Copy
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSecretModal(null)}
              className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
