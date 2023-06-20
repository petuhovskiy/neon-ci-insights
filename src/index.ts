import { Client } from '@neondatabase/serverless';
import template from './template';
interface Env { DATABASE_URL: string; }

export interface TestResult {
	id: string;
	data: any;
}

function isFailedTest(obj: any): boolean {
	return obj && obj.status && (typeof obj.status === "string") && (obj.status !== 'passed' && obj.status !== 'skipped');
}

function walkTests(obj: any, path: string, predicate: (obj: any) => boolean): Array<TestResult> {
	if (obj.children && obj.children.length) {
		const results: Array<TestResult> = [];
		for (const child of obj.children) {
			if (child.name && typeof child.name === "string") {
				results.push(...walkTests(child, path + '::' + child.name, predicate));
			}
		}
		return results;
	}

	if (predicate(obj)) {
		return [{ id: path, data: obj }];
	}

	return [];
}

/*
pr_number=$(jq --raw-output .pull_request.number "$GITHUB_EVENT_PATH" || true)
if [ "${pr_number}" != "null" ]; then
	key=pr-${pr_number}
elif [ "${GITHUB_REF}" = "refs/heads/main" ]; then
	# Shortcut for a special branch
	key=main
else
	key=branch-$(echo ${GITHUB_REF#refs/heads/} | tr -c "[:alnum:]._-" "-")
fi
*/

function referenceToKey(ref: string): string {
	// refs/pull/2794/merge
	if (ref.startsWith('refs/pull/')) {
		return 'pr-' + ref.substring(10).slice(0, -6);
	}
	if (ref == "refs/heads/main") {
		return "main";
	}
	if (ref.startsWith('refs/heads/')) {
		return 'branch-' + ref.substring(11);
	}
	return ref;
}

export interface LaunchReport {
	id: number;
	buildType: string;
	failedTests: Array<TestResult>;
	reference: string;
	revision: string;
	s3Key: string;
	allureURL: string;
}

function createReport(row: any): LaunchReport {
	const failedTests = walkTests(row.data, '', isFailedTest);
	const s3Key = referenceToKey(row.reference.trim());
	const allureURL = `https://neon-github-public-dev.s3.amazonaws.com/reports/${s3Key}/debug/latest/history/history-trend.json`;
	return {
		id: row.id,
		buildType: row.build_type.trim(),
		failedTests,
		reference: row.reference.trim(),
		revision: row.revision,
		s3Key,
		allureURL,
	};
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
	const { searchParams } = new URL(request.url)
    const client = new Client(env.DATABASE_URL);
    await client.connect();


	let limit = parseInt(searchParams.get('limit') || "") || 20;
	if (limit > 150 || limit <= 0) {
		limit = 20;
	}

	let offset = parseInt(searchParams.get('offset') || "") || 0;
	if (offset < 0) {
		offset = 0;
	}

	const { rows } = await client.query('SELECT * FROM regress_test_results ORDER BY id DESC LIMIT $1 OFFSET $2', [limit, offset]);
	// console.log(rows);
	const reports = rows.map(createReport);
    // const { rows: [{ now }] } = await client.query('select now();');
    ctx.waitUntil(client.end());  // this doesn’t hold up the response

	return new Response(template({ offset, limit, reports }), { headers: { 'Content-Type': 'text/html; charset=utf-8', } });
    // return new Response(JSON.stringify(results, null, 2));
  }
}
