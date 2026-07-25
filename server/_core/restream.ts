import axios from 'axios';

const RESTREAM_API_URL = 'https://api.restream.io/v2';

interface RestreamChannel {
  id: string;
  name: string;
  platform: string;
  isLive: boolean;
  rtmpUrl?: string;
  streamKey?: string;
}

interface RestreamBroadcast {
  id: string;
  title: string;
  description?: string;
  channels: RestreamChannel[];
  status: 'scheduled' | 'live' | 'ended';
  startTime: Date;
  endTime?: Date;
}

/**
 * Restream.io API integration for multi-platform broadcasting
 */
export class RestreamService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new broadcast on Restream
   */
  async createBroadcast(
    title: string,
    description: string,
    channels: string[] // ['youtube', 'facebook', 'instagram', 'tiktok']
  ): Promise<RestreamBroadcast> {
    try {
      const response = await axios.post(
        `${RESTREAM_API_URL}/broadcasts`,
        {
          title,
          description,
          channels: channels.map(channel => ({ platform: channel })),
        },
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Restream: Failed to create broadcast', error);
      throw error;
    }
  }

  /**
   * Start a broadcast
   */
  async startBroadcast(broadcastId: string): Promise<void> {
    try {
      await axios.post(
        `${RESTREAM_API_URL}/broadcasts/${broadcastId}/start`,
        {},
        { headers: this.getHeaders() }
      );
    } catch (error) {
      console.error('Restream: Failed to start broadcast', error);
      throw error;
    }
  }

  /**
   * Stop a broadcast
   */
  async stopBroadcast(broadcastId: string): Promise<void> {
    try {
      await axios.post(
        `${RESTREAM_API_URL}/broadcasts/${broadcastId}/stop`,
        {},
        { headers: this.getHeaders() }
      );
    } catch (error) {
      console.error('Restream: Failed to stop broadcast', error);
      throw error;
    }
  }

  /**
   * Get broadcast details
   */
  async getBroadcast(broadcastId: string): Promise<RestreamBroadcast> {
    try {
      const response = await axios.get(
        `${RESTREAM_API_URL}/broadcasts/${broadcastId}`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Restream: Failed to get broadcast', error);
      throw error;
    }
  }

  /**
   * Get RTMP ingest URL for streaming
   */
  async getIngestUrl(broadcastId: string): Promise<{ rtmpUrl: string; streamKey: string }> {
    try {
      const broadcast = await this.getBroadcast(broadcastId);
      const channel = broadcast.channels[0];

      return {
        rtmpUrl: channel.rtmpUrl || 'rtmp://live.restream.io/live',
        streamKey: channel.streamKey || '',
      };
    } catch (error) {
      console.error('Restream: Failed to get ingest URL', error);
      throw error;
    }
  }

  /**
   * Get list of connected channels
   */
  async getChannels(): Promise<RestreamChannel[]> {
    try {
      const response = await axios.get(
        `${RESTREAM_API_URL}/channels`,
        { headers: this.getHeaders() }
      );

      return response.data.channels || [];
    } catch (error) {
      console.error('Restream: Failed to get channels', error);
      return [];
    }
  }

  /**
   * Update broadcast details
   */
  async updateBroadcast(
    broadcastId: string,
    updates: Partial<{ title: string; description: string }>
  ): Promise<RestreamBroadcast> {
    try {
      const response = await axios.patch(
        `${RESTREAM_API_URL}/broadcasts/${broadcastId}`,
        updates,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      console.error('Restream: Failed to update broadcast', error);
      throw error;
    }
  }
}

/**
 * Create a Restream service instance
 */
export function createRestreamService(apiKey: string): RestreamService {
  return new RestreamService(apiKey);
}
