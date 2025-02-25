/* eslint-env browser */
import os from 'os'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import which from 'bare-which'

const { config } = Pear

const BIN = path.join(config.pearDir, 'bin')
const WIN_REGVAL_MATCHER = /REG(?:_EXPAND)?_SZ\s+([^\r\n]+)\r?\n/
const WIN_EXPANDER_MATCHER = /%([^%]+)%/g
const SUPPORTED_SHELLS = ['bash', 'zsh', 'sh']

const isWin = process.platform === 'win32'

function expandWinPath (path) {
  let prev
  // the following loop is for handling nested environment variables
  do {
    prev = path
    path = path.replaceAll(WIN_EXPANDER_MATCHER, (match, name) => process.env[name] || match)
  } while (path !== prev)

  return path
}

function writeWinReg (dir, key, value, admin = false) {
  const fileName = `pear-path-${Math.random().toString(36).substring(2)}.reg`
  const tempRegPath = path.join(os.tmpdir(), fileName)
  const encoded = Buffer.from(value, 'utf16le').toString('hex').match(/../g).join(',')
  fs.writeFileSync(tempRegPath, `Windows Registry Editor Version 5.00\r\n\r\n[${dir}]\r\n"${key}"=hex(2):${encoded},00,00`)

  let result
  try {
    result = admin
      ? spawnSync('powershell', ['-Command', `Start-Process -Wait -Verb RunAs reg -ArgumentList 'import "${tempRegPath}"'`])
      : spawnSync('reg', ['import', tempRegPath])
  } catch (err) {
    throw new Error(`Failed to write to registry path ${dir} with key ${key}`)
  } finally {
    fs.unlinkSync(tempRegPath)
  }

  return result
}

function getWinPath () {
  const userPathQuery = spawnSync('reg', ['query', 'HKEY_CURRENT_USER\\Environment', '/v', 'PathTest'])
  if (userPathQuery.status !== 0 && !userPathQuery.stderr?.toString().includes('unable to find')) {
    throw new Error('Failed to query user PATH')
  }

  const userPathMatches = userPathQuery.stdout.toString()?.match(WIN_REGVAL_MATCHER)
  if (!Array.isArray(userPathMatches) || userPathMatches.length !== 2) {
    throw new Error('Failed to extract user PATH')
  }

  const userPath = userPathMatches[1]

  const systemPathQuery = spawnSync('reg', ['query', 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'PathTest'])
  if (systemPathQuery.status !== 0 && !systemPathQuery.stderr?.toString().includes('unable to find')) {
    throw new Error('Failed to query system PATH')
  }

  const systemPathMatches = systemPathQuery.stdout.toString()?.match(WIN_REGVAL_MATCHER)
  if (!Array.isArray(systemPathMatches) || systemPathMatches.length !== 2) {
    throw new Error('Failed to extract system PATH')
  }

  const systemPath = systemPathMatches[1]

  return { userPath, systemPath }
}

function getUnixPath () {
  const shell = process.env.SHELL || '/bin/sh'
  const path = spawnSync(shell, ['-c', 'echo $PATH'])
  if (path.error || path.status !== 0) {
    throw new Error('Failed to get user PATH')
  }

  return path.stdout.toString().trim()
}

customElements.define('pear-welcome', class extends HTMLElement {
  constructor () {
    super()
    this.template = document.createElement('template')
    const pathLocation = this.getAttribute('path-location')
    this.template.innerHTML = `
      <style>
        blockquote { outline: 1px solid #323532; margin-inline-start: 0; margin-inline-end: 0; display: block; margin-block-start: 1rem; margin-block-end: 0; padding: 1px; font-size: .825rem; margin-top: -1rem; margin-bottom: 1rem; border-radius: 2px; }
        blockquote::before { content: "✔"; float: left; font-size: 1.625rem; margin-left: 1rem; margin-right: 0.625rem; }
        video { float: right; outline: 1px solid #323532; border-radius: 2px; }
        #welcome { float: left; width: calc(100% - 420px); }
        code {
          background: #3a4816;
          color: #efeaea;
          padding: 0.25rem;
          padding-top: 0.1rem;
          padding-bottom: 0.15rem;
          font-family: 'overpass-mono';
          border-radius: 1px;
        }
      </style>
      <blockquote>
        <p> Pear is in the ${pathLocation} PATH and ready to go .</p>
      </blockquote>
      <div id="welcome">
        <h2> Welcome... </h2>
        <p> ...to the Internet of Peers. <p>
        <p> Pear provides the <code>pear</code> Command-line Interface as the primary interface for developing, sharing & maintaining unstoppable peer-to-peer applications and systems. </p>
        <p> To get started, open a terminal, type <code>pear</code> and hit return. </p>
      </div>
      <video width="380" height="390" autoplay muted style="background:#000">
        <source src="./assets/usage.mp4" type="video/mp4">
      </video>
    `
    this.root = this.attachShadow({ mode: 'open' })

    this.root.appendChild(this.template.content.cloneNode(true))
  }
})

