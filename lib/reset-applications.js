import { spawn, spawnSync } from 'child_process'

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
              <pre><code>npm reset pear://$KEY</code></pre>
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

    selectedApps.forEach(app => {
      console.log(`Resetting app: ${app}`);
      const resetProcess = spawn('pear', ['reset', app]);

      // TODO: handle 'RESET' confirmation of cli

      resetProcess.on('close', code => {
        if (code === 0) alert(`Successfully reset ${app}`);
        else alert(`Failed to reset ${app}. Exit code: ${code}`);
      });
      resetProcess.on('error', err => {
        console.error('Error resetting app:', err);
        alert(`Failed to reset ${app}`);
      });
    });
  }
})
