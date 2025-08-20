import { handleAPIError } from '../../utils';
import { mapiClient } from '../../api';

/**
 * Interface for space environment configuration
 */
export interface SpaceEnvironment {
  name: string;
  location: string; // URL
}

/**
 * Interface for space billing address
 */
export interface SpaceBillingAddress {
  [key: string]: unknown; // The API doesn't specify exact structure
}

/**
 * Interface for space limits
 */
export interface SpaceLimits {
  [key: string]: unknown; // The API doesn't specify exact structure
}

/**
 * Interface for space options
 */
export interface SpaceOptions {
  [key: string]: unknown; // Options for backup and language configurations
}

/**
 * Interface for collaborator user object
 */
export interface CollaboratorUser {
  [key: string]: unknown; // The user object structure
}

/**
 * Interface for space collaborator
 */
export interface SpaceCollaborator {
  user: CollaboratorUser;
  role: string;
  user_id: number;
  permissions: string[];
  allowed_paths: number[];
  field_permissions: string[];
  id: number;
  space_role_id: number;
  space_role_ids: number[];
  space_id: number;
}

/**
 * Interface for space owner
 */
export interface SpaceOwner {
  [key: string]: unknown; // The user object of the owner
}

/**
 * Request body interface for creating a space
 * Based on: https://www.storyblok.com/docs/api/management/spaces/create-a-space#request-body-properties
 */
export interface CreateSpaceRequest {
  /** Name of the Space (required) */
  name: string;
  /** Domain for your default preview url */
  domain?: string;
  /** Published Webhook URL */
  story_published_hook?: string;
  /** Array of name, location (url) objects */
  environments?: SpaceEnvironment[];
  /** Searchblok id, if available */
  searchblok_id?: number;
  /** If the space has pending tasks like backup, deployment etc */
  has_pending_tasks?: boolean;
  /** Legacy (no longer in use). Used to enable or disable AI translations */
  ai_translation_disabled?: boolean;
  /** The organization of the space */
  org?: {
    name: string;
  };
  /** If the space is in an organization */
  in_org?: boolean;
}

/**
 * Response interface for space operations
 * Based on: https://www.storyblok.com/docs/api/management/spaces/create-a-space#response-properties
 */
export interface Space {
  /** Name of the Space */
  name: string;
  /** Domain for your default preview url */
  domain: string;
  /** Unique Domain for the Storyblok Rendering Service */
  uniq_domain: string;
  /** Space Plan */
  plan: string;
  /** Plan Level of Space */
  plan_level: number;
  /** Limits of the space */
  limits: SpaceLimits;
  /** Creation date (Format: yyyy-MM-dd'T'HH:mm:ssZ) */
  created_at: string;
  /** ID of the space */
  id: number;
  /** Role of the collaborator, could be admin, editor or custom roles */
  role: string;
  /** Numeric user id of the owner for that space */
  owner_id: number;
  /** Published Webhook URL */
  story_published_hook: string;
  /** Array of name, location (url) objects */
  environments: SpaceEnvironment[];
  /** Number of Stories in the Space */
  stories_count: number;
  /** Space id of a possible parent space */
  parent_id: number;
  /** Number of Assets in the Space */
  assets_count: number;
  /** Searchblok id, if available */
  searchblok_id: number;
  /** Is the space globally duplicatable by all users */
  duplicatable: boolean;
  /** Request Count of the day */
  request_count_today: number;
  /** Number of Exceeded Requests */
  exceeded_requests: number;
  /** Billing information used to generate your invoices for this space */
  billing_address: SpaceBillingAddress;
  /** Routes for the Storyblok Rendering Service */
  routes: string[];
  /** Is the space in trial mode */
  trial: boolean;
  /** Component name which will be used as default content type for this folders entries */
  default_root: string;
  /** Does the space have a slack webhook */
  has_slack_webhook: boolean;
  /** If the space has pending tasks like backup, deployment etc */
  has_pending_tasks: boolean;
  /** Legacy (no longer in use). Used to enable or disable AI translations */
  ai_translation_disabled: boolean;
  /** The oldest available preview token of the space */
  first_token: string;
  /** Options for backup and language configurations */
  options: SpaceOptions;
  /** Array of Collaborators of the Space */
  collaborator: SpaceCollaborator[];
  /** The user Object of the Owner */
  owner: SpaceOwner;
  /** The organization of the space */
  org: {
    name: string;
  };
}
/**
 * Creates a new space using the Storyblok Management API
 * @param space - The space creation request data
 * @returns Promise<Space> - The created space data
 */
export const createSpace = async (space: CreateSpaceRequest): Promise<Space | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.post<{
      space: Space;
    }>('spaces', {
      body: JSON.stringify(space),
    });

    return data.space;
  }
  catch (error) {
    handleAPIError('create_space', error as Error, `Failed to create space ${space.name}`);
  }
};
