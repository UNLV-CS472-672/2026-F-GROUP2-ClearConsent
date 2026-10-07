-- What this migration does, in plain language:
-- Findings store their evidence as JSON. This adds a database rule so malformed
-- evidence cannot be saved, even if a caller skips the application's validation.
--
-- Evidence must be a list with at least one object. Every object must contain an
-- "excerpt" field holding text with at least one non-whitespace character.
-- Extra fields are allowed. One invalid item makes the entire list invalid.
-- For example, [{"excerpt":"Synthetic policy"}] passes; [null], [{}], [42],
-- an empty list, and excerpts containing only spaces, tabs, or newlines fail.
--
-- The function below answers true or false. "immutable" means its answer depends
-- only on the supplied JSON, not on database rows or the current user. An empty
-- search_path prevents it from accidentally looking up objects in other schemas.
-- Missing fields are checked explicitly because SQL NULL does not behave like
-- an ordinary value in comparisons.
--
-- Permission to run the function is removed from the default public role and
-- given to authenticated users, who need it when the database checks their inserts.
-- This does not grant access to other users' findings; existing table permissions
-- and ownership policies still control which rows a user can access.
--
-- Finally, the old evidence constraint is replaced with this stricter rule.
-- PostgreSQL checks existing rows as well as future writes. If stored evidence
-- is invalid, the migration fails rather than changing or deleting that evidence.
-- This is the minimum evidence shape; issue #22 tracks further contract decisions.
--
-- Minimum persisted evidence shape from the existing seed/design. #22 owns extensions.
create function public.evidence_objects_valid(value jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
 -- Guard array-only functions, require at least one item, and reject the whole
 -- array if any element is invalid.
 select case when jsonb_typeof(value) = 'array' then
  jsonb_array_length(value) > 0 and not exists (
   select 1 from jsonb_array_elements(value) as item
   -- Missing keys yield SQL NULL; IS DISTINCT FROM catches them where a normal
   -- comparison could let an object without an excerpt pass.
   where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'excerpt') is distinct from 'string'
      -- Require a non-whitespace character: btrim alone misses tabs and newlines.
      or (item->>'excerpt') !~ '[^[:space:]]'
  )
 else false end;
$$;
revoke all on function public.evidence_objects_valid(jsonb) from public;
grant execute on function public.evidence_objects_valid(jsonb) to authenticated;
-- Adding the stricter constraint validates existing rows too. Invalid stored
-- evidence stops the migration instead of silently rewriting or discarding data.
alter table public.findings drop constraint findings_evidence_check;
alter table public.findings add constraint findings_evidence_check
 check (public.evidence_objects_valid(evidence));
