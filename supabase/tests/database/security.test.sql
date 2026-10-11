-- Synthetic fixtures only: run against the disposable migrated and seeded database.
-- The final rollback restores every fixture, including the deleted synthetic account.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- pgTAP counts assertions at finish(). lives_ok expects success; throws_ok checks
-- SQLSTATE, with null skipping exact error text that may vary between PostgreSQL versions.
select no_plan();
-- Seed identity 1111... owns the original fixtures; 2222... is the second user.
-- As administrator, add eeee... for the second user before exercising restricted roles.
insert into public.analyses(id,owner_id,source_type,source_text,summary,outcome) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','pasted_text','Synthetic policy','Synthetic summary','findings_identified');
-- Set both the database role and synthetic JWT claims to exercise grants and RLS.
-- These are database identity checks, not HTTP login or token-verification tests.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*) from public.privacy_preferences)::bigint, 1::bigint, 'owner reads seeded privacy_preferences');
select is((select count(*) from public.analyses)::bigint, 1::bigint, 'owner reads seeded analyses');
select is((select count(*) from public.findings)::bigint, 3::bigint, 'owner reads seeded findings');
select is((select count(*) from public.preference_evaluations)::bigint, 4::bigint, 'owner reads seeded preference_evaluations');
select lives_ok($test$insert into public.analyses(id,owner_id,source_type,source_text,summary,outcome) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','pasted_text','Synthetic policy','Synthetic summary','findings_identified')$test$, 'owner can insert analysis');
-- Use the same authorized parent for every malformed value so ownership cannot mask
-- a validation failure. SQLSTATE 23514 identifies the evidence CHECK constraint.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[null]'::jsonb)$test$, '23514', null, 'reject malformed evidence [null]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{}]'::jsonb)$test$, '23514', null, 'reject malformed evidence [{}]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[42]'::jsonb)$test$, '23514', null, 'reject malformed evidence [42]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[]'::jsonb)$test$, '23514', null, 'reject malformed evidence []');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','{}'::jsonb)$test$, '23514', null, 'reject malformed evidence {}');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','null'::jsonb)$test$, '23514', null, 'reject malformed evidence null');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":null}]'::jsonb)$test$, '23514', null, 'reject malformed evidence [{"excerpt":null}]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":42}]'::jsonb)$test$, '23514', null, 'reject malformed evidence [{"excerpt":42}]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":"   "}]'::jsonb)$test$, '23514', null, 'reject malformed evidence [{"excerpt":"   "}]');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":"Synthetic"},null]'::jsonb)$test$, '23514', null, 'reject malformed evidence [{"excerpt":"Synthetic"},null]');
-- JSON escapes preserve tabs/newlines as excerpt content rather than SQL whitespace.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":"\t"}]'::jsonb)$test$, '23514', null, 'reject tab-only excerpt');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":"\n\r"}]'::jsonb)$test$, '23514', null, 'reject newline-only excerpt');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":" \t\n\r "}]'::jsonb)$test$, '23514', null, 'reject mixed whitespace excerpt');
-- Positive control: an object with a nonblank excerpt passes the same constraint.
select lives_ok($test$insert into public.findings(id,analysis_id,category,plain_language_description,evidence) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb)$test$, 'valid evidence object accepted');
-- Surrounding whitespace is allowed when the excerpt contains meaningful text.
select lives_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','collection','Synthetic claim','[{"excerpt":" \tSynthetic policy\n "}]'::jsonb)$test$, 'nonblank excerpt with surrounding whitespace accepted');
-- Immutable results reject UPDATE and direct child DELETE with privilege error 42501.
select throws_ok($test$update public.analyses set summary='changed'$test$, '42501', null, 'immutable child or result privilege: update public.analyses');
select throws_ok($test$update public.findings set category='changed'$test$, '42501', null, 'immutable child or result privilege: update public.findings');
select throws_ok($test$update public.preference_evaluations set explanation='changed'$test$, '42501', null, 'immutable child or result privilege: update public.preference_evaluations');
select throws_ok($test$delete from public.findings$test$, '42501', null, 'immutable child or result privilege: delete public.findings');
select throws_ok($test$delete from public.preference_evaluations$test$, '42501', null, 'immutable child or result privilege: delete public.preference_evaluations');
-- Both parents belong to this owner. Error 23503 therefore proves the composite
-- foreign key rejects cross-analysis references independently of ownership isolation.
select throws_ok($test$insert into public.preference_evaluations(analysis_id,finding_id,preference_key,preference_value,indicator,explanation) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','b1111111-1111-4111-8111-111111111111','synthetic','"avoid"','conflict','Synthetic explanation')$test$, '23503', null, 'reject cross-analysis finding reference');
select lives_ok($test$insert into public.preference_evaluations(analysis_id,finding_id,preference_key,preference_value,indicator,explanation) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','ffffffff-ffff-4fff-8fff-ffffffffffff','synthetic','"avoid"','conflict','Synthetic explanation')$test$, 'same-analysis reference accepted');
-- Creating a row attributed to another owner must fail, even for an authenticated user.
select throws_ok($test$insert into public.analyses(id,owner_id,source_type,source_text,summary,outcome) values ('99999999-9999-4999-8999-999999999999','22222222-2222-4222-8222-222222222222','pasted_text','Synthetic policy','Synthetic summary','findings_identified')$test$, '42501', null, 'owner cannot spoof another owner');
reset role;
set local role authenticated;
-- Change claims as well as role to represent the independent second user.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.privacy_preferences)::bigint, 0::bigint, 'second user isolated for privacy_preferences');
select is((select count(*) from public.analyses)::bigint, 1::bigint, 'second user isolated for analyses');
select is((select count(*) from public.findings)::bigint, 0::bigint, 'second user isolated for findings');
select is((select count(*) from public.preference_evaluations)::bigint, 0::bigint, 'second user isolated for preference_evaluations');
-- RLS hides the other owner's row: DELETE affects zero rows instead of raising an error.
with removed as (delete from public.analyses where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning id) select is(count(*)::bigint, 0::bigint, 'second user cannot delete owner analysis') from removed;
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','collection','Synthetic','[{"excerpt":"Synthetic"}]')$test$, '42501', null, 'second user cannot insert owner finding');
-- Anonymous table access fails at the grant boundary despite previously set claims.
reset role; set local role anon;
select throws_ok($test$select * from public.privacy_preferences$test$, '42501', null, 'anonymous denied privacy_preferences');
select throws_ok($test$select * from public.analyses$test$, '42501', null, 'anonymous denied analyses');
select throws_ok($test$select * from public.findings$test$, '42501', null, 'anonymous denied findings');
select throws_ok($test$select * from public.preference_evaluations$test$, '42501', null, 'anonymous denied preference_evaluations');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
-- An owner may delete an analysis; its dependent findings and evaluations cascade.
select lives_ok($test$delete from public.analyses where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'$test$, 'owner deletes own analysis');
select is((select count(*) from public.findings where analysis_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')::bigint, 0::bigint, 'finding deletion cascade');
select is((select count(*) from public.preference_evaluations where analysis_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')::bigint, 0::bigint, 'evaluation deletion cascade');
reset role;
-- Administrator visibility proves the children were deleted, not merely hidden by RLS.
select is((select count(*) from public.findings where analysis_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')::bigint, 0::bigint, 'cascade verified without RLS filtering');
select is((select count(*) from public.preference_evaluations where analysis_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')::bigint, 0::bigint, 'evaluation cascade verified without RLS filtering');
-- Delete the synthetic owner to verify account-level cascades. The second user's
-- analysis must survive; rollback below restores all fixtures after the assertions.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.privacy_preferences where user_id='11111111-1111-4111-8111-111111111111')::bigint, 0::bigint, 'account cascade privacy_preferences');
select is((select count(*) from public.analyses where owner_id='11111111-1111-4111-8111-111111111111')::bigint, 0::bigint, 'account cascade analyses');
select is((select count(*) from public.findings)::bigint, 0::bigint, 'account cascade findings');
select is((select count(*) from public.preference_evaluations)::bigint, 0::bigint, 'account cascade evaluations');
select is((select count(*) from public.analyses where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')::bigint, 1::bigint, 'other user preserved by account deletion');
select * from finish(); rollback;
