const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs')

try {
    const makeOutputFile = core.getInput('make-output');
    let makeOutput = "";

    fs.readFile(makeOutputFile, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        makeOutput = data;

        var projectResults = [];
        var tests = makeOutput.split('./main.native --test');

        console.log(tests);
        for (var i = 1; i < tests.length; i++) {
            var projectName = "";
            if (i == 1)
                projectName = "Project 1";
            if (i == 2)
                projectName = "Project 2";

            var currentProject = {
                name: projectName,
                score: 0,
                maxScore: 0,
                hidden: false,
                passed: 0,
                failed: 0,
                tests: []
            };

            console.log(tests[i]);
            var testLines = tests[i].split('\n');

            var currentTest = null;
            for (var j = 0; j < testLines.length; j++) {
                var line = testLines[j].trim();

                // TODO Remove soon
                console.log("Line: " + line);
                
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

                if (line.endsWith('(hidden)')) {
                    continue;
                }

                if(line.indexOf('Leaving directory') > -1) {
                    // Set the project name to the name of the folder
                    var projectName = line.substring(line.lastIndexOf('/') + 1, line.lastIndexOf('\''));
                    currentProject.name = projectName;

                    projectResults.push(currentProject);
                    break;
                }

                if (line.indexOf('points') > -1) {
                    if (currentTest != null)
                        currentProject.tests.push(currentTest);

                    var name = line.split('(')[0].trim();
                    if (line.indexOf('points)') > -1) {
                        var score = parseInt(line.split('(')[1].split('/')[0]);
                        var maxScore = parseInt(line.split('(')[1].split('/')[1]);
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

                // Hidden test case likely
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


                if (line.startsWith('FAILED')) {
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
                if (line.startsWith('passed')) {
                    var name = line.split('-')[1].trim();

                    currentTest.subTests.push({
                        name: name,
                        passed: true,
                        message: ''
                    });

                    currentTest.failed += 1;
                    continue;
                }

                if (line.startsWith('Hidden')) {
                    currentTest.hidden = true;
                    continue;
                }

                if (line.startsWith('OK')) {
                    // All tests are fine

                    continue;
                }
            }
        }

        //var json = JSON.stringify(projectResults, null, 2);
        //console.log(`JSON`);
        //console.log(json);

        var markdown = `# Test Results`

        for (var i = 0; i < projectResults.length; i++) {
            var project = projectResults[i];
            markdown += `\n\n## ${project.name}\n\n`;
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
                var score = test.hidden ? '?' : `${test.score}/${test.maxScore}`;

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


        core.setOutput("markdown", markdown);

    });
    // Get the JSON webhook payload for the event that triggered the workflow
    //const payload = JSON.stringify(github.context.payload, undefined, 2)
    //console.log(`The event payload: ${payload}`);
} catch (error) {
    core.setFailed(error.message);
}