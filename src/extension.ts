import * as path from 'path';
import * as child_process from 'child_process';
import * as k8s from 'vscode-kubernetes-tools-api';
import * as chrome_launcher from 'chrome-launcher';
import * as chromeRemoteInterface from 'chrome-remote-interface';
import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
// const chromeRemoteInterface = require('chrome-remote-interface');

let chrome;
let chromeRemoteInterfaceClient: any;

export async function activate(context: vscode.ExtensionContext) {
  const provider = new KubernetesDashboardStepsViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(KubernetesDashboardStepsViewProvider.viewType, provider));

  const kubectl = await k8s.extension.kubectl.v1;
  if (!kubectl.available) {
      vscode.window.showErrorMessage(`kubectl not available.`);
      return;
  }

  const helm = await k8s.extension.helm.v1;
  if (!helm.available) {
    vscode.window.showErrorMessage(`helm not available.`);
    return;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.create-kind-cluster', () => {
      createKindCluster(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.prime-cluster', () => {
      createKubernetesDashboardNamespace(context, kubectl);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.install-kubernetes-dashboard-helm-chart', () => {
      installKubernetesDashboardHelmChart(context, kubectl, helm);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.launch', () => {
      launchKubernetesDashboard(context, kubectl);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.port-forward', () => {
      portForward(kubectl, 0);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.get-token', () => {
      getToken(context, kubectl);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand( 'vscode-kubernetes-dashboard.uninstall-kubernetes-dashboard-helm-chart', () => {
      uninstallKubernetesDashboardHelmChart(context, kubectl, helm);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-kubernetes-dashboard.pod.show', showInKubernetesDashboard.bind(null, kubectl))
  );

}

async function showInKubernetesDashboard(kubectl: k8s.API<k8s.KubectlV1>, target?: any) {
  // only works when && viewItem =~ /vsKubernetes\\.resource\\..*/i
  if (kubectl.available) {
    if (target && target.nodeType === 'folder.resource') {
      //
    } else if (target && target.nodeType === 'resource') {
      showResourceInKubernetesDashboard(target.kind.manifestKind.toLowerCase(), target.name, target.namespace);
    }
  }
}

function createKindCluster(context: vscode.ExtensionContext) {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Creating Kind cluster with 3 nodes (expect to take about 2 minutes).'
  }, (progress, token) => {
    return new Promise((resolve, reject) => {
      const kindTerminal = vscode.window.createTerminal({
        name: 'Kind'
      });
      kindTerminal.show(true);
      kindTerminal.sendText(
        `kind create cluster --config ${path.join(context.extensionPath, 'kubernetes', 'kind', 'kind-cluster-3-nodes.yml')}`
      );
      setTimeout(() => {
        resolve('Done');
      }, 120000);
    });
  });
}

function createKubernetesDashboardNamespace(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>) {
  console.log('Create Kubernetes Dashboard Namespace');
  if (kubectl.available) {
    kubectl.api.invokeCommand('create namespace kubernetes-dashboard')
    .then(value => {
      console.log(value);
      return kubectl.api.invokeCommand('config set-context --current --namespace=kubernetes-dashboard');
    }).then(value => {
      console.log(value);
      return createKubernetesDashboardServiceAccounts(context, kubectl);
    });
  }
}

function createKubernetesDashboardServiceAccounts(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>) {
  console.log('Create Kubernetes Dashboard Service Accounts');
  if (kubectl.available) {
    kubectl.api.invokeCommand(`apply -f ${path.join(context.extensionPath, 'kubernetes', 'kubectl', 'kubernetes-dashboard-service-account.yml')}`)
    .then(value => {
      console.log(value);
    });
  }
}

function installKubernetesDashboardHelmChart(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>, helm: k8s.API<k8s.HelmV1>) {
  console.log('Install Kubernetes Dashboard Helm Chart');
  if (helm.available) {
    helm.api.invokeCommand(`install kubernetes-dashboard ${path.join(context.extensionPath, 'kubernetes', 'helm', 'kubernetes-dashboard.tgz')} -n kubernetes-dashboard`)
    .then((value) => {
      if (value) {
        if (value.code === 0) {
          vscode.window.showInformationMessage(value.stdout, { modal: true });
          // portForward(kubectl, 60);
        } else {
          vscode.window.showErrorMessage(value.stderr, { modal: true });
        }
      }
    });
  }
}

