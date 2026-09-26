import geckos, { type ClientChannel, type Data, type RawMessage } from '@geckos.io/client';
import { NetEvent, PROTOCOL_VERSION } from '../../shared/NetProtocol';

type NetEventName = typeof NetEvent[keyof typeof NetEvent];

const SERVER_PORT = 9208;
const PING_INTERVAL_MS = 500;
const SERVER_EVENTS = [NetEvent.REJECTED, NetEvent.ROOM, NetEvent.START, NetEvent.PLAYER_LEFT];

/**
 * The connection to the online server.
 *
 * For testing, the page URL can add network conditions to everything that
 * arrives unreliably (input packets and pings): `?lag=50&jitter=10&loss=5` is
 * 50 ms each way, ±10 ms, 5% of packets lost. Control messages skip them, since
 * Geckos already resends those.
 */
export class NetClient {
    /** Round trip to the server in ms, smoothed. */
    rtt = 0;

    private channel: ClientChannel | null = null;
    private connected = false;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private readonly handlers = new Map<NetEventName, (data: any) => void>();
    private packetHandler: ((packet: Uint8Array) => void) | null = null;
    private disconnectHandler: (() => void) | null = null;
    private readonly conditions = conditionsFromUrl();

    /** Connects and introduces the game to the server. */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timed out')), 8000);
            const channel = geckos({ url: serverUrl(), port: SERVER_PORT });
            this.channel = channel;

            channel.onConnect(error => {
                clearTimeout(timeout);
                if (this.channel !== channel) {
                    // Closed while connecting: Geckos can only close a connected channel, so it's closed now
                    if (!error) channel.close();
                    reject(new Error('Closed'));
                    return;
                }
                if (error) {
                    reject(error);
                    return;
                }
                this.connected = true;
                // Geckos can't remove listeners, so each event gets one that forwards to the current handler
                for (const event of SERVER_EVENTS) {
                    channel.on(event, data => this.handlers.get(event)?.(data));
                }
                channel.on(NetEvent.PONG, data => this.arrive(() => this.onPong(data)));
                channel.onRaw(raw => this.arrive(() => this.packetHandler?.(toBytes(raw))));
                channel.onDisconnect(() => this.disconnectHandler?.());

                channel.emit(NetEvent.HELLO, { version: PROTOCOL_VERSION }, { reliable: true });
                this.pingTimer = setInterval(() => channel.emit(NetEvent.PING, { t: performance.now() }), PING_INTERVAL_MS);
                resolve();
            });
        });
    }

    /** Replaces the handler for a server event. */
    on(event: NetEventName, handler: (data: any) => void): void {
        this.handlers.set(event, handler);
    }

    onPacket(handler: (packet: Uint8Array) => void): void {
        this.packetHandler = handler;
    }

    onDisconnect(handler: () => void): void {
        this.disconnectHandler = handler;
    }

    /** Control messages are sent reliably. */
    send(event: NetEventName, data: Data = {}): void {
        this.channel?.emit(event, data, { reliable: true });
    }

    sendPacket(packet: Uint8Array): void {
        this.channel?.raw.emit(packet);
    }

    close(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
        this.handlers.clear();
        this.packetHandler = null;
        this.disconnectHandler = null;
        if (this.connected) this.channel?.close();
        this.channel = null;
        this.connected = false;
    }

    private onPong(data: Data): void {
        const sent = (data as { t?: unknown } | null)?.t;
        if (typeof sent !== 'number') return;
        const sample = performance.now() - sent;
        this.rtt = this.rtt === 0 ? sample : this.rtt * 0.8 + sample * 0.2;
    }

    /** Applies the test network conditions, if any, to something that just arrived. */
    private arrive(deliver: () => void): void {
        const { lagMs, jitterMs, lossPercent } = this.conditions;
        if (lossPercent > 0 && Math.random() * 100 < lossPercent) return;
        const delay = lagMs + (Math.random() * 2 - 1) * jitterMs;
        if (delay > 0) setTimeout(deliver, delay);
        else deliver();
    }
}

/** The server is on the host the page came from; the packaged app uses the production server. */
function serverUrl(): string {
    let host = window.location.hostname;
    if (!host || window.location.protocol === 'file:') host = '138.68.126.112';
    // Chromium can refuse the IPv6 localhost
    else if (host === 'localhost') host = '127.0.0.1';
    return `http://${host}`;
}

function conditionsFromUrl(): { lagMs: number; jitterMs: number; lossPercent: number } {
    const params = new URLSearchParams(window.location.search);
    const number = (name: string) => Math.max(0, Number(params.get(name)) || 0);
    return { lagMs: number('lag'), jitterMs: number('jitter'), lossPercent: number('loss') };
}

function toBytes(raw: RawMessage): Uint8Array {
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    return new Uint8Array(0);
}