customElements.define('system-status', class extends HTMLElement {
  router = null

  connectedCallback () {
    this.root.addEventListener('click', (evt) => {
      this.router.link(evt)
    })
  }

  load () {
    this.style.display = ''
  }

  unload () {
    this.style.display = 'none'
  }

  constructor () {
    super()
    this.statementComment = '# Added by Pear Runtime, configures system with Pear CLI\n'
    this.statement = `export PATH="${BIN}":$PATH`
    this.stmtrx = new RegExp(`^export PATH="${BIN}":\\$PATH$`, 'm')
    this.root = this.attachShadow({ mode: 'open' })
    this.update = null
    this.#render()
  }

  #render () {
    const { isPearInPath, isActivePearCorrect, isActivePearInSystemPath } = this.#installed()
    const pathLocation = (isWin && !isActivePearInSystemPath) ? 'user' : 'system'
    const shell = process.env.SHELL
    const isCurrentShellSupported = !isWin ? SUPPORTED_SHELLS.some((supportedShell) => shell?.endsWith(`/${supportedShell}`)) : false
    this.shadowRoot.innerHTML = `
    <div id="panel">
      <style>
        #panel { user-select: none; }
        blockquote { outline: 1px solid #323532; margin-inline-start: 0; margin-inline-end: 0; display: block; margin-block-start: 1rem; margin-block-end: 0; padding: 1px; font-size: .825rem; border-radius: 2px; }
        blockquote::before { content: "ℹ"; float: left; font-size: 1.625rem; margin-left: 1rem; margin-right: 0.625rem; }
        button { background: #151517; color: #B0D944; border: 1px solid; padding: .575em .65em; cursor: pointer; margin-top: 2rem; font-size: 1.20rem; }
        #tip { text-indent: 4px; margin-top: -.25rem }
        code {
          background: #3a4816;
          color: #efeaea;
          padding: 0.25rem;
          padding-top: 0.1rem;
          padding-bottom: 0.15rem;
          font-family: 'overpass-mono';
          border-radius: 1px;
          user-select: text;
        }
        #tip > p { margin-top: 6px; margin-bottom: 6px; padding: 0}
        #tip {
          margin-top: 3rem;
        }
        #update-button {
          position: fixed;
          left: 893px;
          top: 170px;
          width: 171px;
        }
        h1 {
          padding: 0.5rem;
          display: inline-block;
          padding-right: 0.75em;
          font-weight: bold;
          font-size: 2.46rem;
          margin-left: -0.7rem;
          margin-top: 1rem;
          margin-bottom: 1.25rem;
        }
      </style>
      <h1>System Status</h1>
      <button id="update-button"> Update Available </button>
      ${
        isPearInPath
        ? (isActivePearCorrect
             ? `<pear-welcome path-location="${pathLocation}"></pear-welcome>`
             : `
              <blockquote>
                <p>Pear is in the ${pathLocation} PATH but not being used as the main path because it is being overridden by a different executable.</p>
              </blockquote>
              <p>To fix this, click the button below.</p>
              <p>
                <button id="fix-path-button">
                  ${isWin ? (isActivePearInSystemPath ? 'Reinstall Pear to the system PATH (Requires Administrator Access)' : 'Reinstall Pear to the user PATH') : `Reinstall Pear to the end of the shell (${shell}) rc file`}
                </button>
              </p>
             `
          )
        : `
          <blockquote>
           <p>Pear setup is nearly complete.</p>
          </blockquote>
          <p>To finish installing Pear Runtime set your system path to</p>
          <p><code>${BIN}</code></p>
          <p>
            ${isWin ? `or click the button below to install it to your ${pathLocation} PATH.` : (isCurrentShellSupported ? `or click the button to install it to your shell (${shell}) rc file.` : `As your shell (${shell}) is not supported for automatic setup, please add the above to your PATH in your shell rc file manually.`)}
          </p>
          ${isWin || isCurrentShellSupported ? `<p><button id="setup-button">Automatic Setup Completion${isWin && isActivePearInSystemPath ? ' (Requires Administrator Access)' : ''}</button><p>` : ''}
        `
      }
    </div>
    `

    this.updateButton = this.shadowRoot.querySelector('#update-button')
    this.updateButton.style.display = 'none'

    this.updateButton.addEventListener('mouseenter', (e) => {
      e.target.innerText = 'Click to Restart'
    })
    this.updateButton.addEventListener('mouseout', (e) => {
      e.target.innerText = 'Update Available'
    })

    this.shadowRoot.querySelector('#setup-button')?.addEventListener('click', () => {
      this.#install().then(() => this.#render()).catch((err) => this.#error(err))
    })

    this.shadowRoot.querySelector('#fix-path-button')?.addEventListener('click', () => {
      this.#installPath()
      this.#render()
    })

    Pear.updates((update) => {
      this.update = update
      this.updateButton.style.display = ''

      if (this.updateButtonListener) {
        this.updateButton.removeEventListener('click', this.updateButtonListener)
      }

      this.updateButtonListener = () => Pear.restart({ platform: this.update.app === false }).catch(console.error)
      this.updateButton.addEventListener('click', this.updateButtonListener)
    })
  }

  #error (err) {
    console.error(err)
  }

  #installed () {
    let expandedUserPath, expandedSystemPath
    if (isWin) {
      const { userPath, systemPath } = getWinPath()
      expandedUserPath = expandWinPath(userPath)
      expandedSystemPath = expandWinPath(systemPath)
      process.env.PATH = `${expandedSystemPath}${path.delimiter}${expandedUserPath}`
    } else {
      process.env.PATH = getUnixPath()
    }

    const pears = which.sync(isWin ? 'pear.cmd' : 'pear', { all: true, nothrow: true }) || []
    const activePear = pears?.[0]

    return {
      isPearInPath: pears.some((pear) => path.dirname(pear) === BIN),
      isActivePearCorrect: activePear ? path.dirname(activePear) === BIN : false,
      isActivePearInSystemPath: activePear ? expandedSystemPath?.split(path.delimiter).includes(path.dirname(activePear)) : false
    }
  }

  #install () {
    const runtimeSubpath = path.join('current', 'by-arch', process.platform + '-' + process.arch, 'bin', 'pear-runtime')
    fs.mkdirSync(BIN, { recursive: true })

    if (isWin) {
      const pearCmd = path.join(BIN, 'pear.cmd')
      if (!fs.existsSync(pearCmd)) fs.writeFileSync(path.join(BIN, 'pear.cmd'), `@echo off\r\n"%~dp0..\\${runtimeSubpath}" %*`)

      const pearPs1 = path.join(BIN, 'pear.ps1')
      if (!fs.existsSync(pearPs1)) fs.writeFileSync(path.join(BIN, 'pear.ps1'), `& "$PSScriptRoot\\..\\${runtimeSubpath}" @args`)
    } else {
      const runtime = path.join('..', runtimeSubpath)
      const pear = path.join(BIN, 'pear')
      const tmp = path.join(BIN, Math.floor(Math.random() * 1000) + '.pear')
      fs.symlinkSync(runtime, tmp)
      fs.renameSync(tmp, pear)
      fs.chmodSync(pear, 0o755)
    }

    this.#installPath()

    return Promise.resolve()
  }

  #installPath () {
    if (isWin) {
      const npmPearExec = which.sync(isWin ? 'pear.cmd' : 'pear', { nothrow: true })
      const npmPearPath = npmPearExec ? path.dirname(npmPearExec) : undefined

      const { userPath, systemPath } = getWinPath()

      const splitSystemPath = systemPath.split(';')
      const expandedSplitSystemPath = splitSystemPath.map(expandWinPath)
      const systemNpmPearIndex = npmPearPath ? expandedSplitSystemPath.indexOf(npmPearPath) : -1
      const systemBinIndex = expandedSplitSystemPath.indexOf(BIN)

      if (systemNpmPearIndex !== -1) {
        if (systemBinIndex !== -1) splitSystemPath.splice(systemBinIndex, 1)
        splitSystemPath.splice(systemNpmPearIndex - (systemBinIndex !== -1 && systemBinIndex < systemNpmPearIndex ? 1 : 0), 0, BIN)

        const newPath = splitSystemPath.join(';')

        const setSystemResult = writeWinReg('HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', 'PathTest', newPath, true)
        if (setSystemResult?.status !== 0) throw new Error('Failed to set system PATH')

        process.env.PATH = expandWinPath(newPath)

        return
      }

      const splitUserPath = userPath.split(';')
      const expandedSplitUserPath = splitUserPath.map(expandWinPath)
      const userBinIndex = expandedSplitUserPath.indexOf(BIN)

      if (userBinIndex !== -1) splitUserPath.splice(userBinIndex, 1)
      splitUserPath.unshift(BIN)

      const newPath = splitUserPath.join(';')
      const setUserResult = writeWinReg('HKEY_CURRENT_USER\\Environment', 'PathTest', newPath)
      if (setUserResult?.status !== 0) throw new Error('Failed to set user PATH')

      return
    }

    const fullStatement = '\n' + this.statementComment + this.statement + '\n'
    const shell = process.env.SHELL || '/bin/sh'
    const profile = shell.endsWith('zsh') ? '.zshrc' : shell.endsWith('bash') ? '.bashrc' : '.profile'

    const profilePath = path.join(os.homedir(), profile)
    if (!fs.existsSync(profilePath)) throw new Error(`Shell profile ${profile} not found`)

    const content = fs.readFileSync(profilePath, 'utf-8')
    if (!content.endsWith(fullStatement)) {
      const newContent = content.replace(this.stmtrx, '') + fullStatement
      fs.writeFileSync(profilePath, newContent)
    }
  }
})
