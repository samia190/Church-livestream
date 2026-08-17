import axios, { type AxiosInstance } from "axios";

const RESTREAM_API_URL = "https://api.restream.io/v2";

export type SupportedDestination = "youtube" | "instagram";

interface RestreamChannel {
  id: number;
  streamingPlatformId: number;
  displayName?: string;
  active?: boolean;
}

interface RestreamEvent {
  id: string;
}

interface RestreamStreamKey {
  streamKey: string;
  srtUrl: string | null;
}

const PLATFORM_IDS: Record<SupportedDestination, number> = {
  youtube: 5,
  instagram: 73,
};

export class RestreamService {
  private readonly client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: RESTREAM_API_URL,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async getChannels(): Promise<RestreamChannel[]> {
    const { data } = await this.client.get<RestreamChannel[]>("/user/channel/all");
    return Array.isArray(data) ? data : [];
  }

  async createBroadcast(
    title: string,
    description: string,
    platforms: string[]
  ): Promise<{ id: string; channels: RestreamChannel[] }> {
    const supported = platforms.filter((platform): platform is SupportedDestination =>
      platform in PLATFORM_IDS
    );
    if (supported.length === 0) {
      throw new Error("Restream currently supports only configured YouTube or Instagram event destinations");
    }

    const { data: event } = await this.client.post<RestreamEvent>("/user/events/new", {
      streamType: "encoder",
      title,
      description,
    });

    const channels = await this.getChannels();
    const attached: RestreamChannel[] = [];
    for (const platform of supported) {
      const channel = channels.find(
        candidate => candidate.active !== false && candidate.streamingPlatformId === PLATFORM_IDS[platform]
      );
      if (!channel) {
        throw new Error(`No active Restream ${platform} channel is connected`);
      }

      await this.client.post(`/user/events/${event.id}/destinations`, {
        channelId: channel.id,
        title,
        description,
        ...(platform === "youtube"
          ? { privacyStatus: "public", createEventPost: true, latencyPreference: "low" }
          : {}),
      });
      attached.push(channel);
    }

    return { id: event.id, channels: attached };
  }

  async getIngestUrl(eventId: string): Promise<{ rtmpUrl: string; streamKey: string }> {
    const { data } = await this.client.get<RestreamStreamKey>(
      `/user/events/${eventId}/streamKey`
    );
    return {
      rtmpUrl: "rtmp://live.restream.io/live",
      streamKey: data.streamKey,
    };
  }

  async stopBroadcast(_eventId: string): Promise<void> {
    // The current Events API ends an encoder event when the RTMP encoder disconnects.
    // There is no supported /broadcasts/{id}/stop endpoint in the current contract.
  }
}

export function createRestreamService(accessToken: string): RestreamService {
  return new RestreamService(accessToken);
}
