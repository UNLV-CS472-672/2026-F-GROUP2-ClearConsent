-- Synthetic fixtures only: checks the Stage 2 finding fields added by
-- 20261019120000_add_consolidated_finding_fields.sql. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
-- As administrator, add a parent analysis for seed owner 1111... so ownership cannot mask a
-- constraint failure. SQLSTATE 23514 identifies a CHECK constraint.
insert into public.analyses(id,owner_id,source_type,source_text,summary,outcome) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','pasted_text','Synthetic policy','Synthetic summary','findings_identified');
-- Existing seed rows stay valid and get the defaults.
select is((select count(*) from public.findings where effect is null and not ambiguous and not conditional and purpose_types = '{}' and recipient_types = '{}' and relevant_preferences = '{}')::bigint, 3::bigint, 'seed findings keep valid defaults');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
-- Positive control: a full Stage 2 row inserts through the existing grants and RLS policy.
select lives_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,recipients,condition_note,effect,conditional,purpose_types,recipient_types,relevant_preferences) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Location is shared with ad partners only if personalized ads are on.','[{"excerpt":"Synthetic policy","startOffset":0,"endOffset":16,"passageId":"P001","match":"exact"}]'::jsonb,array['ad partners'],'Only if personalized ads are on.','exposes',true,array['advertising'],array['advertiser'],array['sharing'])$test$, 'full Stage 2 finding accepted');
select lives_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,uncertainty_note,effect,ambiguous) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','retention','Messages are kept as long as necessary.','[{"excerpt":"Synthetic policy"}]'::jsonb,'No period is given.','exposes',true)$test$, 'ambiguous finding with a note accepted');
select lives_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,effect) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','security_practices','Data is encrypted in transit.','[{"excerpt":"Synthetic policy"}]'::jsonb,'protects')$test$, 'protects effect accepted');
-- Category is a fixed list.
select lives_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','user_rights','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb)$test$, 'user_rights category accepted');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','third_party_sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb)$test$, '23514', null, 'reject category outside the fixed list');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb)$test$, '23514', null, 'reject blank category');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Collection','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb)$test$, '23514', null, 'reject category with different case');
-- Effect is exposes, protects, or null.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,effect) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,'neutral')$test$, '23514', null, 'reject unknown effect');
-- A flag must come with a nonblank note.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,ambiguous) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','retention','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,true)$test$, '23514', null, 'reject ambiguous without uncertainty note');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,ambiguous,uncertainty_note) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','retention','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,true,E' \t\n')$test$, '23514', null, 'reject ambiguous with blank uncertainty note');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,conditional) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,true)$test$, '23514', null, 'reject conditional without condition note');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,conditional,condition_note) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,true,'  ')$test$, '23514', null, 'reject conditional with blank condition note');
-- Fixed-value arrays reject unknown and null elements.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,purpose_types) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','use','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,array['marketing'])$test$, '23514', null, 'reject unknown purpose type');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,purpose_types) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','use','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,array['service',null])$test$, '23514', null, 'reject null purpose type');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,recipient_types) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,array['ad_network'])$test$, '23514', null, 'reject unknown recipient type');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,recipient_types) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,array[null]::text[])$test$, '23514', null, 'reject null recipient type');
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,relevant_preferences) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,array[null]::text[])$test$, '23514', null, 'reject null relevant preference');
-- Not-null flags reject an explicit null.
select throws_ok($test$insert into public.findings(analysis_id,category,plain_language_description,evidence,ambiguous) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','sharing','Synthetic claim','[{"excerpt":"Synthetic policy"}]'::jsonb,null)$test$, '23502', null, 'reject null ambiguous flag');
-- Findings stay immutable, including the new columns.
select throws_ok($test$update public.findings set effect='protects'$test$, '42501', null, 'new columns cannot be updated');
reset role;
select * from finish();
rollback;
