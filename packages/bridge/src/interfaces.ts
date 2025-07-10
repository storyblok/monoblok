/**
 * Additional bridge interfaces for advanced use cases
 */

/**
 * Bridge CSS class constants
 */
export const BRIDGE_CSS_CLASSES = {
  OUTLINE: 'storyblok--outlined',
  STYLESHEET: 'storyblok-bridge-stylesheet',
  HINT: 'storyblok__hint',
  HIGHLIGHTER: 'storyblok__highlight',
  OVERLAY: 'storyblok__overlay',
  OVERLAY_MENU: 'storyblok__overlay-menu',
  ACTIONS_MENU: 'storyblok__actions-menu',
  BREADCRUMBS_MENU: 'storyblok__breadcrumbs-menu',
} as const;

/**
 * Bridge visual editor state
 */
export interface StoryblokBridgeVisualState {
  isEditorActive: boolean;
  isOutlineMode: boolean;
  highlightedComponent?: string;
  selectedComponent?: string;
  overlayPosition?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * Bridge component information
 */
export interface StoryblokBridgeComponentInfo {
  uid: string;
  name: string;
  displayName?: string;
  element?: HTMLElement;
  editable?: boolean;
  focused?: boolean;
  parent?: StoryblokBridgeComponentInfo;
  children?: StoryblokBridgeComponentInfo[];
}

/**
 * Bridge action menu item
 */
export interface StoryblokBridgeActionMenuItem {
  eventFunction: () => Function;
  innerHTML: string;
  order: number;
  show: () => boolean;
  className?: string;
  element?: string;
  event?: string;
  separator?: boolean;
}

/**
 * Bridge utilities interface
 */
export interface StoryblokBridgeUtilities {
  /** Get component data from element */
  getComponentData: (element: HTMLElement) => any;
  /** Check if element is within another element */
  isElementWithin: (parent: HTMLElement, child: HTMLElement) => boolean;
  /** Find element by UID */
  findElementByUid: (uid: string) => HTMLElement | null;
  /** Check if element is in viewport */
  isElementInViewport: (element: HTMLElement) => boolean;
  /** Parse JSON safely */
  parseJsonSafely: (jsonString: string) => any;
  /** Get breadcrumb elements */
  getBreadcrumbElements: (element: HTMLElement) => Array<{ options: any; el: HTMLElement }>;
  /** Get URL parameter */
  getUrlParam: (param: string) => string;
  /** Format component name */
  formatComponentName: (name: string) => string;
}

/**
 * Bridge initialization result
 */
export interface StoryblokBridgeInitResult {
  success: boolean;
  bridge?: any;
  error?: string;
}
