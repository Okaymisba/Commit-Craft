const vscode = require("vscode");
const axios = require("axios");
const { exec } = require("child_process");

async function generateCommitMessage(diff) {
    try {
        const response = await axios.post(
            "https://incredible-orsola-okaymisba-e3cb46e8.koyeb.app/generate-commit",
            { diff }
        );

        // handle various shapes returned by the API. The backend may return
        // a plain string, an array, or an object containing the message under
        // different keys (`message`, `commit`, `commit_message`, etc.).
        let data = response.data;

        if (Array.isArray(data)) {
            data = data[0];
        }

        if (typeof data === "object" && data !== null) {
            data = data.message || data.commit || data.commit_message || JSON.stringify(data);
        }

        return String(data);
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
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);

        if (!git || git.repositories.length === 0) {
            vscode.window.showErrorMessage("No Git repository found.");
            return;
        }

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

            // set loading context so contributes menu shows the loading button
            await vscode.commands.executeCommand('setContext', 'commitCraft.loading', true);
            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "Generating commit message",
                        cancellable: false,
                    },
                    async (progress) => {
                        progress.report({ message: "Fetching staged git diff..." });

                        const stagedDiff = await new Promise((resolve, reject) => {
                            exec("git diff --staged", { cwd: repoPath }, (error, stdout, stderr) => {
                                if (error || stderr) {
                                    return reject({ error, stderr });
                                }
                                resolve(stdout || "");
                            });
                        }).catch((err) => {
                            console.error("Git diff error:", err.error || err, err.stderr || "");
                            vscode.window.showErrorMessage("Error getting staged git diff.");
                            return null;
                        });

                        if (!stagedDiff) return;

                        if (!stagedDiff.trim()) {
                            vscode.window.showInformationMessage("No staged changes to commit.");
                            return;
                        }

                        try {
                            progress.report({ message: "Generating commit message..." });

                            // Attempt to show a temporary placeholder in the commit input box
                            try {
                                const gitExtension = vscode.extensions.getExtension("vscode.git");
                                if (gitExtension && !gitExtension.isActive) {
                                    await gitExtension.activate();
                                }
                                const git = gitExtension && gitExtension.exports && gitExtension.exports.getAPI ? gitExtension.exports.getAPI(1) : null;
                                const gitRepo = git && git.repositories && git.repositories[0];
                                if (gitRepo) {
                                    gitRepo.inputBox.value = "Generating commit message...";
                                }
                            } catch (e) {
                                console.warn("Could not set temporary commit input value:", e.message || e);
                            }

                            const commitMessage = await generateCommitMessage(stagedDiff.trim());

                            await setCommitMessage(commitMessage);
                        } catch (error) {
                            vscode.window.showErrorMessage(error.message || "Failed to generate commit message.");
                        }
                    }
                );
            } finally {
                await vscode.commands.executeCommand('setContext', 'commitCraft.loading', false);
            }
        }
    );

    context.subscriptions.push(disposable);
}

module.exports = {
    activate,
    generateCommitMessage,
    setCommitMessage,
};
