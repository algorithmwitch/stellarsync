-- PART 1: Workspace pillar taxonomy as jsonb
-- Convert default_pillars to jsonb structured objects

alter table public.workspace_settings
  add column if not exists default_pillars jsonb default '[]'::jsonb;

-- Migrate existing text/default_pillars values to jsonb objects
update public.workspace_settings
set default_pillars = (
  select coalesce(jsonb_agg(
    case
      when lower(trim(value)) = 'advocacy' then
        jsonb_build_object('name', 'Advocacy', 'slug', 'advocacy', 'icon', 'ph-megaphone', 'color', '#c77dff', 'enabled', true)
      when lower(trim(value)) = 'community' then
        jsonb_build_object('name', 'Community', 'slug', 'community', 'icon', 'ph-users-three', 'color', '#00ffaa', 'enabled', true)
      when lower(trim(value)) = 'wellness' then
        jsonb_build_object('name', 'Wellness', 'slug', 'wellness', 'icon', 'ph-heart', 'color', '#00f0ff', 'enabled', true)
      when lower(trim(value)) = 'leadership' then
        jsonb_build_object('name', 'Leadership', 'slug', 'leadership', 'icon', 'ph-crown', 'color', '#ffd700', 'enabled', true)
      when lower(trim(value)) = 'authority' then
        jsonb_build_object('name', 'Authority', 'slug', 'authority', 'icon', 'ph-megaphone', 'color', '#c77dff', 'enabled', true)
      when lower(trim(value)) = 'distribution' then
        jsonb_build_object('name', 'Distribution', 'slug', 'distribution', 'icon', 'ph-users-three', 'color', '#00ffaa', 'enabled', true)
      when lower(trim(value)) = 'identity' then
        jsonb_build_object('name', 'Identity', 'slug', 'identity', 'icon', 'ph-heart', 'color', '#00f0ff', 'enabled', true)
      when lower(trim(value)) = 'application' then
        jsonb_build_object('name', 'Application', 'slug', 'application', 'icon', 'ph-crown', 'color', '#ffd700', 'enabled', true)
      when lower(trim(value)) = 'education' then
        jsonb_build_object('name', 'Education', 'slug', 'education', 'icon', 'ph-book-open', 'color', '#b25fff', 'enabled', true)
      when lower(trim(value)) = 'promotion' then
        jsonb_build_object('name', 'Promotion', 'slug', 'promotion', 'icon', 'ph-sparkle', 'color', '#f472b6', 'enabled', true)
      else
        jsonb_build_object('name', initcap(trim(value)), 'slug', lower(regexp_replace(trim(value), '[^a-zA-Z0-9]+', '-', 'g')), 'icon', 'ph-sparkle', 'color', '#c77dff', 'enabled', true)
    end
    order by ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(default_pillars) = 'array' and default_pillars::text <> '[]'::text then
        case
          when default_pillars#>>'{}' like '[%' then
            -- already a jsonb array of strings or objects
            case
              when (default_pillars->0)::text like '"%"' then default_pillars
              else '[]'::jsonb
            end
          else '[]'::jsonb
        end
      when jsonb_typeof(default_pillars) = 'string' then
        to_jsonb(string_to_array(default_pillars#>>'{}', ','))
      else '[]'::jsonb
    end
  ) with ordinality as t(value, ordinality)
)
where default_pillars is null
   or default_pillars = '[]'::jsonb
   or (jsonb_typeof(default_pillars) = 'array' and (default_pillars->0)::text like '"%"');

-- Set GPE workspace to canonical pillars
update public.workspace_settings
set default_pillars = '[
  {"name":"Advocacy","slug":"advocacy","icon":"ph-megaphone","color":"#c77dff","enabled":true},
  {"name":"Community","slug":"community","icon":"ph-users-three","color":"#00ffaa","enabled":true},
  {"name":"Wellness","slug":"wellness","icon":"ph-heart","color":"#00f0ff","enabled":true},
  {"name":"Leadership","slug":"leadership","icon":"ph-crown","color":"#ffd700","enabled":true}
]'::jsonb
where workspace_id in (
  select id from public.workspaces
  where lower(coalesce(slug, '')) = 'gpe'
);
