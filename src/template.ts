import { LaunchReport, TestResult } from ".";

export default ({ reports, offset, limit }) => `
<!DOCTYPE html><html>
<head>
    <title>CI Insights</title>
    <meta name="viewport" content="initial-scale=.55">
    <style>
    body { margin: 0; padding: 2em 4em; background: #fff; font: 14px/1.25 sans-serif; }
    h1 { padding: 0 0 .33em; margin: 0 0 1em; border-bottom: 1px solid #ccc; }
    a { text-decoration: none; color: #55e; }
    div { border-bottom: 1px solid #ccc; }
    </style>
    <link rel="icon" href="data:,"><!-- suppress favicon.ico fetching -->
</head>
<body>
    <h1>Failed tests in runs [${offset}, ${offset+limit})</h1>
    ${reports.map(htmlReport).join('\n')}
    <p>
    <a href="?offset=${offset - limit}">Previous</a>
    <a href="?offset=${offset + limit}">Next</a>
    </p>
</body>
</html>
`;

function htmlReport(report: LaunchReport) {
    let message = `Failed ${report.failedTests.length} tests`;
    if (report.failedTests.length == 0) {
        message = "No failed tests";
    }

    return `
    <div>
    <a href="${report.allureURL}" target="_blank"><h3>#${report.id} at ${report.s3Key} (${report.buildType})</h3></a>
    <p>${message}</p>
    <ul>
        ${report.failedTests.map(htmlTest).join('\n')}
    </ul>
    </div>
    `;
}

function htmlTest(test: TestResult) {
    return `<li>${test.id}</li>`;
}
