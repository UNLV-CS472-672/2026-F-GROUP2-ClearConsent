import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Never reset the developer stack or connect to a linked/remote database.
const root = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'clearconsent-db-test-'));
const cli = join(root, 'node_modules/supabase/dist/supabase.js');
const project = `clearconsent-ci-${process.pid}-${Date.now()}`;
const env = { ...process.env };
for (const key of Object.keys(env)) {
	if (/^(SUPABASE_|PG|DATABASE_URL|OPENAI_|RUN_MODEL_EVALS)/.test(key)) delete env[key];
}
function run(args, quiet = false) {
	console.log(`Supabase: ${args.join(' ')}`);
	const result = spawnSync(process.execPath, [cli, '--workdir', directory, ...args], {
		cwd: root,
		env,
		encoding: 'utf8',
		stdio: quiet ? 'pipe' : 'inherit'
	});
	if (result.error || result.status !== 0)
		throw new Error(
			`Disposable Supabase ${args[0]} failed (exit ${result.status}); check Docker availability and free ports 55420-55429.`
		);
}
let failure;
try {
	await cp(join(root, 'supabase'), join(directory, 'supabase'), {
		recursive: true,
		filter: (source) => !['.temp', '.branches'].some((name) => source.split(/[\\/]/).includes(name))
	});
	const configPath = join(directory, 'supabase/config.toml');
	const config = (await readFile(configPath, 'utf8'))
		.replace(/^project_id = .*$/m, `project_id = "${project}"`)
		.replace(/543(\d\d)/g, '554$1');
	await writeFile(configPath, config);
	run(
		[
			'start',
			'--exclude',
			'studio,imgproxy,inbucket,realtime,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta,gotrue,postgrest,kong'
		],
		true
	);
	run(['db', 'reset', '--local'], true);
	run(['db', 'lint', '--local', '--level', 'warning', '--fail-on', 'warning']);
	run(['test', 'db', '--local']);
} catch (error) {
	failure = error;
} finally {
	try {
		run(['stop', '--no-backup'], true);
		await rm(directory, { recursive: true, force: true });
	} catch (error) {
		console.error(`Cleanup failed; disposable project ${project} remains at ${directory}.`);
		failure = failure
			? new AggregateError([failure, error], 'Database checks and cleanup failed')
			: error;
	}
}

if (failure) throw failure;
