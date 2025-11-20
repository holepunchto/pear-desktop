/* eslint-env browser */
import cp from 'child_process'

customElements.define(
  'inspector-page',
  class extends HTMLElement {
    router = null
    port = 9222

    constructor() {
      super()
      this.template = document.createElement('template')
      this.template.innerHTML = /* html */ `
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
          .app .title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .app:hover .copy,
          .app:hover .open-in-chrome,
          .app:hover .remove {
            display: block;
          }
          .app .copy,
          .app .open-in-chrome {
            margin-right: 10px;
          }
          .app .copy,
          .app .open-in-chrome,
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
        </style>

        <div>
          <h1>Inspector</h1>
          <div class="panels-wrapper">
            <div class="panel-left">
              <h2>Remotely inspect Pear applications.</h2>
            </div>
          </div>
        </div>
      </div>
    `
      this.root = this.attachShadow({ mode: 'open' })
      this.root.appendChild(this.template.content.cloneNode(true))
    }

    render() {
      this.appsElem.replaceChildren(
        ...[...this.apps].map(([sessionId, app]) => {
          const div = document.createElement('div')
          div.innerHTML = `
        <div class="app">
          <div class="title">${app.title} (${app.url})</div>
          <div class="button copy">Copy URL</div>
          <div class="button open-in-chrome">Open in Chrome</div>
          <div class="button remove">✕</div>
        </div>
      `
          div.querySelector('.copy').addEventListener('click', () => {
            navigator.clipboard.writeText(
              `devtools://devtools/bundled/js_app.html?experiments=true&v8only=true&ws=127.0.0.1:${this.port}/${sessionId}`
            )
          })
          div.querySelector('.open-in-chrome').addEventListener('click', () => {
            openChrome('chrome://inspect')
          })
          div.querySelector('.remove').addEventListener('click', () => {
            this.apps.delete(sessionId)
            this.render()
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
        this.root.querySelector('#host-location').textContent = `localhost:${this.port}`
      }
    }

    load() {
      this.style.display = ''
    }

    unload() {
      this.style.display = 'none'
    }
  }
)

function openChrome(url) {
  const params = {
    darwin: ['open', '-a', 'Google Chrome', url],
    linux: ['google-chrome', url],
    win32: ['start', 'chrome', url]
  }[process.platform]

  if (!params) throw new Error('Cannot open Chrome')

  const [command, ...args] = params
  cp.spawn(command, args)
}