function portForward(kubectl: k8s.API<k8s.KubectlV1>, delay: number) {
  if (kubectl.available) {
    kubectl.api.invokeCommand(`get pods -o jsonpath={.items[0].metadata.name} -n kubernetes-dashboard`).then((value) => {
      if (value) {
        if (value.code === 0) {
          vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Forwarding port 8443 in ${delay} seconds.`
          }, (progress, token) => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                let pf;
                if (process.platform === 'win32') {
                  pf = child_process.spawn(
                    'cmd',
                    [
                      '/C'
                      ,'start'
                      ,'kubectl'
                      ,'port-forward'
                      ,`${value.stdout.replace('\n', '')}`
                      ,'8443:8443'
                      ,'-n'
                      ,'kubernetes-dashboard'
                    ]
                  );
                } else {
                  pf = child_process.spawn(
                    'kubectl',
                    [
                      'port-forward'
                      ,`${value.stdout.replace('\n', '')}`
                      ,'8443:8443'
                      ,'-n'
                      ,'kubernetes-dashboard'
                    ]
                  );
                }

                pf.on('stderr', (data) => {
                  vscode.window.showErrorMessage(data);
                });

                pf.on('exit', (code) => {
                  if (code === 0) {
                    resolve(code);
                  } else {
                    reject(code);
                  }
                });
              }, (delay*1000));
            });
          });
        } else {
          vscode.window.showErrorMessage(value.stderr, { modal: true });
        }
      }
    });
  }
}

async function launchKubernetesDashboard(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>) {
  getToken(context, kubectl);
  chrome = await chrome_launcher.launch({
    chromeFlags: ['--app=https://127.0.0.1:8443/#/overview?namespace=default', '--window-size=1400,900', '--allow-insecure-localhost']
  });
  chromeRemoteInterfaceClient = await chromeRemoteInterface({
    port: chrome.port
  });
}

async function getToken(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>) {
  if (kubectl.available) {
    const versions = await ensureVersions(kubectl);
    if (versions) {
      if (parseInt(versions.serverVersion.major) === 1 && parseInt(versions.serverVersion.minor) >= 24) {
        kubectl.api.invokeCommand(`get secret admin-user-secret -n kubernetes-dashboard -o jsonpath={.data.token}`)
        .then(tokenOutput => {
          if (tokenOutput) {
            if (tokenOutput.code === 0) {
              const token = Buffer.from(tokenOutput.stdout, 'base64').toString('utf-8');
              vscode.env.clipboard.writeText(token);
              vscode.window.showInformationMessage(`Token copied to clipboard:\n${token}`);
            } else {
              vscode.window.showErrorMessage(tokenOutput.stderr);
            }
          }
        });
        return;
      }
    }
    kubectl.api.invokeCommand('get serviceaccount admin-user -n kubernetes-dashboard -o jsonpath={.secrets[0].name}')
    .then(secret => {
      if (secret) {
        if (secret.code === 0 ) {
          kubectl.api.invokeCommand(`get secret ${secret.stdout} -n kubernetes-dashboard -o jsonpath={.data.token}`)
          .then(tokenOutput => {
            if (tokenOutput) {
              if (tokenOutput.code === 0) {
                const token = Buffer.from(tokenOutput.stdout, 'base64').toString('utf-8');
                vscode.env.clipboard.writeText(token);
                vscode.window.showInformationMessage(`Token copied to clipboard:\n${token}`);
              } else {
                vscode.window.showErrorMessage(tokenOutput.stderr);
              }
            }
          });
        } else {
          vscode.window.showErrorMessage(secret.stderr);
        }
      }
    });
  }
}

async function ensureVersions(kubectl: k8s.API<k8s.KubectlV1>) {

  if (kubectl.available) {
    const versionsOutput = await kubectl.api.invokeCommand('version -o=json --short');
    if (versionsOutput && versionsOutput?.code === 0) {
      return JSON.parse(versionsOutput.stdout);
    }
  }

  return undefined;
}

function uninstallKubernetesDashboardHelmChart(context: vscode.ExtensionContext, kubectl: k8s.API<k8s.KubectlV1>, helm: k8s.API<k8s.HelmV1>) {
  console.log('Uninstall Kubernetes Dashboard Helm Chart');
  if (helm.available) {
    helm.api.invokeCommand('uninstall kubernetes-dashboard')
    .then((value) => {
      if (value) {
        if (value.code === 0) {
          vscode.window.showInformationMessage(value.stdout, { modal: true });
        } else {
          vscode.window.showErrorMessage(value.stderr, { modal: true });
        }
      }
    });
  }
}

async function showResourceInKubernetesDashboard(resourceType: string, podName: string, namespace?: string) {
  if (chromeRemoteInterfaceClient) {
    const { Page } = chromeRemoteInterfaceClient;

    // First navigate to the namespace resourceTypes
    await Page.navigate({
      url: `https://127.0.0.1:8443/#/${resourceType}?namespace=${namespace}`
    });

    setTimeout(async () => {
      // Then navigate to the resource
      await Page.navigate({
        url: `https://127.0.0.1:8443/#/${resourceType}/${namespace}/${podName}?namespace=${namespace}`
      });
    }, 100);

  }
}

class KubernetesDashboardStepsViewProvider implements vscode.WebviewViewProvider {

  public static readonly viewType = 'vscode-kubernetes-dashboard.steps';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      vscode.commands.executeCommand(data.command);
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <!--
    Use a content security policy to only allow loading images from https or from our extension directory,
    and only allow scripts that have a specific nonce.
  -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <link href="${styleResetUri}" rel="stylesheet">
  <link href="${styleVSCodeUri}" rel="stylesheet">
  <link href="${styleMainUri}" rel="stylesheet">

  <title>Kubernetes Dashboard Steps</title>
</head>
<body>
  <ul class="steps">
    <li class="step"><div style="display: flex;"><button id="ckc"   type="button">&#5125;</button> Create Kind cluster (Optional)</div></li>
    <li class="step"><div style="display: flex;"><button id="pm"    type="button">&#5125;</button> Prime cluster</div></li>
    <li class="step"><div style="display: flex;"><button id="ikdhc" type="button">&#5125;</button> Install Kubernetes Dashboard Helm chart</div></li>
    <li class="step"><div style="display: flex;"><button id="pf"    type="button">&#5125;</button> Port forward</div></li>
    <li class="step"><div style="display: flex;"><button id="l"     type="button">&#5125;</button> Launch Kubernetes Dashboard</div></li>
    <li class="step"><div style="display: flex;"><button id="gt"    type="button">&#5125;</button> Get token</div></li>
    <li class="step"><div style="display: flex;"><button id="ukdhc" type="button">&#5125;</button> Uninstall Kubernetes Dashboard Helm chart</div></li>
  </ul>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
      ;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
