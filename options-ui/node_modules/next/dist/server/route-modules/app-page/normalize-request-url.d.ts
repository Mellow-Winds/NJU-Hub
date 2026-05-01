import type { IncomingMessage } from 'http';
import type { BaseNextRequest } from '../../base-http';
export declare function normalizeAppPageRequestUrl(req: Pick<IncomingMessage | BaseNextRequest, 'url'>, pathname: string): void;
