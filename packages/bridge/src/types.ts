/**
 * Enhanced StoryblokBridge configuration based on CDN analysis
 * Generated from: https://app.storyblok.com/f/storyblok-v2-latest.js
 */
export interface StoryblokBridgeConfigV2 {
  /** Resolve relations in the API response */
  resolveRelations?: string | string[];
  /** Custom parent element for the bridge */
  customParent?: string;
  /** Prevent clicks in the editor */
  preventClicks?: boolean;
  /** Language for the bridge */
  language?: string;
  /** Resolve links in the API response */
  resolveLinks?: 'url' | 'story' | '0' | '1' | 'link';
  /** Access token for the Storyblok space */
  accessToken?: string;
  /** Custom API URL */
  apiUrl?: string;
  /** Custom bridge URL */
  bridgeUrl?: string;
  /** Use https for API requests */
  https?: boolean;
  /** Custom component names mapping */
  componentNames?: Record<string, string>;
  /** Enable custom actions in the editor */
  customActions?: boolean;
  /** Prevent redirect on story not found */
  preventRedirect?: boolean;
  /** App version (v1 or v2) */
  appVersion?: 'v1' | 'v2';
}

/**
 * Bridge component context for editor interactions
 */
export interface StoryblokBridgeContext {
  storyId: string;
  componentIds: string[];
  blockIds: string[];
  uid?: string;
  name?: string;
}

/**
 * Bridge breadcrumb for navigation
 */
export interface StoryblokBridgeBreadcrumb {
  _uid: string;
  component: string;
  _parentIndex?: number;
}

/**
 * Bridge block action types
 */
export interface StoryblokBridgeBlockAction {
  action: 'addBlockBefore' | 'addBlockAfter' | 'duplicateBlock' | 'moveForward' | 'moveBackward' | 'deleteBlock' | 'copy';
  blockId?: string;
  componentId?: string;
  pos?: number;
}

/**
 * Bridge overlay options for visual editor
 */
export interface StoryblokBridgeOverlayOptions {
  uid: string;
  name?: string;
  id?: string;
  focused?: boolean;
  navigationBreadcrumbs?: StoryblokBridgeBreadcrumb[];
  actionsEnabled?: boolean;
  canAddBlocks?: boolean;
  canDeleteBlocks?: boolean;
  canMoveForward?: boolean;
  canMoveBackward?: boolean;
}

/**
 * Enter edit mode options
 */
export interface StoryblokEnterEditmodeOptions {
  storyId?: string;
  componentId?: string;
  slug?: string;
  blockId?: string;
  uid?: string;
  name?: string;
}

/**
 * Ping editor options
 */
export interface StoryblokPingEditorOptions {
  customParent?: string;
  reload?: boolean;
}
