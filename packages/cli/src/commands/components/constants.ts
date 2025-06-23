export interface SpaceComponent {
  name: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  id: number;
  schema: Record<string, any>;
  image?: string;
  preview_field?: string;
  is_root?: boolean;
  is_nestable?: boolean;
  preview_tmpl?: string;
  all_presets?: Record<string, unknown>;
  preset_id?: number;
  real_name?: string;
  component_group_uuid?: string;
  color: null;
  internal_tags_list: SpaceComponentInternalTag[];
  internal_tag_ids: string[];
  content_type_asset_preview?: string;
}

export interface SpaceComponentGroup {
  name: string;
  id: number;
  uuid: string;
  parent_id: number | null;
  parent_uuid: string | null;
}

export interface SpaceComponentPreset {
  id: number;
  name: string;
  preset: Record<string, unknown>;
  component_id: number;
  space_id: number;
  created_at: string;
  updated_at: string;
  image: string;
  color: string;
  icon: string;
  description: string;
}

export interface SpaceComponentInternalTag {
  id: number;
  name: string;
  object_type?: 'asset' | 'component';
}

export interface SpaceData {
  components: SpaceComponent[];
  groups: SpaceComponentGroup[];
  presets: SpaceComponentPreset[];
  internalTags: SpaceComponentInternalTag[];
}

export interface SpaceDataState {
  local: SpaceData;
  target: {
    components: Map<string, SpaceComponent>;
    tags: Map<string, SpaceComponentInternalTag>;
    groups: Map<string, SpaceComponentGroup>;
    presets: Map<string, SpaceComponentPreset>;
  };
}
