const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const request = require('request');


try {
    const makeOutputFile = core.getInput('make-output');
    const token = core.getInput('token');
    const leaderboard = core.getInput('leaderboard');
    const teamName = core.getInput('teamname');

    let makeOutput = "";

    fs.readFile(makeOutputFile, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        makeOutput = data;

        var projectResults = [];
        var tests = makeOutput.split('./main.native --test');

        //console.log(tests);
        for (var i = 1; i < tests.length; i++) {
            var projectName = "";

            var currentProject = {
                name: projectName,
                score: 0,
                maxScore: 0,
                hidden: false,
                passed: 0,
                failed: 0,
                tests: []
            };

            //console.log(tests[i]);
            var testLines = tests[i].split('\n');

            var currentTest = null;
            for (var j = 0; j < testLines.length; j++) {
                var line = testLines[j];
                //console.log("Line: " + line);
                if (line.startsWith('Running test')) {
                    continue;
                }

                if (line.startsWith('-------'))
                    if (currentTest != null) {
                        currentProject.tests.push(currentTest);
                        continue;
                    }

                if (line.startsWith('Passed:')) {
                    var passed = parseInt(line.split(':')[1].split('/')[0]);
                    var total = parseInt(line.split(':')[1].split('/')[1]);
                    currentProject.passed = passed;
                    currentProject.failed = total - passed;
                    continue;
                }
                if (line.startsWith('Failed:')) {
                    continue;
                }

                if (line.startsWith('Score:')) {
                    var score = parseInt(line.split(':')[1].split('(')[0].split('/')[0])
                    var maxScore = parseInt(line.split(':')[1].split('(')[0].split('/')[1]);
                    currentProject.score = score;
                    currentProject.maxScore = maxScore;

                    continue;
                }

                if (line.trim().endsWith('(hidden)')) {
                    continue;
                }

                if (line.indexOf('Leaving directory') > -1) {
                    // Set the project name to the name of the folder
                    var projectName = line.substring(line.lastIndexOf('/') + 1, line.lastIndexOf('\''));
                    currentProject.name = projectName;
                    currentProject.folderName = projectName;
                    var isInvalidProject = false;
                    /* TODO SET SCORE FOR PROJECT WHEN RELEASED */
                    switch (currentProject.maxScore) {
                        case 67:
                            currentProject.name = "Project 1: Hellocaml";
                            break;
                        case 46:
                            currentProject.name = "Project 2: x86Lite";
                            break;
                        case 77:
                            currentProject.name = "Project 3: Compiling LLVM";
                            break;
                        case -2:
                            currentProject.name = "Project 4: Compiling Oat v.1";
                            break;
                        case 80:
                            currentProject.name = "Project 5: Compiling Full Oat";
                            break;
                        case 100:
                            currentProject.name = "Project 6: Dataflow Analysis and Register Allocation";
                            break;

                        default:
                            isInvalidProject = true;
                            break;

                    }

                    if (!isInvalidProject)
                        projectResults.push(currentProject);

                    break;
                }

                if (line.indexOf('points') > -1) {
                    if (currentTest != null)
                        currentProject.tests.push(currentTest);

                    var name = line.split('(')[0].trim();
                    var score = -1;
                    var maxScore = -1;

                    if (line.indexOf('points)') > -1) {
                        var scoreString = line.split('(')[1].split('/')[0].trim();

                        if (scoreString != "?")
                            score = parseInt(scoreString);

                        maxScore = parseInt(line.split('(')[1].split('/')[1]);
                    }

                    currentTest = {
                        name: name,
                        score: score,
                        maxScore: maxScore,
                        hidden: false,
                        passed: 0,
                        failed: 0,
                        subTests: []
                    };
                    continue;
                }

                // Hidden test case likely because it didnt get caught by the above 
                // TODO Check by "?/"" maybe?
                if (line.endsWith(':')) {
                    if (currentTest != null)
                        currentProject.tests.push(currentTest);

                    var name = line.split(':')[0].trim();
                    var score = -1;
                    var maxScore = -1;

                    currentTest = {
                        name: name,
                        score: score,
                        maxScore: maxScore,
                        hidden: false,
                        passed: 0,
                        failed: 0,
                        subTests: []
                    };
                    continue;
                }

                // TODO Check this case
                if (!currentTest)
                    continue;

                if (line.trim().startsWith('FAILED')) {
                    var name = line.split(':')[0].split('-')[1].trim();
                    var message = line.substring(line.indexOf(':') + 1).trim();

                    currentTest.subTests.push({
                        name: name,
                        passed: false,
                        message: message
                    });

                    currentTest.passed += 1;
                    continue;
                }
                if (line.trim().startsWith('passed')) {
                    var name = line.split('-')[1].trim();

                    currentTest.subTests.push({
                        name: name,
                        passed: true,
                        message: ''
                    });

                    currentTest.failed += 1;
                    continue;
                }

                if (line.trim().startsWith('Hidden')) {
                    currentTest.hidden = true;
                    continue;
                }

                if (line.trim().startsWith('OK')) {
                    // All tests are fine

                    continue;
                }

                // TODO This misses some student cases
                // It fell trough all the cases, so it's likely a new test (without a : at the end)
                if (currentTest != null) {
                    currentProject.tests.push(currentTest);
                }

                var name = line.trim();
                var score = -1;
                var maxScore = -1;

                currentTest = {
                    name: name,
                    score: score,
                    maxScore: maxScore,
                    hidden: false,
                    passed: 0,
                    failed: 0,
                    subTests: []
                };
            }
        }

        //var json = JSON.stringify(projectResults, null, 2);
        //console.log(`JSON`);
        //console.log(json);

        var markdown = `# Test Results`

        // Print projects from projectId descending
        for (var projectId = 6; projectId > 0; projectId--) {
            for (var i = 0; i < projectResults.length; i++) {
                var project = projectResults[i];

                if(project.projectId != projectId)
                    continue;

                markdown += `\n\n## ${project.name} (${project.folderName})\n\n`;
                // Round project score percent to 2 decimal places
                var projectScorePercent = Math.round((project.score / project.maxScore) * 10000) / 100;
                markdown += `Score ${project.score} of ${project.maxScore} (${projectScorePercent}%)\n`;
                markdown += `Passed: ${project.passed}\n`;
                markdown += `Failed: ${project.failed}\n`;

                // Make the table collapsable
                markdown += `<details><summary>Test details</summary>\n\n`;

                // Create markdown table for each test
                markdown += `| Test | Score | Passed | Failed | Result |\n`;
                markdown += `| ---- | ----- | ------ | ------ | ------ |\n`;

                for (var j = 0; j < project.tests.length; j++) {
                    var test = project.tests[j];
                    var name = test.score == test.maxScore ? `**${test.name}**` : test.name;
                    var emoteResult = test.score == test.maxScore ? ':heavy_check_mark:' : ':x:';

                    var passedCount = test.score == test.maxScore ? '**All**' : `${test.passed}`;
                    var failedCount = test.score == test.maxScore ? '**None**' : `${test.failed}`;
                    var score = test.hidden ? `?/${test.maxScore}` : `${test.score}/${test.maxScore}`;

                    if (test.hidden) {
                        emoteResult = ':question:';
                        passedCount = '?';
                        failedCount = '?';
                    }
                    else if (test.maxScore < 0) {
                        score = "user-defined";
                    }

                    markdown += `| ${name} | ${score} | ${passedCount} | ${failedCount} | ${emoteResult} |\n`;

                    if (test.subTests.length > 0) {
                        for (var k = 0; k < test.subTests.length; k++) {
                            var subTest = test.subTests[k];

                            var subTestPassResult = subTest.passed ? ':heavy_check_mark:' : '';
                            var subTestFailResult = subTest.passed ? '' : ':x:';

                            var subTestMessage = subTest.passed ? '' : subTest.message;
                            markdown += `|   - ${subTest.name} | | ${subTestPassResult} | ${subTestFailResult} | ${subTestMessage} |\n`;
                        }
                    }
                }

                markdown += `</details>\n\n`;
            }
        }


        core.setOutput("markdown", markdown);
        console.log("Leaderboard: " + leaderboard);
        // Only report leaderboard if its been set
        if (leaderboard == "true") {

            console.log("Doing leaderboard");

            var markdownSummary = `# Test Results Summary for: ${teamName}\n\n`;
            markdownSummary += `| Project | Score | Passed | Failed |\n`;
            markdownSummary += `| ------- | ----- | ------ | ------ |\n`;


            var summaryJson = {
                teamName: teamName,
                projects: []
            };

            for (var i = 0; i < projectResults.length; i++) {
                var project = projectResults[i];
                markdownSummary += `| ${project.name} | ${project.score}/${project.maxScore} | ${project.passed} | ${project.failed} |\n`;

                // Project detecting by the amount of max score
                // TODO make sure this holds for all 6 projects
                var projectId = -1;
                switch (project.maxScore) {
                    case 67:
                        projectId = 1;
                        break;
                    case 46:
                        projectId = 2;
                        break;
                    default:
                        projectId = 3;
                }

                // Add only if the projectId wasnt added yet
                if (summaryJson.projects.filter(p => p.projectId == projectId).length == 0) {

                    summaryJson.projects.push({
                        projectId: projectId,
                        score: project.score,
                        maxScore: project.maxScore,
                        passed: project.passed,
                        failed: project.failed,
                        dateTime: new Date().toISOString()
                    });
                }
            }


            // Create issue in a specific repository
            const context = github.context;

            // Print json in collapsable section
            markdownSummary += `<details><summary>JSON</summary>\n\n`;
            markdownSummary += `\`\`\`json\n${JSON.stringify(summaryJson, null, 2)}\n\`\`\`\n`;
            markdownSummary += `</details>\n\n`;

            // Json string
            var jsonString = JSON.stringify(summaryJson, null, 2);
            console.log(jsonString);

            // Call web rest api to upload jsonString
            var url = "https://cdhs22.battlerush.dev/api/test";

            var options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(summaryJson, null, 2)
            };

            request.post(url, { json: summaryJson }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                }
            });
        }
    });

} catch (error) {
    core.setFailed(error.message);
}
