/* eslint-env browser */
import IPC from 'pear-ipc'
import b4a from 'b4a'
import sodium from 'sodium-native'
import { isWindows } from 'which-runtime'
import path from 'path'

const IPC_ID = 'pear'
const PLATFORM_DIR = Pear.config.pearDir
const SOCKET_PATH = isWindows ? `\\\\.\\pipe\\${IPC_ID}-${pipeId(PLATFORM_DIR)}` : path.join(Pear.config.pearDir, 'pear.sock')
const CONNECT_TIMEOUT = 20_000
const ipc = new IPC.Client({
  socketPath: SOCKET_PATH,
  connectTimeout: CONNECT_TIMEOUT
})

customElements.define(
  'drop-applications',
  class extends HTMLElement {
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
            flex: 1;
            gap: 30px;
            padding-bottom: 40px;
          }

          #app-list {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin: 40px;
          }

          #drop-button {
            width: 250px;
          }
          
          .button-container {
            display: flex;
            justify-content: space-between;
          }

          #select-help {
            display: flex;
            justify-content: space-between;
          }

          #select-help > * {
            margin-left: 1rem;
            width: 150px;
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
          h1, h2, h3 { font-weight: bold; }
          h1 { font-size: 1.6rem; }
          h2 { font-size: 1.4rem; }
          h3 { font-size: 1.2rem; }
          h1 { padding: .5rem; border-right: 1px solid #B0D944; border-bottom: 1px solid #B0D944; display: inline-block; padding-right: 0.75em; padding-left: 0.5em; }
        </style>

        <div>
          <h1>Drop Pear Apps</h1>
          <div class="panels-wrapper">
            <h2>Drop all data from Pear Apps.</h2>
            <p>You can drop your applications via CLI:</p>
            <pre><code>pear drop app pear://$KEY</code></pre>
            <p>Or use this page to do it for you.</p>
            
            <h3>Select the apps you want to drop:</h3>
            <div id="app-list" class="app-list"></div>
            <div class="button-container">
              <button id="drop-button" class="button" disabled>Drop Selected Apps</button>
              <div id="select-help">
                <button id="select-all" class="button" disabled>Select All</button>
                <button id="deselect-all" class="button" disabled>Deselect All</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
      this.root = this.attachShadow({ mode: 'open' })
      this.root.appendChild(this.template.content.cloneNode(true))
      this.populateAppList()

      this.dropButton = this.root.getElementById('drop-button')
      this.selectAllButton = this.root.getElementById('select-all')
      this.deselectAllButton = this.root.getElementById('deselect-all')
      this.selectAllButton.disabled = false
      this.deselectAllButton.disabled = false

      this.dropButton.addEventListener('click', () => this.dropSelectedApps())
      this.selectAllButton.addEventListener('click', () => this.selectAll())
      this.deselectAllButton.addEventListener('click', () => this.deselectAll())
    }

    async populateAppList () {
      // IPC to get data apps
      const appListContainer = this.root.getElementById('app-list')

      try {
        await ipc.ready()
        const stream = await ipc.data({ resource: 'apps' })

        stream.once('data', (res) => {
          const appLinks = res.data.map((app) => app.link)

          appLinks.forEach((app) => {
            const label = document.createElement('label')
            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.value = app
            checkbox.addEventListener('change', () => this.updateButtonState())
            label.appendChild(checkbox)
            label.appendChild(document.createTextNode(` ${app}`))
            appListContainer.appendChild(label)
          })
        })

        stream.on('error', (err) => {
          console.error('Error in IPC stream', err)
        })
      } catch (err) {
        console.error('Error when requesting apps data through IPC', err)
      }
    }

    updateButtonState () {
      const checkboxes = this.root.querySelectorAll('#app-list input[type="checkbox"]')
      const checked = [...checkboxes].filter(cb => cb.checked)

      this.dropButton.disabled = checked.length === 0
    }

    selectAll () {
      const checkboxes = this.root.querySelectorAll('#app-list input[type="checkbox"]')
      checkboxes.forEach(cb => { cb.checked = true })
      this.updateButtonState()
    }

    deselectAll () {
      const checkboxes = this.root.querySelectorAll('#app-list input[type="checkbox"]')
      checkboxes.forEach(cb => { cb.checked = false })
      this.updateButtonState()
    }

    dropSelectedApps () {
      const checkedBoxes = this.root.querySelectorAll('input[type="checkbox"]:checked')
      const selectedApps = Array.from(checkedBoxes).map((cb) => cb.value)

      if (selectedApps.length === 0) return
      const isConfirmed = window.confirm(`⚠️ Are you sure you want to drop these apps?\n${selectedApps.join('\n')}`)
      if (!isConfirmed) return

      selectedApps.forEach(async (url) => {
        // use IPC to request app drop
        const link = url

        try {
          await ipc.ready()
          console.log(link)
          const stream = await ipc.drop({ link })

          stream.on('data', (res) => {
            if (res.tag === 'final' && res.data.success) {
              console.log('Pear app dropped:', res)
              alert(`✅ App ${link} has been successfully dropped!`)

              checkedBoxes.forEach((checkbox) => {
                if (checkbox.value === url) {
                  checkbox.checked = false
                }
              })
              this.updateButtonState()
            } else if (res.tag === 'error') {
              alert(`❌ Failed to drop app ${link}.`)
              console.error('Error in IPC stream request', res.data)
            }
          })
          stream.on('error', (err) => {
            alert(`❌ Failed to drop app ${link}.`)
            console.error('Error in IPC stream', err)
          })
        } catch (err) {
          alert(`❌ Failed to drop app ${link}.`)
          console.error('Error when requesting IPC drop', err)
        }
      })
    }
  }
)

function pipeId (s) {
  const buf = b4a.allocUnsafe(32)
  sodium.crypto_generichash(buf, b4a.from(s))
  return b4a.toString(buf, 'hex')
}
