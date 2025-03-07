const vscode = require("vscode");
const axios = require("axios");
const { exec } = require("child_process");

async function generateCommitMessage(diff) {
    try {
        const response = await axios.post(
            "https://known-meadowlark-okaymisba-50e4c01e.koyeb.app/generate-commit",
            { diff }
        );
        console.log("Generated commit message:", response.data);
        return Array.isArray(response.data) ? response.data[0] : response.data;
    } catch (error) {
        console.error("Failed to generate commit message:", error);
        throw new Error("Failed to generate commit message.");
    }
}

async function setCommitMessage(message) {
    try {
        const gitExtension = vscode.extensions.getExtension("vscode.git");

        if (!gitExtension) {
            vscode.window.showErrorMessage("Git extension not found.");
            return;
        }

        if (!gitExtension.isActive) {
            console.log("Activating Git extension...");
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);

        if (!git || git.repositories.length === 0) {
            vscode.window.showErrorMessage("No Git repository found.");
            return;
        }

        console.log("Setting commit message:", message);

        const gitRepo = git.repositories[0];

        if (gitRepo) {
            gitRepo.inputBox.value = message;
        } else {
            vscode.window.showErrorMessage("Could not find Git repository.");
        }

    } catch (error) {
        vscode.window.showErrorMessage("Error setting commit message: " + error.message);
    }
}

function activate(context) {
    let disposable = vscode.commands.registerCommand(
        "commitMessageGenerator.generateCommitMessage",
        async function () {
            const repoPath = vscode.workspace.rootPath;

            if (!repoPath) {
                vscode.window.showErrorMessage("No workspace folder found.");
                return;
            }

            console.log("Fetching staged git diff...");

            exec("git diff --staged", { cwd: repoPath }, async (error, stdout, stderr) => {
                if (error || stderr) {
                    vscode.window.showErrorMessage("Error getting staged git diff.");
                    console.error("Git diff error:", error, stderr);
                    return;
                }

                if (!stdout.trim()) {
                    vscode.window.showInformationMessage("No staged changes to commit.");
                    return;
                }

                try {
                    console.log("Staged diff retrieved. Generating commit message...");
                    const commitMessage = await generateCommitMessage(stdout.trim());

                    console.log("Generated commit message:", commitMessage);

                    await setCommitMessage(commitMessage);
                } catch (error) {
                    vscode.window.showErrorMessage(error.message);
                }
            });
        }
    );

    context.subscriptions.push(disposable);
}

module.exports = {
    activate,
};
