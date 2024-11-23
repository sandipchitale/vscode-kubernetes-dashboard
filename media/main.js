/* eslint-disable no-undef */
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();

    const idToCommandMap = {
        'pm':    'vscode-kubernetes-dashboard.prime-cluster',
        'ikdhc': 'vscode-kubernetes-dashboard.install-kubernetes-dashboard-helm-chart',
        'pf':    'vscode-kubernetes-dashboard.port-forward',
        'l':     'vscode-kubernetes-dashboard.launch',
        'gt':    'vscode-kubernetes-dashboard.get-token',
        'ukdhc': 'vscode-kubernetes-dashboard.uninstall-kubernetes-dashboard-helm-chart',
    };

    function postMessage(event) {
        vscode.postMessage({ command: idToCommandMap[event.target.id] });
    }

    // document.querySelector('#ckc').addEventistener('click', postMessage);
    document.querySelector('#pm').addEventListener('click', postMessage);
    document.querySelector('#ikdhc').addEventListener('click', postMessage);
    document.querySelector('#pf').addEventListener('click', postMessage);
    document.querySelector('#l').addEventListener('click', postMessage);
    document.querySelector('#gt').addEventListener('click', postMessage);
    document.querySelector('#ukdhc').addEventListener('click', postMessage);
}());


