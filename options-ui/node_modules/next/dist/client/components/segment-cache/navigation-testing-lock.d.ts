/**
 * Navigation lock for the Instant Navigation Testing API.
 *
 * Manages the in-memory lock (a promise) that gates dynamic data writes
 * during instant navigation captures, and owns all cookie state
 * transitions (pending → captured-MPA, pending → captured-SPA).
 *
 * External actors (Playwright, devtools) set [0] to start a lock scope
 * and delete the cookie to end one. Next.js writes captured values.
 * The CookieStore handler distinguishes them by value: pending = external,
 * captured = self-write (ignored).
 */
import type { FlightRouterState } from '../../../shared/lib/app-router-types';
/**
 * Sets up the cookie-based lock. Handles the initial page load state and
 * registers a CookieStore listener for runtime changes.
 *
 * Called once during page initialization from app-globals.ts.
 */
export declare function startListeningForInstantNavigationCookie(): void;
/**
 * Transitions the cookie from pending to captured-SPA. Called when a
 * client-side navigation is captured by the lock.
 *
 * @param fromTree - The flight router state of the from-route
 * @param toTree - The flight router state of the to-route (null if not yet known)
 */
export declare function transitionToCapturedSPA(fromTree: FlightRouterState, toTree: FlightRouterState | null): void;
/**
 * Updates the captured-SPA cookie with the resolved route trees.
 * Called after the prefetch resolves and the target route tree is known.
 */
export declare function updateCapturedSPAToTree(fromTree: FlightRouterState, toTree: FlightRouterState): void;
/**
 * Returns true if the navigation lock is currently active.
 */
export declare function isNavigationLocked(): boolean;
/**
 * Waits for the navigation lock to be released, if it's currently held.
 * No-op if the lock is not acquired.
 */
export declare function waitForNavigationLockIfActive(): Promise<void>;
