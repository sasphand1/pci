import { makeInstagramProvider } from './instagram.js';
import { YoutubeClient } from '../modules/youtube/client.js';
import { makeYoutubeProvider } from './youtube.js';
import type { Platform, Provider } from './types.js';

export type ProviderMap = Partial<Record<Platform, Provider>>;
/** TikTok is deliberately absent: it is not wired to any scope in v1. */
export const defaultProviders = (): ProviderMap => ({ youtube: makeYoutubeProvider(new YoutubeClient()), instagram: makeInstagramProvider() });
