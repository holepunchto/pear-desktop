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

const isWin = process.platform === 'win32'

function expandWinPath (path) {
  let prev
  // the following loop is for handling nested environment variables
  do {
    prev = path
    path = path.replaceAll(WIN_EXPANDER_MATCHER, (match, name) => process.env[name.toUpperCase()] || match)
  } while (path !== prev)

  return path
}

function getWinPath () {
  const userPathQuery = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', 'Path'])
  if (userPathQuery.status !== 0 && !userPathQuery.stderr.toString().includes('unable to find')) {
    throw new Error('Failed to query user PATH')
  }

  const userPathMatches = userPathQuery.stdout.toString()?.match(WIN_REGVAL_MATCHER)
  if (!Array.isArray(userPathMatches) || userPathMatches.length !== 2) {
    throw new Error('Failed to extract user PATH')
  }

  let userPath = userPathMatches[1]
  // TODO: Test with problematic strings and query it back if escapes have been handled properly
  if (userPath.startsWith('"') && userPath.endsWith('"')) {
    userPath = userPath.slice(1, -1).replaceAll('""', '"')
  }

  const systemPathQuery = spawnSync('reg', ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'Path'])
  if (systemPathQuery.status !== 0 && !systemPathQuery.stderr.toString().includes('unable to find')) {
    throw new Error('Failed to query system PATH')
  }

  const systemPathMatches = systemPathQuery.stdout.toString()?.match(WIN_REGVAL_MATCHER)
  if (!Array.isArray(systemPathMatches) || systemPathMatches.length !== 2) {
    throw new Error('Failed to extract system PATH')
  }

  let systemPath = systemPathMatches[1]
  if (systemPath.startsWith('"') && systemPath.endsWith('"')) {
    systemPath = systemPath.slice(1, -1).replaceAll('""', '"')
  }

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
    this.zsh = false
    this.bash = false
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
                <p>Pear is in the ${pathLocation} PATH but not being used as the main path because it is being overridden by a different executable in the ${!isWin || isActivePearInSystemPath ? 'system' : 'user'} PATH.</p>
              </blockquote>
              <p>To attempt to fix this, click the button below.</p>
              <p><button id="fix-path-button">${isWin ? (isActivePearInSystemPath ? 'Reinstall Pear to the system PATH' : 'Reinstall Pear to the user PATH') : 'Reinstall Pear to the end of the shell rc file'}</button><p>
             `
          )
        : `
          <blockquote>
           <p>Pear setup is nearly complete.</p>
          </blockquote>
          <p>To finish installing Pear Runtime set your system path to</p>
          <p><code>${BIN}</code></p>
          <p> or click the button.</p>
          <p><button id="setup-button"> Automatic Setup Completion </button><p>
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
      this.#install(isActivePearInSystemPath).then(() => this.#render()).catch((err) => this.#error(err))
    })

    this.shadowRoot.querySelector('#fix-path-button')?.addEventListener('click', () => {
      this.#fixPath()
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

    let pears = []
    try { pears = which.sync(isWin ? 'pear.cmd' : 'pear', { all: true }) } catch {}
    const activePear = pears?.[0]

    return {
      isPearInPath: pears.some((pear) => path.dirname(pear) === BIN),
      isActivePearCorrect: activePear ? path.dirname(activePear) === BIN : false,
      isActivePearInSystemPath: activePear ? expandedSystemPath?.split(path.delimiter).includes(path.dirname(activePear)) : false
    }
  }

  #install (toSystemPath = false) {
    const runtimeSubpath = path.join('current', 'by-arch', process.platform + '-' + process.arch, 'bin', 'pear-runtime')
    fs.mkdirSync(BIN, { recursive: true })

    if (isWin) {
      const pearCmd = path.join(BIN, 'pear.cmd')
      if (!fs.existsSync(pearCmd)) fs.writeFileSync(path.join(BIN, 'pear.cmd'), `@echo off\r\n"%~dp0..\\${runtimeSubpath}" %*`)

      const pearPs1 = path.join(BIN, 'pear.ps1')
      if (!fs.existsSync(pearPs1)) fs.writeFileSync(path.join(BIN, 'pear.ps1'), `& "$PSScriptRoot\\..\\${runtimeSubpath}" @args`)

      const { userPath, systemPath } = getWinPath()
      if (toSystemPath) {
        const escapedNewPath = `${BIN}${path.delimiter}${systemPath}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")
        const setSystemResult = spawnSync('powershell', ['-Command', `Start-Process -Verb RunAs reg -ArgumentList 'add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Pathos /t REG_SZ /d "${escapedNewPath}" /f'`])
        if (setSystemResult.status !== 0) throw new Error('Failed to set system PATH')
      } else {
        const newPath = userPath ? `${BIN}${path.delimiter}${userPath}` : BIN
        spawnSync('reg', ['add', 'HKCU\\Environment', '/v', 'Path', '/t', 'REG_SZ', '/d', newPath, '/f'])
      }
    } else {
      const runtime = path.join('..', runtimeSubpath)

      try {
        const bash = which.sync('bash')
        fs.writeFileSync(path.join(os.homedir(), bash ? '.bashrc' : '.profile'), '\n' + this.statementComment + this.statement + '\n', { flag: 'a' })
      } catch {}

      try {
        const zsh = which.sync('zsh')
        if (zsh) fs.writeFileSync(path.join(os.homedir(), '.zshrc'), '\n' + this.statementComment + this.statement + '\n', { flag: 'a' })
      } catch {}

      const pear = path.join(BIN, 'pear')
      const tmp = path.join(BIN, Math.floor(Math.random() * 1000) + '.pear')
      fs.symlinkSync(runtime, tmp)
      fs.renameSync(tmp, pear)
      fs.chmodSync(pear, 0o755)
    }

    return Promise.resolve()
  }

  #fixPath () {
    if (isWin) {
      let npmPearPath
      try {
        npmPearPath = which.sync('pear')
      } catch (err) {
        throw new Error('Failed to find npm pear path')
      }

      const { userPath, systemPath } = getWinPath()

      const splitUserPath = userPath.split(';')
      const userNpmPearIndex = splitUserPath.indexOf(npmPearPath)
      const userBinIndex = splitUserPath.indexOf(BIN)

      if (userNpmPearIndex !== -1) {
        if (userBinIndex !== -1) splitUserPath.splice(userBinIndex, 1)
        splitUserPath.unshift(BIN)

        const newPath = splitUserPath.join(';')
        spawnSync('reg', ['add', 'HKCU\\Environment', '/v', 'Path', '/t', 'REG_SZ', '/d', newPath, '/f'])

        process.env.PATH = newPath

        return
      }

      const splitSystemPath = systemPath.split(';')
      const systemNpmPearIndex = splitSystemPath.indexOf(npmPearPath)
      const systemBinIndex = splitSystemPath.indexOf(BIN)

      if (systemNpmPearIndex !== -1) {
        if (systemBinIndex !== -1) splitSystemPath.splice(systemBinIndex, 1)
        splitSystemPath.unshift(BIN)

        const newPath = splitSystemPath.join(';')

        // TODO: Test this thoroughly and update Pathos to Path when ready, try problematic string and query it back
        const escapedNewPath = newPath.replace(/[\\'"]/g, (match) => `\\${match}`)
        const setSystemResult = spawnSync('powershell', ['-Command', `Start-Process -Verb RunAs reg -ArgumentList 'add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Pathos /t REG_SZ /d "${escapedNewPath}" /f'`])
        if (setSystemResult.status !== 0) {
          throw new Error('Failed to set system PATH')
        }

        process.env.PATH = newPath
      }

      return
    }

    // TODO: Test in clean environment and with non-bash/zsh shells (maybe add additional checks if problematic)
    const fullStatement = '\n' + this.statementComment + this.statement + '\n'
    for (const profile in ['.bashrc', '.profile', '.zshrc']) {
      if (!fs.existsSync(profile)) continue

      const content = fs.readFileSync(profile, 'utf-8')
      if (!content.endsWith(fullStatement)) {
        const newContent = content.replace(this.stmtrx, '') + fullStatement
        fs.writeFileSync(profile, newContent)
      }
    }

    process.env.PATH = `${BIN}${path.delimiter}${process.env.PATH}`
  }
})
