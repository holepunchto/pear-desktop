/* eslint-env browser */
import http from 'http'
import { WebSocketServer } from 'ws'
import { Session } from 'pear-inspect'
import b4a from 'b4a'

customElements.define(
  'developer-tooling',
  class extends HTMLElement {
    router = null
    port = 9222

    constructor() {
      super()
      this.template = document.createElement('template')
      this.template.innerHTML = `
      <div>
        <style>
          :host > div {
            font-size: .9em;
            margin-left: -4px; /* scrollbar offset compensate */
          }

          #add-key-input {
            width: 100%;
          }

          #add-key-error,
          #change-port-error {
            color: red;
          }

          #server-message:hover #change-port-show {
            display: inline-block;
          }
          #change-port-show {
            display: none;
          }
          #change-port-input {
            width: 80px;
          }

          /* hide up/down arrow for input type=number */
          input::-webkit-outer-spin-button,
          input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
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

          #inspector {
            width: 100%;
            height: 100%;
          }

          .inspector-container {
            background-color: rgb(40, 40, 40);
            height: calc(100vh - 190px);
            max-height: 0px;
          }

          .inspector-padding {
            height: 5px;
          }

          .hidden {
            display: none;
          }

          .app {
            display: flex;
            align-items: center;
            padding: 0.25rem;
            padding-top: 0.1rem;
            padding-bottom: 0.15rem;
          }
          .app--active {
            border: 1px solid #b0d944;
          }
          .app .title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .app:hover .copy,
          .app:hover .open-in-inspector,
          .app:hover .remove {
            display: block;
          }
          .app .copy,
          .app .open-in-inspector {
            margin-right: 10px;
          }
          .app .copy,
          .app .open-in-inspector,
          .app .remove {
            display: none;
          }
          .button {
            cursor: pointer;
            background: #3a4816;
            color: #efeaea;
            padding: 0 0.25rem;
            font-family: 'overpass-mono';
            border-radius: 1px;
            white-space: nowrap;
          }
          #server-message {
            font-size: 0.8rem;
            margin-top: 30px;
          }

          h2 { margin: 0 }
          p {
            margin-block-start: 0.75em;
            margin-block-end: 0.75em;
          }

          input {
            all: unset;
            border: 1px ridge #B0D944;
            background: #000;
            color: #B0D944;
            padding: .45rem;
            font-family: monospace;
            font-size: 1rem;
            line-height: 1rem;
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
          a:visited, a:active, a { color: #B0D944; outline: none; text-decoration: none; background-color: #151517 }
        </style>

        <div>
          <h1>Developer Tooling</h1>
          <div class="panels-wrapper">
            <div class="panel-left">
              <h2>Remotely inspect Pear applications.</h2>
              <p>You can remotely inspect your app via the following command:</p>
              <p><pre><code>pear run --dev .</code></pre></p>
              <p>You can also paste an inspector key from <a href="https://github.com/holepunchto/pear-inspect">pear-inspect</a> in the right:</p>
            </div>
            <div class="panel-right">
              <div>
                <form id="add-key-form">
                  <input id="add-key-input" type="text" placeholder="Paste Pear Inspector Key Here"/>
                  <p id="add-key-error"></p>
                </form>
              </div>
              <h2>Apps</h2>
              <h3 id="no-apps">No apps added. Add an inspect key to start debugging.</h3>
              <div id="apps"></div>
              <div id="server-message" class="hidden">
                Pear DevTools connection running on
                <div>
                  <span id="server-location">http://localhost</span>
                  <span id="change-port-show" class="button">
                    Change port
                  </span>
                  <div>
                    <form id="change-port-form" class="hidden">
                      <input
                        id="change-port-input"
                        type="number"
                        placeholder="New port"
                        min="1024"
                        max="65535"
                      />
                    </form>
                    <p id="change-port-error"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="inspector-container">
          </div>
          <div class="inspector-padding"></div>
        </div>
      </div>
    `
      this.root = this.attachShadow({ mode: 'open' })
      this.root.appendChild(this.template.content.cloneNode(true))

      this.addKeyFormElem = this.root.querySelector('#add-key-form')
      this.addKeyInputElem = this.root.querySelector('#add-key-input')
      this.addKeyErrorElem = this.root.querySelector('#add-key-error')
      this.changePortFormElem = this.root.querySelector('#change-port-form')
      this.changePortInputElem = this.root.querySelector('#change-port-input')
      this.changePortErrorElem = this.root.querySelector('#change-port-error')
      this.changePortShowElem = this.root.querySelector('#change-port-show')
      this.appsElem = this.root.querySelector('#apps')
      this.noAppsElem = this.root.querySelector('#no-apps')
      this.changePortElem = this.root.querySelector('#change-port')
      this.apps = new Map()
      this.activeInspectorSession = null

      this.addKeyInputElem.addEventListener('keydown', (e) => {
        this.addKeyErrorElem.textContent = ''
      })
      this.addKeyFormElem.addEventListener('submit', (e) => {
        e.preventDefault()
        const inspectorKey = this.addKeyInputElem.value
        this.addApp(inspectorKey)
      })

      this.changePortInputElem.addEventListener('keydown', (e) => {
        const isEscape = e.key === 'Escape'
        this.changePortErrorElem.textContent = ''
        if (isEscape) {
          this.changePortFormElem.classList.add('hidden')
          this.changePortInputElem.value = ''
        }
      })
      this.changePortShowElem.addEventListener('click', () => {
        this.changePortFormElem.classList.remove('hidden')
      })
      this.changePortFormElem.addEventListener('submit', (e) => {
        e.preventDefault()
        this.port = Number(this.changePortInputElem.value)
        this.initServer()
      })

      this.initServer()
    }

    openInspector(sessionId) {
      this.activeInspectorSession = sessionId
      this.render()
      const inspectorContainer = this.root.querySelector('.inspector-container')
      inspectorContainer.style['max-height'] = '600px'
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      inspectorContainer.innerHTML = `
      <iframe id="inspector" frameBorder="0" src="/vendor/devtools-frontend/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:${this.port}/${sessionId}" />
      `
    }

    closeInspector() {
      this.activeInspectorSession = null
      const inspectorContainer = this.root.querySelector('.inspector-container')
      inspectorContainer.style['max-height'] = '0px'
      const inspector = this.root.querySelector('#inspector')
      inspectorContainer.removeChild(inspector)
    }

    render() {
      this.appsElem.replaceChildren(
        ...[...this.apps].map(([sessionId, app]) => {
          const div = document.createElement('div')
          const c = ['app']
          if (this.activeInspectorSession && sessionId == this.activeInspectorSession) {
            c.push('app--active')
          }
          div.innerHTML = `
        <div class="${c.join(' ')}">
          <div class="title">${app.title} (${app.url})</div>
          <div class="button copy">Copy Chrome URL</div>
          <div class="button open-in-inspector">Inspect</div>
          <div class="button remove">✕</div>
        </div>
      `
          div.querySelector('.copy').addEventListener('click', () => {
            navigator.clipboard.writeText(
              `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:${this.port}/${sessionId}`
            )
          })
          div.querySelector('.open-in-inspector').addEventListener('click', async () => {
            this.openInspector(sessionId)
          })
          div.querySelector('.remove').addEventListener('click', async () => {
            this.apps.delete(sessionId)
            this.render()
            if (this.activeInspectorSession && sessionId === this.activeInspectorSession) {
              this.closeInspector()
            }
          })

          return div
        })
      )

      if (this.apps.size > 0) {
        this.noAppsElem.classList.add('hidden')
      } else {
        this.noAppsElem.classList.remove('hidden')
      }

      if (this.port) {
        this.root.querySelector('#server-message').classList.remove('hidden')
        this.root.querySelector('#server-location').textContent = `http://localhost:${this.port}`
      }
    }

    addApp(inspectorKey, opts = {}) {
      const open = opts.open ?? true
      const isUrl = inspectorKey.includes('dev/')
      if (isUrl) inspectorKey = inspectorKey.split('dev/').pop()
      const isIncorrectLength = inspectorKey.length !== 64
      if (isIncorrectLength) {
        this.addKeyErrorElem.textContent = 'Key needs to be 64 characters long'
        return
      }

      const sessionId = generateUuid()
      const inspectorSession = new Session({ inspectorKey: b4a.from(inspectorKey, 'hex') })
      const app = {
        inspectorKey,
        title: '',
        url: '',
        inspectorSession
      }

      inspectorSession.on('close', () => {
        this.apps.delete(sessionId)
        this.render()
      })
      inspectorSession.on('info', ({ filename }) => {
        app.url = filename || 'untitled'
        app.title = filename?.split('/').pop() || 'untitled'
        this.apps.set(sessionId, app)
        this.render()
      })

      this.addKeyInputElem.value = ''
      this.addKeyErrorElem.textContent = ''
      if (open) {
        this.openInspector(sessionId)
      }
      this.render()
      return sessionId
    }

    initServer() {
      this.devtoolsHttpServer?.close()

      this.devtoolsHttpServer = http.createServer()
      const devToolsWsServer = new WebSocketServer({ noServer: true })

      this.devtoolsHttpServer.listen(this.port, () => {
        console.log(`[devtoolsHttpServer] running on port ${this.port}`)
        this.render()
        this.changePortFormElem.classList.add('hidden')
      })
      this.devtoolsHttpServer.on('error', (err) => {
        this.changePortErrorElem.textContent = err?.message
      })
      this.devtoolsHttpServer.on('request', (req, res) => {
        if (req.url !== '/json/list') {
          res.writeHead(404)
          res.end()
          return
        }

        const targets = [...this.apps].map(([sessionId, app]) => ({
          description: 'node.js instance', // `Pear app: ${app.name}`,
          devtoolsFrontendUrl: `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:${this.port}/${sessionId}`,
          devtoolsFrontendUrlCompat: `devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=127.0.0.1:${this.port}/${sessionId}`,
          faviconUrl: 'https://nodejs.org/static/images/favicons/favicon.ico',
          id: sessionId,
          title: app.title,
          type: 'node',
          url: `file://${app.url}`,
          webSocketDebuggerUrl: `ws://127.0.0.1:${this.port}/${sessionId}`
        }))

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-cache',
          'Content-Length': JSON.stringify(targets).length
        })
        res.end(JSON.stringify(targets))
      })
      this.devtoolsHttpServer.on('upgrade', (request, socket, head) => {
        console.log(`[devtoolsHttpServer] UPGRADE. url=${request.url}`)
        const sessionId = request.url.substr(1)
        const sessionIdExists = this.apps.has(sessionId)
        if (!sessionIdExists) return socket.destroy()

        devToolsWsServer.handleUpgrade(request, socket, head, (ws) =>
          devToolsWsServer.emit('connection', ws, request)
        )
      })

      devToolsWsServer.on('connection', (devtoolsSocket, request) => {
        const sessionId = request.url.substr(1)
        const app = this.apps.get(sessionId)
        if (!app) return devtoolsSocket.destroy()

        const { inspectorSession } = app

        const onMessage = (msg) => {
          const { pearInspectMethod } = msg
          const isACDPMessage = !pearInspectMethod

          if (isACDPMessage) return devtoolsSocket.send(JSON.stringify(msg))
        }
        inspectorSession.connect()
        inspectorSession.on('message', onMessage)
        devtoolsSocket.on('message', (msg) => inspectorSession.post(JSON.parse(msg)))
        devtoolsSocket.on('close', () => {
          inspectorSession.disconnect()
          inspectorSession.off('message', onMessage)
          app.connected = false
          this.render()
        })

        app.connected = true
        this.render()
      })
    }

    async load(page, opts) {
      if (opts.query) {
        this.addApp(opts.query)
      }
      this.style.display = ''
    }

    unload() {
      this.style.display = 'none'
    }
  }
)

// Can't use `uuid` module for some reason as it results in a throw with `crypto` when importing
function generateUuid() {
  let result, i, j
  result = ''
  for (j = 0; j < 32; j++) {
    if (j === 8 || j === 12 || j === 16 || j === 20) {
      result = result + '-'
    }
    i = Math.floor(Math.random() * 16).toString(16)
    result = result + i
  }
  return result
}
