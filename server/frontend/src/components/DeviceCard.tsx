import { useState, useRef, useEffect } from 'react';

interface Device {
  id: string;
  name: string;
  macAddress: string;
  ipAddress?: string;
  mode: string;
  status: string;
  passiveStatus?: string;
  activeStatus?: string;
  lastSeen?: string;
}

interface DeviceCardProps {
  device: Device;
  onWake: (deviceId: string) => Promise<void>;
  onShutdown: (deviceId: string) => Promise<void>;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => Promise<void>;
  onDownloadConfig: (deviceId: string) => Promise<void>;
  onRegenerateSecret: (deviceId: string) => Promise<void>;
}

export default function DeviceCard({
  device,
  onWake,
  onShutdown,
  onEdit,
  onDelete,
  onDownloadConfig,
  onRegenerateSecret,
}: DeviceCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpen]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'text-green-600 bg-green-100';
      case 'OFFLINE':
        return 'text-red-600 bg-red-100';
      case 'STANDBY':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const handleAction = async (action: () => Promise<void>, actionName: string) => {
    setMenuOpen(false);
    setLoading(actionName);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  const isActive = device.mode === 'ACTIVE';
  const busy = loading !== null;
  const passiveStatus = device.passiveStatus ?? (device.mode === 'PASSIVE' ? device.status : 'UNKNOWN');
  const activeStatus = device.activeStatus ?? (device.mode === 'ACTIVE' ? device.status : 'UNKNOWN');

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium mb-2 truncate">{device.name}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">MAC:</span> {device.macAddress}
            </p>
            {device.ipAddress && (
              <p>
                <span className="font-medium">IP:</span> {device.ipAddress}
              </p>
            )}
            <p>
              <span className="font-medium">Mode:</span>{' '}
              <span className="capitalize">{device.mode.toLowerCase()}</span>
            </p>
            <div className="space-y-1">
              <p>
                <span className="font-medium">Passive:</span>{' '}
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                    passiveStatus,
                  )}`}
                >
                  {passiveStatus.toLowerCase()}
                </span>
              </p>
              <p>
                <span className="font-medium">Active:</span>{' '}
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                    activeStatus,
                  )}`}
                >
                  {activeStatus.toLowerCase()}
                </span>
              </p>
            </div>
            {device.lastSeen && (
              <p className="text-xs text-gray-500">
                Last seen: {new Date(device.lastSeen).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAction(() => onWake(device.id), 'wake')}
          disabled={busy}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading === 'wake' ? 'Waking...' : 'Wake'}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={busy}
            className="p-2 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600"
            aria-label="Device menu"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10"
              role="menu"
            >
              {isActive && (
                <>
                  <button
                    onClick={() => handleAction(() => onShutdown(device.id), 'shutdown')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    {loading === 'shutdown' ? 'Shutting down...' : 'Shutdown'}
                  </button>
                  <button
                    onClick={() => handleAction(() => onDownloadConfig(device.id), 'config')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    {loading === 'config' ? 'Downloading...' : 'Download .env'}
                  </button>
                  <button
                    onClick={() =>
                      handleAction(() => onRegenerateSecret(device.id), 'regenerate')
                    }
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    {loading === 'regenerate' ? 'Regenerating...' : 'Regenerate secret'}
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                </>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(device);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete device "${device.name}"?`)) {
                    handleAction(() => onDelete(device.id), 'delete');
                  }
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                role="menuitem"
              >
                {loading === 'delete' ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
