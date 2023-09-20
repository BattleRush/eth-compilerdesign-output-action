const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const request = require('request');


try {
    const makeOutputFile = core.getInput('make-output');
    const token = core.getInput('token');

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
            var firstPointsEntryDetected = false;
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

                if (line.startsWith('Score:') && line.indexOf('(given)') > -1) {
                    var score = parseInt(line.split(':')[1].split('(')[0].split('/')[0]);
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
                            currentProject.projectId = 1;
                            break;
                        case 46:
                            currentProject.name = "Project 2: x86Lite";
                            currentProject.projectId = 2;
                            break;
                        case 77:
                            currentProject.name = "Project 3: Compiling LLVM";
                            currentProject.projectId = 3;
                            break;
                        case 80:
                            currentProject.name = "Project 4: Compiling Oat v.1";
                            currentProject.projectId = 4;
                            break;
                        case 81: // Will be 80
                            currentProject.name = "Project 5: Compiling Full Oat";
                            currentProject.projectId = 5;
                            break;
                        case 100:
                            currentProject.name = "Project 6: Dataflow Analysis and Register Allocation";
                            currentProject.projectId = 6;
                            break;

                        default:
                            isInvalidProject = true;
                            currentProject.name = "Invalid Project [Unknown total score amount]";
                            currentProject.projectId = -1;
                            break;

                    }

                    // check if current project tests contains a test with the name "subtype unit tests"
                    // if it does, then we need to set the project name to "Project 5: Compiling Full Oat"
                    // and set the project id to 5
                    if (!isInvalidProject) {
                        for (var k = 0; k < currentProject.tests.length; k++) {
                            if (currentProject.tests[k].name == "subtype unit tests") {
                                currentProject.name = "Project 5: Compiling Full Oat";
                                currentProject.projectId = 5;
                                break;
                            }
                        }
                    }                  

                    projectResults.push(currentProject);

                    break;
                }

                if (line.indexOf('points') > -1) {
                    firstPointsEntryDetected = true;
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

                if(!firstPointsEntryDetected)
                    continue; // As first the logs are output we just ignore until we see an entry containing "points" its not perfect but it works

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

                    currentTest.failed += 1;
                    continue;
                }
                if (line.trim().startsWith('passed')) {
                    var name = line.split('-')[1].trim();

                    currentTest.subTests.push({
                        name: name,
                        passed: true,
                        message: ''
                    });

                    currentTest.passed += 1;
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
        for (var projectId = 6; projectId >= -1; projectId--) {
            for (var i = 0; i < projectResults.length; i++) {
                var project = projectResults[i];

                if (project.projectId != projectId)
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

                    var passedCount = test.failed == 0 ? '**All**' : `${test.passed} :heavy_check_mark:`;
                    var failedCount = test.failed == 0 ? '**None**' : `${test.failed} :x:`;
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
    });

} catch (error) {
    core.setFailed(error.message);
}
