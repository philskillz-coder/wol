import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

interface Device {
  id: string;
  name: string;
  macAddress: string;
  ipAddress?: string;
  mode: string;
  status: string;
  lastSeen?: string;
}

interface DeviceCardProps {
  device: Device;
  onWake: (deviceId: string) => Promise<void>;
  onShutdown: (deviceId: string) => Promise<void>;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => Promise<void>;
  onDownloadConfig: (deviceId: string) => Promise<void>;
}

export default function DeviceCard({
  device,
  onWake,
  onShutdown,
  onEdit,
  onDelete,
  onDownloadConfig,
}: DeviceCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

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
    setLoading(actionName);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium mb-2">{device.name}</h3>
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
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                  device.status,
                )}`}
              >
                {device.status}
              </span>
            </p>
            {device.lastSeen && (
              <p className="text-xs text-gray-500">
                Last seen: {new Date(device.lastSeen).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleAction(() => onWake(device.id), 'wake')}
          disabled={loading !== null}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading === 'wake' ? 'Waking...' : 'Wake'}
        </button>

        {device.mode === 'ACTIVE' && (
          <button
            onClick={() => handleAction(() => onShutdown(device.id), 'shutdown')}
            disabled={loading !== null}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {loading === 'shutdown' ? 'Shutting...' : 'Shutdown'}
          </button>
        )}

        {device.mode === 'ACTIVE' && (
          <button
            onClick={() => handleAction(() => onDownloadConfig(device.id), 'config')}
            disabled={loading !== null}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {loading === 'config' ? 'Downloading...' : 'Config'}
          </button>
        )}

        <button
          onClick={() => onEdit(device)}
          disabled={loading !== null}
          className="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 text-sm"
        >
          Edit
        </button>

        <button
          onClick={() => {
            if (confirm(`Delete device "${device.name}"?`)) {
              handleAction(() => onDelete(device.id), 'delete');
            }
          }}
          disabled={loading !== null}
          className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm"
        >
          {loading === 'delete' ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
