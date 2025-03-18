import { spawnSync } from 'child_process'
import IPC from 'pear-ipc'
import { isWindows } from 'which-runtime';
import path from 'path';

customElements.define('reset-applications', class extends HTMLElement {
  router = null
  port = 9222

  load () {
    this.style.display = ''
  }

  unload () {
    this.style.display = 'none'
  }

  constructor () {
    super()
    this.IPC_ID = 'pear'
    this.PLATFORM_DIR = Pear.config.pearDir;
    this.PLATFORM_LOCK = path.join(Pear.config.pearDir,'corestores/platform/primary-key')
    this.SOCKET_PATH = isWindows ? `\\\\.\\pipe\\${this.IPC_ID}-${pipeId(this.PLATFORM_DIR)}` : path.join(Pear.config.pearDir, 'pear.sock')

    this.template = document.createElement('template')
    this.template.innerHTML = `
      <div>
        <style>
          :host > div {
            font-size: .9em;
            margin-left: -4px; /* scrollbar offset compensate */
          }

          .panels-wrapper {
            display: flex;
            gap: 30px;
          }
          .panel-left {
            flex: 1;
          }
          .panel-right {
            width: 400px;
          }

          #app-list {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin: 40px;
          }

          #reset-button {
            width: 250px
          }

          label {
            font-size: 1rem;
            font-weight: bold;
          }

          .button {
            cursor: pointer;
            background: #3a4816;
            color: #efeaea;
            padding: 0.5rem;
            font-family: 'overpass-mono';
            border-radius: 1px;
            border: none;
            white-space: nowrap;
            font-size: 1rem;
            margin-top: 10px;
            display: block;
            width: 100%;
          }
          .button:disabled {
            background: #555;
            cursor: not-allowed;
          }

          h2 { margin: 0 }
          p {
            margin-block-start: 0.75em;
            margin-block-end: 0.75em;
          }

          code {
            background: #3a4816;
            color: #efeaea;
            padding: 0.25rem;
            padding-top: 0.1rem;
            padding-bottom: 0.15rem;
            font-family: 'overpass-mono';
            border-radius: 1px;
            font-size: .9em;
          }
          pre > code { display: block; line-height: 1.025rem; padding-left: 1em; background: #181e19 }
          h1, h2, h3, h4, h5, h6 { font-weight: bold; }
          h1 { font-size: 1.6rem; }
          h2 { font-size: 1.4rem; }
          h3 { font-size: 1.2rem; }
          h4 { font-size: 1rem; }
          h5 { font-size: .8rem; }
          h6 { font-size: .7rem; }
          h1 { padding: .5rem; border-right: 1px solid #B0D944; border-bottom: 1px solid #B0D944; display: inline-block; padding-right: 0.75em; padding-left: 0.5em; }
        </style>

        <div>
          <h1>Reset Pear Apps</h1>
          <div class="panels-wrapper">
            <div class="panel-left">
              <h2>Factory reset your Pear applications.</h2>
              <p>You can reset your applications via CLI:</p>
              <pre><code>pear reset pear://$KEY</code></pre>
              <p>Or use this page to do it for you.</p>

              <h3>Select the apps you want to reset:</h3>
              <div id="app-list" class="app-list"></div>
              <button id="reset-button" class="button" disabled>Reset Selected Apps</button>
            </div>
          </div>
        </div>
      </div>
    `
    this.root = this.attachShadow({ mode: 'open' });
    this.root.appendChild(this.template.content.cloneNode(true));
    this.populateAppList();
    this.resetButton = this.root.getElementById('reset-button');
    this.resetButton.addEventListener('click', () => this.resetSelectedApps());
  }

  populateAppList() {
    const appListContainer = this.root.getElementById('app-list');
    const allApps = this.getPearApps().filter(app => app.link.startsWith('pear://'));

    allApps.forEach(app => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = app.link;
      checkbox.addEventListener('change', () => this.updateButtonState());
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${app.link}`));
      appListContainer.appendChild(label);
    });
  }

  updateButtonState() {
    const checkedBoxes = this.root.querySelectorAll('input[type="checkbox"]:checked');
    this.resetButton.disabled = checkedBoxes.length === 0;
  }

  getPearApps() {
    const result = spawnSync('pear', ['data', '--json', 'apps'], { encoding: 'utf-8' });
    if (result.error) { console.error('Error fetching Pear apps:', result.error); return []; }
    try {
      const lines = result.stdout.trim().split('\n');
      const appsLine = lines.find(line => line.includes('"tag":"apps"'));
      if (!appsLine) return [];
      return JSON.parse(appsLine).data;
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return [];
    }
  }


  resetSelectedApps() {
    const checkedBoxes = this.root.querySelectorAll('input[type="checkbox"]:checked');
    const selectedApps = Array.from(checkedBoxes).map(cb => cb.value);

    if (selectedApps.length === 0) return;
    const isConfirmed = window.confirm(`⚠️ Are you sure you want to reset these apps?\n${selectedApps.join('\n')}`);
    if (!isConfirmed) return;

    selectedApps.forEach(async(link) => {
      const isPear = link.startsWith('pear://')

      if(isPear){
        // use IPC to request app reset
        const ipc = new IPC.Client({
          lock: this.PLATFORM_LOCK,
          socketPath: this.SOCKET_PATH,
          connectTimeout: this.CONNECT_TIMEOUT
        })

        await ipc.ready()
        const stream = await ipc.reset({ link })
        stream.once('data',(data)=>{
          if (data) {
            alert(`✅ App ${link} has been successfully reset!`);
            console.log('Pear app reset:', data)

            // Uncheck the checkbox
            checkedBoxes.forEach(checkbox => {
              if (checkbox.value === link) {
                checkbox.checked = false;
              }
            });

            // Update button state
            this.updateButtonState();
          } else {
            alert(`Failed to reset app ${link}.`);
          }
        })
      }
    });
  }
})

function pipeId (s) {
  const buf = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buf, b4a.from(s))
  return b4a.toString(buf, 'hex')
}