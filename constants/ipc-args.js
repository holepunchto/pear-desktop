'use strict'
import { platform, arch, isWindows } from 'which-runtime';
import { pathToFileURL, fileURLToPath } from 'url-file-url';
import path from 'path';


const BIN = 'by-arch/' + platform + '-' + arch + '/bin/'

let url = new URL(import.meta.url) || electronModuleURL()
if (url.protocol === 'pear:' && url.host === 'dev') {
  url = global.Pear.config.applink
  if (url.slice(-1) !== '/') url += '/'
}

const mount = new URL('.', url)
const swapURL = mount.pathname.endsWith('.bundle/') ? new URL('..', mount) : mount

const PLATFORM_URL = new URL('../../../', swapURL)

export const PLATFORM_DIR = toPath(PLATFORM_URL);
export const PLATFORM_LOCK = toPath(new URL('corestores/platform/primary-key', PLATFORM_URL))
export const SOCKET_PATH = path.join(Pear.config.pearDir, 'pear.sock') // TODO: Make work for Windows

export const CONNECT_TIMEOUT = 20_000;


function electronModuleURL () {
  const u = pathToFileURL(process.execPath)
  const i = u.href.lastIndexOf(BIN)
  if (i === -1) throw ERR_COULD_NOT_INFER_MODULE_PATH('Could not infer the actual module path')
  return new URL(u.href.slice(0, i) + 'constants.js')
}

function toPath(u) {
  console.log('toPath received:', u.href);

  if (u.protocol === 'file:') {
    return fileURLToPath(u).replace(/[/\\]$/, '') || '/';
  }

  if (u.protocol === 'http:' || u.protocol === 'https:') {
    return u.pathname;
  }

  throw new Error(`Unsupported URL protocol: ${u.protocol}`);
}

function ERR_COULD_NOT_INFER_MODULE_PATH (msg) {
  return new PearError(msg, 'ERR_COULD_NOT_INFER_MODULE_PATH', ERR_COULD_NOT_INFER_MODULE_PATH)
}