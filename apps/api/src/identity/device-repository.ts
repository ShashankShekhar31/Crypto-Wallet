import type { Storage } from "@crypto-wallet/storage";

export interface DeviceRecord {
  id: string;
  userId: string;
  platform: string;
  name: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
}

interface DeviceRow {
  id: string;
  user_id: string;
  platform: string;
  name: string | null;
  created_at: Date;
  last_seen_at: Date | null;
  revoked_at: Date | null;
}

export class DeviceRepository {
  constructor(
    private readonly storage: Storage,
  ) {}

  async findActiveDeviceForUser(
    deviceId: string,
    userId: string,
  ): Promise<DeviceRecord | null> {
    const result =
      await this.storage.query<DeviceRow>(
        `
          SELECT
            id,
            user_id,
            platform,
            name,
            created_at,
            last_seen_at,
            revoked_at
          FROM devices
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
          LIMIT 1
        `,
        [deviceId, userId],
      );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return mapDevice(row);
  }
}

function mapDevice(
  row: DeviceRow,
): DeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    name: row.name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  };
}